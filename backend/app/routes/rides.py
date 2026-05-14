"""Ride routes with realtime dispatch + push notifications."""
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends

from ..db import db
from ..deps import get_current_user, require_role
from ..models import CreateRideReq, CancelReq, VerifyPinReq, TipReq
from ..realtime import manager, haversine_km, push_expo
from ..utils import now, new_id, iso, clean, gen_pin

router = APIRouter(prefix="/rides", tags=["rides"])


def calc_fare(ride_type: str, distance_km: float | None, cfg: dict) -> float:
    if ride_type == "local":
        return round(cfg["base_fare"] + cfg["per_km"] * max(distance_km or 0, 1), 2)
    if ride_type == "poochari":
        return cfg["poochari_fare"]
    if ride_type == "radhakund":
        return cfg["radhakund_fare"]
    if ride_type == "combined":
        return cfg["combined_fare"]
    raise HTTPException(400, "Unknown ride type")


async def _eligible_drivers_for_ride(ride: dict, cfg: dict) -> list[dict]:
    """Return list of online + KYC-approved drivers within dispatch radius.

    If ride has no pickup coords, fall back to all online drivers.
    """
    dispatch_radius = float(cfg.get("dispatch_radius_km", 5.0))
    cur = db.drivers.find({"online": True, "kyc_status": "approved"})
    out = []
    pk = ride.get("pickup") or {}
    pk_lat = pk.get("lat")
    pk_lng = pk.get("lng")
    async for d in cur:
        if pk_lat is None or pk_lng is None or d.get("current_lat") is None or d.get("current_lng") is None:
            out.append({"user_id": d["user_id"], "distance_km": None})
            continue
        dist = haversine_km(pk_lat, pk_lng, d["current_lat"], d["current_lng"])
        if dist <= dispatch_radius:
            out.append({"user_id": d["user_id"], "distance_km": dist})
    # Sort by distance (None last)
    out.sort(key=lambda x: (x["distance_km"] is None, x["distance_km"] or 0))
    return out


async def _push_users(user_ids: list[str], title: str, body: str, data: dict) -> None:
    if not user_ids:
        return
    docs = await db.users.find({"id": {"$in": user_ids}}).to_list(500)
    tokens = [d.get("expo_push_token") for d in docs if d.get("expo_push_token")]
    if tokens:
        await push_expo(tokens, title, body, data)


