"""Admin routes (dashboard, fares, drivers, audit, landmarks)."""
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from ..db import db
from ..deps import require_role
from ..models import LandmarkReq, LandmarkUpdateReq
from ..utils import now, new_id, clean

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------- Fare / config ----------
ALLOWED_CFG_FIELDS = {
    "base_fare", "per_km", "poochari_fare", "radhakund_fare", "combined_fare",
    "commission_pct", "cancellation_fee", "boundary_radius_km",
    "dispatch_radius_km", "surge_pct",
    "landmarks", "city_center", "support_phone", "support_email",
    "region_bbox",
}


@router.patch("/config/fare")
async def update_fare_config(payload: Dict[str, Any], _: dict = Depends(require_role("admin"))):
    updates = {k: v for k, v in payload.items() if k in ALLOWED_CFG_FIELDS}
    updates["updated_at"] = now()
    await db.fare_config.update_one({"id": "default"}, {"$set": updates})
    cfg = await db.fare_config.find_one({"id": "default"})
    return clean(cfg)


# ---------- Landmarks CRUD ----------
@router.get("/landmarks")
async def list_landmarks(_: dict = Depends(require_role("admin"))):
    cfg = await db.fare_config.find_one({"id": "default"})
    return {"landmarks": (cfg or {}).get("landmarks", [])}


@router.post("/landmarks")
async def add_landmark(req: LandmarkReq, _: dict = Depends(require_role("admin"))):
    cfg = await db.fare_config.find_one({"id": "default"})
    landmarks = (cfg or {}).get("landmarks", [])
    new_lm = {"id": new_id(), "name": req.name, "lat": req.lat, "lng": req.lng}
    landmarks.append(new_lm)
    await db.fare_config.update_one({"id": "default"}, {"$set": {"landmarks": landmarks, "updated_at": now()}})
    return new_lm


@router.patch("/landmarks/{lid}")
async def update_landmark(lid: str, req: LandmarkUpdateReq, _: dict = Depends(require_role("admin"))):
    cfg = await db.fare_config.find_one({"id": "default"})
    landmarks = (cfg or {}).get("landmarks", [])
    found = False
    for lm in landmarks:
        if lm.get("id") == lid:
            if req.name is not None:
                lm["name"] = req.name
            if req.lat is not None:
                lm["lat"] = req.lat
            if req.lng is not None:
                lm["lng"] = req.lng
            found = True
            break
    if not found:
        raise HTTPException(404, "Landmark not found")
    await db.fare_config.update_one({"id": "default"}, {"$set": {"landmarks": landmarks, "updated_at": now()}})
    return {"ok": True}


@router.delete("/landmarks/{lid}")
async def delete_landmark(lid: str, _: dict = Depends(require_role("admin"))):
    cfg = await db.fare_config.find_one({"id": "default"})
    landmarks = [lm for lm in (cfg or {}).get("landmarks", []) if lm.get("id") != lid]
    await db.fare_config.update_one({"id": "default"}, {"$set": {"landmarks": landmarks, "updated_at": now()}})
    return {"ok": True}


# ---------- Drivers ----------
@router.get("/drivers")
async def admin_list_drivers(status_filter: Optional[str] = None, _: dict = Depends(require_role("admin"))):
    q = {}
    if status_filter:
        q["kyc_status"] = status_filter
    drivers = await db.drivers.find(q).sort("created_at", -1).to_list(100)
    out = []
    for d in drivers:
        u = await db.users.find_one({"id": d["user_id"]})
        item = clean(d)
        item["user"] = clean(u) if u else None
        out.append(item)
    return {"drivers": out}


@router.post("/drivers/{driver_user_id}/approve")
async def approve_driver(driver_user_id: str, _: dict = Depends(require_role("admin"))):
    res = await db.drivers.update_one(
        {"user_id": driver_user_id},
        {"$set": {"kyc_status": "approved", "approved_at": now()}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Driver not found")
    return {"ok": True}


@router.post("/drivers/{driver_user_id}/reject")
async def reject_driver(driver_user_id: str, body: Dict[str, Any] = None, _: dict = Depends(require_role("admin"))):
    reason = (body or {}).get("reason", "Documents not verified")
    res = await db.drivers.update_one(
        {"user_id": driver_user_id},
        {"$set": {"kyc_status": "rejected", "rejection_reason": reason, "online": False}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Driver not found")
    return {"ok": True}


# ---------- Audit / dashboard ----------
@router.get("/audit/rides")
async def audit_rides(_: dict = Depends(require_role("admin")),
                      status_filter: Optional[str] = None,
                      limit: int = 100):
    q = {}
    if status_filter:
        q["status"] = status_filter
    rides = await db.rides.find(q).sort("created_at", -1).to_list(limit)
    return {"rides": [clean(r) for r in rides]}


@router.get("/dashboard")
async def admin_dashboard(_: dict = Depends(require_role("admin"))):
    today_start = datetime.combine(now().date(), datetime.min.time(), tzinfo=timezone.utc)
    total_rides = await db.rides.count_documents({})
    rides_today = await db.rides.count_documents({"created_at": {"$gte": today_start}})
    active_drivers = await db.drivers.count_documents({"online": True, "kyc_status": "approved"})
    pending_approvals = await db.drivers.count_documents({"kyc_status": "pending"})
    completed = await db.rides.find({"status": "completed"}).to_list(10000)
    revenue = sum(r.get("commission", 0) for r in completed)
    total_fare = sum(r.get("fare", 0) for r in completed)
    return {
        "total_rides": total_rides,
        "rides_today": rides_today,
        "active_drivers": active_drivers,
        "pending_approvals": pending_approvals,
        "platform_revenue": round(revenue, 2),
        "total_fare_processed": round(total_fare, 2),
    }


# ---------- Withdrawals ----------
@router.get("/withdrawals")
async def list_withdrawals(_: dict = Depends(require_role("admin"))):
    w = await db.withdrawals.find().sort("requested_at", -1).to_list(100)
    return {"withdrawals": [clean(x) for x in w]}


@router.post("/withdrawals/{wid}/mark-paid")
async def mark_withdrawal_paid(wid: str, _: dict = Depends(require_role("admin"))):
    await db.withdrawals.update_one({"id": wid}, {"$set": {"status": "paid", "paid_at": now()}})
    return {"ok": True}


# ---------- Apply driver suggestion ----------
@router.post("/suggestions/{sid}/apply")
async def apply_suggestion(sid: str, _: dict = Depends(require_role("admin"))):
    s = await db.fare_suggestions.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Not found")
    rt = s["ride_type"]
    field_map = {
        "local-base": "base_fare", "local-per-km": "per_km",
        "poochari": "poochari_fare", "radhakund": "radhakund_fare", "combined": "combined_fare",
    }
    field = field_map.get(rt)
    if not field:
        raise HTTPException(400, "Unknown ride_type")
    await db.fare_config.update_one({"id": "default"}, {"$set": {field: s["amount"], "updated_at": now()}})
    await db.fare_suggestions.update_one({"id": sid}, {"$set": {"status": "applied"}})
    return {"ok": True}
