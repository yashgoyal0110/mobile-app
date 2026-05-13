"""Fare suggestion routes (driver community + admin apply)."""
from fastapi import APIRouter, HTTPException, Depends

from ..db import db
from ..deps import get_current_user, require_role
from ..models import SuggestFareReq, VoteReq
from ..utils import now, new_id, clean

router = APIRouter(prefix="/suggestions", tags=["suggestions"])


@router.post("")
async def create_suggestion(req: SuggestFareReq, user: dict = Depends(require_role("driver"))):
    s = {
        "id": new_id(),
        "driver_id": user["id"],
        "driver_name": user.get("name") or user["phone"],
        "ride_type": req.ride_type,
        "amount": req.amount,
        "note": req.note,
        "votes_up": 0,
        "votes_down": 0,
        "voters": [],
        "status": "open",
        "created_at": now(),
    }
    await db.fare_suggestions.insert_one(s)
    return clean(s)


@router.get("")
async def list_suggestions(user: dict = Depends(get_current_user)):
    s = await db.fare_suggestions.find({"status": "open"}).sort("created_at", -1).to_list(50)
    return {"suggestions": [clean(x) for x in s]}


@router.post("/{sid}/vote")
async def vote_suggestion(sid: str, req: VoteReq, user: dict = Depends(require_role("driver"))):
    s = await db.fare_suggestions.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Not found")
    if user["id"] in s.get("voters", []):
        raise HTTPException(400, "Already voted")
    inc = {"votes_up": 1} if req.vote == "up" else {"votes_down": 1}
    await db.fare_suggestions.update_one(
        {"id": sid}, {"$inc": inc, "$push": {"voters": user["id"]}}
    )
    return {"ok": True}
