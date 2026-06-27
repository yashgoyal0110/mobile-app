"""Temple darshan info — timings, aarti, and (optional) crowd level.

Pilgrim-facing endpoints are public (read-only, verified temples only). Admins
create/verify temples and may update the crowd level through the day. Open/closed
status is computed on the client from `darshan_slots` (IST), so this stays clock-
and timezone-agnostic on the server.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends

from ..db import db
from ..deps import require_role
from ..models import TempleReq, TempleUpdateReq
from ..realtime import haversine_km
from ..utils import now, new_id, clean

router = APIRouter(prefix="/temples", tags=["temples"])
admin_router = APIRouter(prefix="/admin/temples", tags=["admin", "temples"])


def _with_distance(t: dict, lat: Optional[float], lng: Optional[float]) -> dict:
    out = clean(t)
    if lat is not None and lng is not None and t.get("lat") is not None and t.get("lng") is not None:
        out["distance_km"] = round(haversine_km(lat, lng, t["lat"], t["lng"]), 2)
    return out


# ---------- Public (pilgrim) ----------
@router.get("")
async def list_temples(
    q: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
):
    query: dict = {"verified": True}
    if q:
        rx = {"$regex": q, "$options": "i"}
        query["$or"] = [{"name": rx}, {"area": rx}, {"deity": rx}, {"address": rx}]
    temples = await db.temples.find(query).to_list(500)
    out = [_with_distance(t, lat, lng) for t in temples]
    if lat is not None and lng is not None:
        out.sort(key=lambda t: (t.get("distance_km") is None, t.get("distance_km") or 0))
    else:
        out.sort(key=lambda t: t.get("created_at") or "", reverse=True)
        out.sort(key=lambda t: not t.get("featured", False))
    return {"temples": out, "count": len(out)}


@router.get("/{temple_id}")
async def get_temple(temple_id: str, lat: Optional[float] = None, lng: Optional[float] = None):
    t = await db.temples.find_one({"id": temple_id, "verified": True})
    if not t:
        raise HTTPException(404, "Temple not found")
    return _with_distance(t, lat, lng)


# ---------- Admin (manage) ----------
@admin_router.get("")
async def admin_list_temples(verified: Optional[bool] = None, _: dict = Depends(require_role("admin"))):
    query: dict = {}
    if verified is not None:
        query["verified"] = verified
    temples = await db.temples.find(query).sort("created_at", -1).to_list(500)
    return {"temples": [clean(t) for t in temples]}


@admin_router.post("")
async def admin_create_temple(req: TempleReq, _: dict = Depends(require_role("admin"))):
    ts = now()
    doc = req.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = ts
    doc["updated_at"] = ts
    doc["crowd_updated_at"] = ts if doc.get("crowd_level") else None
    await db.temples.insert_one(doc)
    return clean(doc)


@admin_router.patch("/{temple_id}")
async def admin_update_temple(temple_id: str, req: TempleUpdateReq, _: dict = Depends(require_role("admin"))):
    updates = {k: v for k, v in req.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    if "crowd_level" in updates:
        updates["crowd_updated_at"] = now() if updates["crowd_level"] else None
    updates["updated_at"] = now()
    res = await db.temples.update_one({"id": temple_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Temple not found")
    fresh = await db.temples.find_one({"id": temple_id})
    return clean(fresh)


@admin_router.delete("/{temple_id}")
async def admin_delete_temple(temple_id: str, _: dict = Depends(require_role("admin"))):
    res = await db.temples.delete_one({"id": temple_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Temple not found")
    return {"ok": True}
