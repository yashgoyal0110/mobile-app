"""Ratings & complaints routes.

Both passenger and driver can rate each other after a ride is completed.
Both can also file a complaint (with or without a rating). Admin can view
all complaints and mark them resolved.
"""
from fastapi import APIRouter, HTTPException, Depends

from ..db import db
from ..deps import get_current_user, require_role
from ..models import RateRideReq, ComplaintReq, ResolveComplaintReq
from ..utils import now, new_id, clean

router = APIRouter(tags=["ratings"])


async def _recompute_avg_for_user(user_id: str) -> None:
    pipeline = [
        {"$match": {"target_user_id": user_id}},
        {"$group": {"_id": "$target_user_id", "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]
    cursor = db.ratings.aggregate(pipeline)
    row = None
    async for r in cursor:
        row = r
        break
    avg = round(row["avg"], 2) if row else None
    count = row["count"] if row else 0
    await db.users.update_one({"id": user_id}, {"$set": {"avg_rating": avg, "total_ratings": count}})
    await db.drivers.update_one({"user_id": user_id}, {"$set": {"avg_rating": avg, "total_ratings": count}})


@router.post("/rides/{ride_id}/rate")
async def rate_ride(ride_id: str, req: RateRideReq, user: dict = Depends(get_current_user)):
    if req.stars < 1 or req.stars > 5:
        raise HTTPException(400, "Stars must be 1-5")
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if user["id"] not in (ride.get("passenger_id"), ride.get("driver_id")):
        raise HTTPException(403, "Not your ride")
    if ride.get("status") != "completed":
        raise HTTPException(400, "Can only rate a completed ride")

    # Determine target: opposite party
    by_role = user["role"]
    if user["id"] == ride.get("passenger_id"):
        target_user_id = ride.get("driver_id")
        target_role = "driver"
    else:
        target_user_id = ride.get("passenger_id")
        target_role = "passenger"
    if not target_user_id:
        raise HTTPException(400, "Other party not assigned")

    # Idempotent: replace if already rated by this user for this ride
    existing = await db.ratings.find_one({"ride_id": ride_id, "by_user_id": user["id"]})
    payload = {
        "ride_id": ride_id,
        "by_user_id": user["id"],
        "by_role": by_role,
        "target_user_id": target_user_id,
        "target_role": target_role,
        "stars": req.stars,
        "comment": (req.comment or "").strip() or None,
        "created_at": now(),
    }
    if existing:
        await db.ratings.update_one({"id": existing["id"]}, {"$set": payload})
        rating = await db.ratings.find_one({"id": existing["id"]})
    else:
        payload["id"] = new_id()
        await db.ratings.insert_one(payload)
        rating = payload

    await _recompute_avg_for_user(target_user_id)
    return clean(rating)


@router.get("/rides/{ride_id}/ratings")
async def list_ride_ratings(ride_id: str, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if user["role"] != "admin" and user["id"] not in (ride.get("passenger_id"), ride.get("driver_id")):
        raise HTTPException(403, "Not your ride")
    rs = await db.ratings.find({"ride_id": ride_id}).to_list(10)
    return {"ratings": [clean(r) for r in rs]}


@router.post("/rides/{ride_id}/complaint")
async def file_complaint(ride_id: str, req: ComplaintReq, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if user["id"] not in (ride.get("passenger_id"), ride.get("driver_id")):
        raise HTTPException(403, "Not your ride")

    against = req.against
    if not against:
        against = "driver" if user["role"] == "passenger" else "passenger"
    against_user_id = ride.get("driver_id" if against == "driver" else "passenger_id")

    c = {
        "id": new_id(),
        "ride_id": ride_id,
        "by_user_id": user["id"],
        "by_role": user["role"],
        "against": against,
        "against_user_id": against_user_id,
        "category": req.category,
        "description": req.description.strip(),
        "status": "open",
        "resolution": None,
        "created_at": now(),
        "resolved_at": None,
        "resolved_by": None,
    }
    await db.complaints.insert_one(c)
    return clean(c)


# --- User-facing rating summary ---
@router.get("/users/{user_id}/rating")
async def user_rating(user_id: str, user: dict = Depends(get_current_user)):
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    return {
        "user_id": user_id,
        "avg_rating": target.get("avg_rating"),
        "total_ratings": target.get("total_ratings", 0),
    }


# --- Admin: complaints management ---
admin_router = APIRouter(prefix="/admin", tags=["admin-complaints"])


@admin_router.get("/complaints")
async def list_complaints(_: dict = Depends(require_role("admin")), status_filter: str = "open"):
    q = {} if status_filter == "all" else {"status": status_filter}
    rows = await db.complaints.find(q).sort("created_at", -1).to_list(200)
    out = []
    for c in rows:
        item = clean(c)
        # Join with ride + parties for context
        ride = await db.rides.find_one({"id": c.get("ride_id")})
        if ride:
            item["ride"] = {
                "id": ride["id"],
                "type": ride.get("type"),
                "fare": ride.get("fare"),
                "passenger_name": ride.get("passenger_name"),
                "driver_name": ride.get("driver_name"),
                "status": ride.get("status"),
            }
        out.append(item)
    return {"complaints": out}


@admin_router.patch("/complaints/{cid}")
async def resolve_complaint(cid: str, req: ResolveComplaintReq, user: dict = Depends(require_role("admin"))):
    res = await db.complaints.update_one(
        {"id": cid},
        {"$set": {
            "status": req.status,
            "resolution": req.resolution,
            "resolved_at": now(),
            "resolved_by": user["id"],
        }}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Complaint not found")
    return {"ok": True}
