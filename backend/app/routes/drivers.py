"""Driver routes."""
from fastapi import APIRouter, HTTPException, Depends

from ..db import db
from ..deps import require_role
from ..models import KycReq, OnlineReq, WithdrawReq
from ..utils import now, new_id, clean

router = APIRouter(prefix="/drivers", tags=["drivers"])


@router.post("/kyc")
async def submit_kyc(req: KycReq, user: dict = Depends(require_role("driver"))):
    driver = await db.drivers.find_one({"user_id": user["id"]})
    if not driver:
        raise HTTPException(404, "Driver record missing")
    updates = req.model_dump()
    updates["kyc_status"] = "pending"
    updates["submitted_at"] = now()
    await db.drivers.update_one({"user_id": user["id"]}, {"$set": updates})
    if req.name:
        await db.users.update_one({"id": user["id"]}, {"$set": {"name": req.name}})
    fresh = await db.drivers.find_one({"user_id": user["id"]})
    return clean(fresh)


@router.post("/online")
async def set_online(req: OnlineReq, user: dict = Depends(require_role("driver"))):
    driver = await db.drivers.find_one({"user_id": user["id"]})
    if not driver:
        raise HTTPException(404, "Driver record missing")
    if req.online and driver.get("kyc_status") != "approved":
        raise HTTPException(403, "Complete KYC and get admin approval to go online")
    await db.drivers.update_one({"user_id": user["id"]}, {"$set": {"online": req.online, "last_seen_at": now()}})
    return {"online": req.online}


@router.get("/incoming-rides")
async def incoming_rides(user: dict = Depends(require_role("driver"))):
    driver = await db.drivers.find_one({"user_id": user["id"]})
    if not driver or not driver.get("online") or driver.get("kyc_status") != "approved":
        return {"rides": []}
    rides = await db.rides.find({"status": "requested", "driver_id": None}).sort("created_at", -1).to_list(20)
    return {"rides": [clean(r) for r in rides]}


@router.get("/earnings")
async def driver_earnings(user: dict = Depends(require_role("driver"))):
    driver = await db.drivers.find_one({"user_id": user["id"]})
    if not driver:
        raise HTTPException(404, "Driver not found")
    balance = (driver.get("earnings_total") or 0) - (driver.get("earnings_withdrawn") or 0)
    rides = await db.rides.find({"driver_id": user["id"], "status": "completed"}).sort("completed_at", -1).to_list(50)
    return {
        "total": driver.get("earnings_total", 0),
        "withdrawn": driver.get("earnings_withdrawn", 0),
        "balance": balance,
        "completed_rides": [clean(r) for r in rides],
    }


@router.post("/withdraw")
async def withdraw(req: WithdrawReq, user: dict = Depends(require_role("driver"))):
    driver = await db.drivers.find_one({"user_id": user["id"]})
    if not driver:
        raise HTTPException(404, "Driver not found")
    balance = (driver.get("earnings_total") or 0) - (driver.get("earnings_withdrawn") or 0)
    if req.amount <= 0 or req.amount > balance:
        raise HTTPException(400, f"Amount must be between 0 and {balance}")
    w = {
        "id": new_id(),
        "driver_id": user["id"],
        "amount": req.amount,
        "upi_id": driver.get("upi_id"),
        "status": "requested",
        "requested_at": now(),
    }
    await db.withdrawals.insert_one(w)
    await db.drivers.update_one({"user_id": user["id"]}, {"$inc": {"earnings_withdrawn": req.amount}})
    return clean(w)
