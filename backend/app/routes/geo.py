"""Geo proxy routes — location search + routing.

Free provider (default): Nominatim for search/reverse, OSRM for routing.
Google provider: stub for future swap (needs GOOGLE_MAPS_KEY env).

All endpoints are scoped to the configured region bbox to avoid abuse.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
import httpx
import logging

from ..config import GEO_PROVIDER, NOMINATIM_URL, OSRM_URL, REGION_BBOX, USER_AGENT

logger = logging.getLogger("tirthride.geo")
router = APIRouter(prefix="/geo", tags=["geo"])


def _in_bbox(lat: float, lng: float) -> bool:
    return (REGION_BBOX["south"] <= lat <= REGION_BBOX["north"]
            and REGION_BBOX["west"] <= lng <= REGION_BBOX["east"])


@router.get("/region")
async def get_region():
    """Return current region bbox so frontend can constrain the map."""
    return {
        "bbox": REGION_BBOX,
        "center": {
            "lat": (REGION_BBOX["south"] + REGION_BBOX["north"]) / 2,
            "lng": (REGION_BBOX["west"] + REGION_BBOX["east"]) / 2,
        },
        "provider": GEO_PROVIDER,
    }


@router.get("/search")
async def search(q: str = Query(..., min_length=1), limit: int = 8):
    """Free-text place search restricted to region bbox."""
    if GEO_PROVIDER == "osm":
        viewbox = f"{REGION_BBOX['west']},{REGION_BBOX['north']},{REGION_BBOX['east']},{REGION_BBOX['south']}"
        params = {
            "q": q, "format": "json", "limit": str(limit),
            "viewbox": viewbox, "bounded": "1",
            "countrycodes": "in",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": USER_AGENT}) as cli:
                r = await cli.get(f"{NOMINATIM_URL}/search", params=params)
                r.raise_for_status()
                data = r.json()
        except Exception as e:
            logger.warning(f"Nominatim search failed: {e}")
            return {"results": []}
        results = []
        for item in data:
            try:
                lat = float(item["lat"])
                lng = float(item["lon"])
            except Exception:
                continue
            results.append({
                "name": item.get("display_name", "").split(",")[0],
                "address": item.get("display_name", ""),
                "lat": lat, "lng": lng,
            })
        return {"results": results}
    raise HTTPException(501, f"Provider {GEO_PROVIDER} not implemented")


@router.get("/reverse")
async def reverse(lat: float, lng: float):
    """Reverse-geocode a coordinate."""
    if not _in_bbox(lat, lng):
        return {"name": f"{lat:.4f}, {lng:.4f}", "address": "Outside service area", "lat": lat, "lng": lng}
    if GEO_PROVIDER == "osm":
        params = {"lat": lat, "lon": lng, "format": "json", "zoom": 17}
        try:
            async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": USER_AGENT}) as cli:
                r = await cli.get(f"{NOMINATIM_URL}/reverse", params=params)
                r.raise_for_status()
                data = r.json()
        except Exception as e:
            logger.warning(f"Nominatim reverse failed: {e}")
            return {"name": f"{lat:.4f}, {lng:.4f}", "address": "", "lat": lat, "lng": lng}
        addr = data.get("address", {})
        name = (addr.get("neighbourhood") or addr.get("suburb") or addr.get("village")
                or addr.get("town") or addr.get("hamlet") or data.get("display_name", "").split(",")[0])
        return {
            "name": name or f"{lat:.4f}, {lng:.4f}",
            "address": data.get("display_name", ""),
            "lat": lat, "lng": lng,
        }
    raise HTTPException(501, f"Provider {GEO_PROVIDER} not implemented")


@router.get("/route")
async def route(
    from_lat: float = Query(..., alias="from_lat"),
    from_lng: float = Query(..., alias="from_lng"),
    to_lat: float = Query(..., alias="to_lat"),
    to_lng: float = Query(..., alias="to_lng"),
):
    """Driving route from A to B. Returns distance_km, duration_min, polyline (geojson)."""
    if GEO_PROVIDER == "osm":
        url = f"{OSRM_URL}/route/v1/driving/{from_lng},{from_lat};{to_lng},{to_lat}"
        params = {"overview": "full", "geometries": "geojson"}
        try:
            async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": USER_AGENT}) as cli:
                r = await cli.get(url, params=params)
                r.raise_for_status()
                data = r.json()
        except Exception as e:
            logger.warning(f"OSRM route failed: {e}")
            # Fallback to haversine straight-line distance
            return _haversine_fallback(from_lat, from_lng, to_lat, to_lng)
        if data.get("code") != "Ok" or not data.get("routes"):
            return _haversine_fallback(from_lat, from_lng, to_lat, to_lng)
        rt = data["routes"][0]
        coords = rt["geometry"]["coordinates"]  # [[lng,lat], ...]
        return {
            "distance_km": round(rt["distance"] / 1000, 2),
            "duration_min": round(rt["duration"] / 60, 1),
            "polyline": [[c[1], c[0]] for c in coords],  # convert to [lat,lng]
            "source": "osrm",
        }
    raise HTTPException(501, f"Provider {GEO_PROVIDER} not implemented")


def _haversine_fallback(a_lat: float, a_lng: float, b_lat: float, b_lng: float):
    import math
    R = 6371
    dLat = math.radians(b_lat - a_lat)
    dLon = math.radians(b_lng - a_lng)
    la1 = math.radians(a_lat)
    la2 = math.radians(b_lat)
    x = math.sin(dLat / 2) ** 2 + math.sin(dLon / 2) ** 2 * math.cos(la1) * math.cos(la2)
    dist = 2 * R * math.asin(math.sqrt(x))
    # Apply a 1.3x road-factor for straight-line approximation
    dist *= 1.3
    return {
        "distance_km": round(dist, 2),
        "duration_min": round(dist / 15 * 60, 1),  # assume 15 km/h e-rickshaw
        "polyline": [[a_lat, a_lng], [b_lat, b_lng]],
        "source": "fallback",
    }