@router.post("")
async def create_ride(req: CreateRideReq, user: dict = Depends(require_role("passenger"))):
    cfg = await db.fare_config.find_one({"id": "default"}) or {}
    fare = calc_fare(req.type, req.distance_km, cfg)
    commission = round(fare * cfg["commission_pct"] / 100, 2)
    # Sticky per-passenger PIN: every ride this passenger books uses the SAME
    # PIN they were assigned on signup. Backfill if missing (legacy accounts).
    pin = user.get("ride_pin")
    if not pin:
        pin = gen_pin()
        await db.users.update_one({"id": user["id"]}, {"$set": {"ride_pin": pin}})
    scheduled_at = None
    if req.scheduled_at:
        try:
            scheduled_at = datetime.fromisoformat(req.scheduled_at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(400, "Invalid scheduled_at")

    ride = {
        "id": new_id(),
        "passenger_id": user["id"],
        "passenger_name": user.get("name") or user["phone"],
        "passenger_phone": user["phone"],
        "driver_id": None,
        "driver_name": None,
        "driver_phone": None,
        "driver_vehicle_no": None,
        "type": req.type,
        "pickup": req.pickup,
        "drop": req.drop,
        "distance_km": req.distance_km,
        "fare": fare,
        "commission": commission,
        "driver_earning": round(fare - commission, 2),
        "tip": 0.0,
        "payment_method": req.payment_method,
        "status": "scheduled" if scheduled_at else "requested",
        "pin": pin,
        "scheduled_at": scheduled_at,
        "notes": req.notes,
        "audit_log": [{"at": iso(now()), "event": "created", "by": user["id"]}],
        "created_at": now(),
        "accepted_at": None,
        "started_at": None,
        "completed_at": None,
        "cancelled_at": None,
        "cancel_reason": None,
        "cancelled_by": None,
    }
    await db.rides.insert_one(ride)

    # Live dispatch to eligible drivers if immediate (not scheduled)
    if not scheduled_at:
        eligible = await _eligible_drivers_for_ride(ride, cfg)
        driver_ids = [d["user_id"] for d in eligible]
        payload = {"type": "ride_requested", "ride": clean(ride)}
        await manager.broadcast(driver_ids, payload)
        body_txt = (
            f"New {req.type} ride • ₹{fare}"
            + (f" • {round(req.distance_km, 1)} km" if req.distance_km else "")
        )
        await _push_users(driver_ids, "New ride request", body_txt, {"ride_id": ride["id"], "type": "ride_requested"})
    return clean(ride)


@router.get("/mine")
async def my_rides(user: dict = Depends(get_current_user)):
    q = {"passenger_id": user["id"]} if user["role"] == "passenger" else {"driver_id": user["id"]}
    rides = await db.rides.find(q).sort("created_at", -1).to_list(100)
    return {"rides": [clean(r) for r in rides]}


@router.get("/{ride_id}")
async def get_ride(ride_id: str, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if user["role"] not in ("admin",) and user["id"] not in (ride.get("passenger_id"), ride.get("driver_id")):
        raise HTTPException(403, "Forbidden")
    out = clean(ride)
    if user["role"] == "driver" and ride.get("status") == "requested":
        out["pin"] = None
    # Include driver's last known location for passenger view (after accept)
    if user["role"] == "passenger" and ride.get("driver_id") and ride.get("status") in ("accepted", "started"):
        drv = await db.drivers.find_one({"user_id": ride["driver_id"]})
        if drv and drv.get("current_lat") is not None:
            out["driver_location"] = {
                "lat": drv["current_lat"],
                "lng": drv["current_lng"],
                "heading": drv.get("heading"),
                "speed": drv.get("speed"),
            }
    # Include passenger's last known location for driver view (after accept)
    if user["role"] == "driver" and ride.get("status") in ("accepted", "started"):
        if ride.get("passenger_lat") is not None:
            out["passenger_location"] = {"lat": ride["passenger_lat"], "lng": ride["passenger_lng"]}
    return out


@router.post("/{ride_id}/accept")
async def accept_ride(ride_id: str, user: dict = Depends(require_role("driver"))):
    driver = await db.drivers.find_one({"user_id": user["id"]})
    if not driver or driver.get("kyc_status") != "approved":
        raise HTTPException(403, "KYC not approved")
    ride = await db.rides.find_one({"id": ride_id, "status": "requested", "driver_id": None})
    if not ride:
        raise HTTPException(409, "Ride no longer available")
    audit = ride.get("audit_log", []) + [{"at": iso(now()), "event": "accepted", "by": user["id"]}]
    await db.rides.update_one({"id": ride_id, "driver_id": None}, {"$set": {
        "driver_id": user["id"],
        "driver_name": user.get("name") or user["phone"],
        "driver_phone": user["phone"],
        "driver_vehicle_no": driver.get("vehicle_no"),
        "status": "accepted",
        "accepted_at": now(),
        "audit_log": audit,
    }})
    fresh = await db.rides.find_one({"id": ride_id})

    # Notify passenger via WS + push
    passenger_id = fresh["passenger_id"]
    out = clean(fresh)
    await manager.send_to_user(passenger_id, {"type": "ride_accepted", "ride": out})
    await _push_users(
        [passenger_id],
        "Driver assigned 🛺",
        f"{out.get('driver_name')} is heading your way. PIN: {out.get('pin')}",
        {"ride_id": ride_id, "type": "ride_accepted"},
    )
    # Also notify other drivers that this ride is gone
    others = [d.get("user_id") async for d in db.drivers.find({"online": True, "kyc_status": "approved"})]
    others = [u for u in others if u and u != user["id"]]
    await manager.broadcast(others, {"type": "ride_taken", "ride_id": ride_id})
    return out


@router.post("/{ride_id}/verify-pin")
async def verify_pin(ride_id: str, req: VerifyPinReq, user: dict = Depends(require_role("driver"))):
    ride = await db.rides.find_one({"id": ride_id, "driver_id": user["id"]})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if ride["status"] != "accepted":
        raise HTTPException(400, f"Cannot start from status {ride['status']}")
    if req.pin != ride["pin"]:
        raise HTTPException(400, "Incorrect PIN")
    audit = ride.get("audit_log", []) + [{"at": iso(now()), "event": "started", "by": user["id"]}]
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "status": "started", "started_at": now(), "audit_log": audit,
    }})
    await manager.send_to_user(ride["passenger_id"], {"type": "ride_started", "ride_id": ride_id})
    await _push_users([ride["passenger_id"]], "Ride started 🚦", "Have a safe journey!", {"ride_id": ride_id, "type": "ride_started"})
    return {"ok": True, "status": "started"}


