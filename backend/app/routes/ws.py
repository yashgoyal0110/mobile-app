"""WebSocket realtime endpoint.

Authenticates via JWT passed as ?token=... query parameter (browsers can't
set custom headers on the initial WS handshake reliably). Once connected,
the user is registered in the ConnectionManager and the server pushes
JSON events for any relevant ride lifecycle changes.

Client can also send a `ping` to keep the connection alive, or `location`
updates which are persisted and forwarded to the other party on an active
ride.
"""
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError

from ..config import JWT_SECRET, JWT_ALG
from ..db import db
from ..realtime import manager

logger = logging.getLogger("tirthride.ws")
router = APIRouter()


@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        await websocket.close(code=4401)
        return
    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4401)
        return
    user = await db.users.find_one({"id": user_id})
    if not user:
        await websocket.close(code=4404)
        return

    await manager.connect(user_id, websocket)
    # Greeting
    await manager.send_to_user(user_id, {"type": "hello", "user_id": user_id, "role": user.get("role")})
    try:
        while True:
            msg = await websocket.receive_json()
            mtype = msg.get("type")
            if mtype == "ping":
                await websocket.send_json({"type": "pong"})
            elif mtype == "location":
                lat = msg.get("lat")
                lng = msg.get("lng")
                if not (isinstance(lat, (int, float)) and isinstance(lng, (int, float))):
                    continue
                heading = msg.get("heading")
                speed = msg.get("speed")
                role = user.get("role")
                if role == "driver":
                    await db.drivers.update_one(
                        {"user_id": user_id},
                        {"$set": {
                            "current_lat": lat,
                            "current_lng": lng,
                            "heading": heading,
                            "speed": speed,
                        }}
                    )
                    active = await db.rides.find_one({
                        "driver_id": user_id,
                        "status": {"$in": ["accepted", "started"]}
                    })
                    if active and active.get("passenger_id"):
                        await manager.send_to_user(active["passenger_id"], {
                            "type": "driver_location",
                            "ride_id": active["id"],
                            "lat": lat,
                            "lng": lng,
                            "heading": heading,
                            "speed": speed,
                        })
                elif role == "passenger":
                    active = await db.rides.find_one({
                        "passenger_id": user_id,
                        "status": {"$in": ["accepted", "started"]}
                    })
                    if active and active.get("driver_id"):
                        await db.rides.update_one(
                            {"id": active["id"]},
                            {"$set": {"passenger_lat": lat, "passenger_lng": lng}}
                        )
                        await manager.send_to_user(active["driver_id"], {
                            "type": "passenger_location",
                            "ride_id": active["id"],
                            "lat": lat,
                            "lng": lng,
                        })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"WS error for {user_id}: {e}")
    finally:
        await manager.disconnect(user_id, websocket)
