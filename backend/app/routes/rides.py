"""Ride routes."""
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends

from ..db import db
from ..deps import get_current_user, require_role
from ..models import CreateRideReq, CancelReq, VerifyPinReq
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


@router.post("")
async def create_ride(req: CreateRideReq, user: dict = Depends(require_role("passenger"))):
    cfg = await db.fare_config.find_one({"id": "default"})
    fare = calc_fare(req.type, req.distance_km, cfg)
    commission = round(fare * cfg["commission_pct"] / 100, 2)
    pin = gen_pin()
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
    return clean(fresh)


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
    return {"ok": True, "status": "completed"}


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
    return {"ok": True}