@router.post("/{ride_id}/complete")
async def complete_ride(ride_id: str, user: dict = Depends(require_role("driver"))):
    ride = await db.rides.find_one({"id": ride_id, "driver_id": user["id"]})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if ride["status"] != "started":
        raise HTTPException(400, f"Cannot complete from {ride['status']}")
    audit = ride.get("audit_log", []) + [{"at": iso(now()), "event": "completed", "by": user["id"]}]
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "status": "completed", "completed_at": now(), "audit_log": audit,
    }})
    await db.drivers.update_one({"user_id": user["id"]}, {"$inc": {"earnings_total": ride["driver_earning"]}})
    await manager.send_to_user(ride["passenger_id"], {"type": "ride_completed", "ride_id": ride_id, "fare": ride["fare"]})
    await _push_users(
        [ride["passenger_id"]],
        "Ride completed 🙏",
        f"Total fare ₹{ride['fare']:.0f}. Thank you for choosing TirthRide!",
        {"ride_id": ride_id, "type": "ride_completed"},
    )
    return {"ok": True, "status": "completed"}


@router.post("/{ride_id}/tip")
async def add_tip(ride_id: str, req: TipReq, user: dict = Depends(require_role("passenger"))):
    """Increase fare by a tip amount (10/20/50) to attract drivers.

    Only allowed while the ride is still in `requested` state (no driver assigned).
    Re-broadcasts the boosted ride to eligible drivers in radius so they get a
    fresh, higher-fare alert.
    """
    if req.amount not in (10, 20, 50):
        raise HTTPException(400, "Tip must be 10, 20 or 50")
    ride = await db.rides.find_one({"id": ride_id, "passenger_id": user["id"]})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if ride["status"] != "requested" or ride.get("driver_id"):
        raise HTTPException(400, "Tips can only be added while still searching for a driver")
    cfg = await db.fare_config.find_one({"id": "default"}) or {}
    tip_total = float(ride.get("tip", 0)) + float(req.amount)
    new_fare = round(float(ride["fare"]) + float(req.amount), 2)
    new_commission = round(new_fare * cfg.get("commission_pct", 10) / 100, 2)
    new_earning = round(new_fare - new_commission, 2)
    audit = ride.get("audit_log", []) + [{"at": iso(now()), "event": "tip_added", "by": user["id"], "amount": req.amount}]
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "fare": new_fare,
        "commission": new_commission,
        "driver_earning": new_earning,
        "tip": tip_total,
        "audit_log": audit,
    }})
    fresh = await db.rides.find_one({"id": ride_id})
    # Re-broadcast to eligible drivers so they see boosted fare
    eligible = await _eligible_drivers_for_ride(fresh, cfg)
    driver_ids = [d["user_id"] for d in eligible]
    payload = {"type": "ride_requested", "ride": clean(fresh), "boosted": True}
    await manager.broadcast(driver_ids, payload)
    await _push_users(
        driver_ids,
        f"₹{int(tip_total)} tip added 💰",
        f"Boosted fare ₹{new_fare:.0f} • {ride.get('type', 'ride')}",
        {"ride_id": ride_id, "type": "ride_requested"},
    )
    return clean(fresh)


@router.post("/{ride_id}/cancel")
async def cancel_ride(ride_id: str, req: CancelReq, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if user["id"] not in (ride.get("passenger_id"), ride.get("driver_id")):
        raise HTTPException(403, "Not your ride")
    if ride["status"] in ("completed", "cancelled"):
        raise HTTPException(400, f"Already {ride['status']}")
    audit = ride.get("audit_log", []) + [{
        "at": iso(now()), "event": "cancelled",
        "by": user["id"], "role": user["role"], "reason": req.reason
    }]
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "status": "cancelled", "cancelled_at": now(),
        "cancel_reason": req.reason, "cancelled_by": user["role"],
        "audit_log": audit,
    }})
    # Notify the other party
    other_id = ride.get("driver_id") if user["role"] == "passenger" else ride.get("passenger_id")
    if other_id:
        await manager.send_to_user(other_id, {
            "type": "ride_cancelled", "ride_id": ride_id, "by": user["role"], "reason": req.reason
        })
        await _push_users(
            [other_id],
            "Ride cancelled",
            f"Cancelled by {user['role']}: {req.reason}",
            {"ride_id": ride_id, "type": "ride_cancelled"},
        )
    return {"ok": True}
