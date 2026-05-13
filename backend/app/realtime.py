"""WebSocket realtime connection manager + event broadcasting.

Maintains a set of WebSocket connections keyed by user_id. Each ride
lifecycle event publishes a payload to the relevant users (passenger
and assigned driver) as well as the broader "drivers_pool" channel when
a new ride is requested.

Also pushes to mobile devices via Expo's free push service for users that
have registered a push token (works when app is backgrounded/killed).
"""
from __future__ import annotations
import asyncio
import logging
import math
from typing import Any, Dict, List, Optional, Set

import httpx
from fastapi import WebSocket

logger = logging.getLogger("tirthride.realtime")
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class ConnectionManager:
    """Holds open WS connections per user_id."""

    def __init__(self) -> None:
        # user_id -> set of WebSocket
        self._conns: Dict[str, Set[WebSocket]] = {}
        # online drivers' ids (kyc_approved && online toggled on)
        self._online_drivers: Set[str] = set()
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._conns.setdefault(user_id, set()).add(ws)

    async def disconnect(self, user_id: str, ws: WebSocket) -> None:
        async with self._lock:
            if user_id in self._conns:
                self._conns[user_id].discard(ws)
                if not self._conns[user_id]:
                    self._conns.pop(user_id, None)

    def is_connected(self, user_id: str) -> bool:
        return user_id in self._conns

    async def send_to_user(self, user_id: str, payload: Any) -> None:
        sockets = list(self._conns.get(user_id, set()))
        for ws in sockets:
            try:
                await ws.send_json(payload)
            except Exception as e:
                logger.warning(f"WS send to {user_id} failed: {e}")
                await self.disconnect(user_id, ws)

    async def broadcast(self, user_ids: List[str], payload: Any) -> None:
        await asyncio.gather(*[self.send_to_user(uid, payload) for uid in user_ids])

    def mark_online(self, driver_user_id: str) -> None:
        self._online_drivers.add(driver_user_id)

    def mark_offline(self, driver_user_id: str) -> None:
        self._online_drivers.discard(driver_user_id)

    def online_drivers(self) -> Set[str]:
        return set(self._online_drivers)


manager = ConnectionManager()


def haversine_km(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    R = 6371.0
    dLat = math.radians(b_lat - a_lat)
    dLon = math.radians(b_lng - a_lng)
    la1 = math.radians(a_lat)
    la2 = math.radians(b_lat)
    x = math.sin(dLat / 2) ** 2 + math.sin(dLon / 2) ** 2 * math.cos(la1) * math.cos(la2)
    return 2 * R * math.asin(math.sqrt(x))


async def push_expo(tokens: List[str], title: str, body: str, data: Optional[Dict[str, Any]] = None) -> None:
    """Send a batch push notification via Expo. Free service, no API key."""
    tokens = [t for t in tokens if t and t.startswith("ExponentPushToken")]
    if not tokens:
        return
    messages = [
        {
            "to": t,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
            "priority": "high",
            "channelId": "default",
        }
        for t in tokens
    ]
    try:
        async with httpx.AsyncClient(timeout=10.0) as cli:
            r = await cli.post(EXPO_PUSH_URL, json=messages, headers={"Accept": "application/json"})
            if r.status_code >= 300:
                logger.warning(f"Expo push non-2xx: {r.status_code} {r.text[:200]}")
    except Exception as e:
        logger.warning(f"Expo push failed: {e}")
