"""Dharamshala / Guest-house stay discovery.

Pilgrim-facing endpoints are public (read-only, verified listings only) and
mirror the lightweight "discovery + inquiry" model: browse, filter, then
Call / WhatsApp / get directions. Listings are created and verified by admins
(same trust model as landmarks and driver KYC).
"""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query

from ..db import db
from ..deps import require_role
from ..models import StayReq, StayUpdateReq, AMENITY_KEYS
from ..realtime import haversine_km
from ..utils import now, new_id, clean

router = APIRouter(prefix="/stays", tags=["stays"])
admin_router = APIRouter(prefix="/admin/stays", tags=["admin", "stays"])


def _with_distance(stay: dict, lat: Optional[float], lng: Optional[float]) -> dict:
    out = clean(stay)
    if lat is not None and lng is not None and stay.get("lat") is not None and stay.get("lng") is not None:
        out["distance_km"] = round(haversine_km(lat, lng, stay["lat"], stay["lng"]), 2)
    return out


# ---------- Public (pilgrim) ----------
@router.get("")
async def list_stays(
    type: Optional[str] = None,
    amenity: Optional[str] = Query(None, description="comma-separated amenity keys; all must be present"),
    q: Optional[str] = Query(None, description="search name / area / address"),
    max_price: Optional[float] = None,
    available_only: bool = False,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
):
    """Verified listings only. Sorted by proximity when lat/lng given, else
    featured-first then newest."""
    query: dict = {"verified": True}
    if type:
        query["type"] = type
    if available_only:
        query["available"] = True
    if amenity:
        keys = [a.strip() for a in amenity.split(",") if a.strip()]
        if keys:
            query["amenities"] = {"$all": keys}
    if max_price is not None:
        # include donation-based (no price) and anything whose min is within budget
        query["$or"] = [{"donation_based": True}, {"price_min": {"$lte": max_price}}]
    if q:
        rx = {"$regex": q, "$options": "i"}
        query.setdefault("$and", []).append({"$or": [{"name": rx}, {"area": rx}, {"address": rx}]})

    stays = await db.stays.find(query).to_list(500)
    out = [_with_distance(s, lat, lng) for s in stays]
    if lat is not None and lng is not None:
        out.sort(key=lambda s: (s.get("distance_km") is None, s.get("distance_km") or 0))
    else:
        # featured first, then newest. Stable sort: newest first, then featured.
        out.sort(key=lambda s: s.get("created_at") or "", reverse=True)
        out.sort(key=lambda s: not s.get("featured", False))
    return {"stays": out, "count": len(out)}


@router.get("/{stay_id}")
async def get_stay(stay_id: str, lat: Optional[float] = None, lng: Optional[float] = None):
    stay = await db.stays.find_one({"id": stay_id, "verified": True})
    if not stay:
        raise HTTPException(404, "Stay not found")
    return _with_distance(stay, lat, lng)


# ---------- Admin (manage) ----------
def _validate_amenities(amenities: Optional[List[str]]) -> Optional[List[str]]:
    if amenities is None:
        return None
    bad = [a for a in amenities if a not in AMENITY_KEYS]
    if bad:
        raise HTTPException(400, f"Unknown amenities: {', '.join(bad)}")
    return amenities


@admin_router.get("")
async def admin_list_stays(
    verified: Optional[bool] = None,
    _: dict = Depends(require_role("admin")),
):
    query: dict = {}
    if verified is not None:
        query["verified"] = verified
    stays = await db.stays.find(query).sort("created_at", -1).to_list(500)
    return {"stays": [clean(s) for s in stays]}


@admin_router.post("")
async def admin_create_stay(req: StayReq, _: dict = Depends(require_role("admin"))):
    _validate_amenities(req.amenities)
    ts = now()
    doc = req.model_dump()
    doc["id"] = new_id()
    doc["whatsapp"] = doc.get("whatsapp") or doc.get("contact_phone")
    doc["created_at"] = ts
    doc["updated_at"] = ts
    await db.stays.insert_one(doc)
    return clean(doc)


@admin_router.patch("/{stay_id}")
async def admin_update_stay(stay_id: str, req: StayUpdateReq, _: dict = Depends(require_role("admin"))):
    updates = {k: v for k, v in req.model_dump(exclude_unset=True).items()}
    if "amenities" in updates:
        _validate_amenities(updates["amenities"])
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updated_at"] = now()
    res = await db.stays.update_one({"id": stay_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Stay not found")
    fresh = await db.stays.find_one({"id": stay_id})
    return clean(fresh)


@admin_router.delete("/{stay_id}")
async def admin_delete_stay(stay_id: str, _: dict = Depends(require_role("admin"))):
    res = await db.stays.delete_one({"id": stay_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Stay not found")
    return {"ok": True}
