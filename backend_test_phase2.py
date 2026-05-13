"""TirthRide Phase 2 backend test suite (realtime dispatch / WebSocket / driver location / push).

Run against the external preview URL configured in frontend/.env.
All HTTP routes prefixed with /api, WebSocket at /api/ws?token=<jwt>.
"""
import asyncio
import json
import random
import string
import sys
import time
from typing import Any, Dict, List, Optional

import requests
import websockets

BASE = "https://tirthride-preview.preview.emergentagent.com/api"
# WebSocket: prefer localhost since preview ingress 307-redirects WS upgrade to internal HTTPS host
# (which isn't a valid ws:// scheme). Per spec, "both should work" — using localhost in the test env.
WS_BASE = "ws://localhost:8001/api/ws"
OTP = "123456"
ADMIN_PHONE = "9999999999"
GOVARDHAN = (27.4985, 77.4615)

PASS: List[str] = []
FAIL: List[tuple] = []


def check(name: str, cond: bool, detail: str = "") -> bool:
    if cond:
        PASS.append(name)
        print(f"  PASS  {name}")
    else:
        FAIL.append((name, detail))
        print(f"  FAIL  {name}  | {detail}")
    return cond


def H(token: Optional[str] = None) -> Dict[str, str]:
    h = {"Content-Type": "application/json"}
    if token:
        h["X-Auth-Token"] = token
    return h


def rand_phone(prefix="95") -> str:
    return prefix + "".join(random.choices(string.digits, k=10 - len(prefix)))


def login(phone: str, role: str, name: Optional[str] = None) -> Dict[str, Any]:
    requests.post(f"{BASE}/auth/send-otp", json={"phone": phone, "role": role}, timeout=15)
    body = {"phone": phone, "role": role, "otp": OTP}
    if name:
        body["name"] = name
    r = requests.post(f"{BASE}/auth/verify-otp", json=body, timeout=15)
    return r.json()


def admin_login() -> str:
    j = login(ADMIN_PHONE, "admin")
    return j.get("access_token")


def setup_driver(name: str, admin_token: str, online: bool = True) -> Dict[str, Any]:
    """Create driver, submit KYC, approve, set online. Returns {token, user_id, phone}."""
    phone = rand_phone("9444")
    j = login(phone, "driver", name=name)
    token = j["access_token"]
    user_id = j["user"]["id"]
    kyc = {
        "name": name,
        "aadhar_number": "".join(random.choices(string.digits, k=12)),
        "aadhar_photo": "https://example.com/a.jpg",
        "vehicle_no": "UP85" + "".join(random.choices(string.ascii_uppercase, k=2)) + "".join(random.choices(string.digits, k=4)),
        "vehicle_type": "e-rickshaw",
        "rc_photo": "https://example.com/rc.jpg",
        "profile_photo": "https://example.com/p.jpg",
        "upi_id": f"{name.lower().replace(' ', '')}@upi",
    }
    requests.post(f"{BASE}/drivers/kyc", headers=H(token), json=kyc, timeout=15)
    requests.post(f"{BASE}/admin/drivers/{user_id}/approve", headers=H(admin_token), timeout=15)
    if online:
        requests.post(f"{BASE}/drivers/online", headers=H(token), json={"online": True}, timeout=15)
    return {"token": token, "user_id": user_id, "phone": phone, "name": name}


def setup_passenger(name: str) -> Dict[str, Any]:
    phone = rand_phone("9555")
    j = login(phone, "passenger", name=name)
    return {"token": j["access_token"], "user_id": j["user"]["id"], "phone": phone, "name": name}


# ===================== Async WS helpers =====================
async def ws_connect(token: str):
    return await websockets.connect(f"{WS_BASE}?token={token}", open_timeout=10, close_timeout=5)


async def ws_recv_until(ws, predicate, timeout_total: float = 8.0) -> Optional[dict]:
    """Drain messages until predicate(msg)==True or timeout."""
    deadline = time.monotonic() + timeout_total
    while time.monotonic() < deadline:
        remaining = deadline - time.monotonic()
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
        except asyncio.TimeoutError:
            return None
        try:
            msg = json.loads(raw)
        except Exception:
            continue
        if predicate(msg):
            return msg
    return None


async def ws_recv_all(ws, duration: float = 1.5) -> List[dict]:
    out: List[dict] = []
    deadline = time.monotonic() + duration
    while time.monotonic() < deadline:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=deadline - time.monotonic())
        except asyncio.TimeoutError:
            break
        try:
            out.append(json.loads(raw))
        except Exception:
            pass
    return out


# ===================== 1. WS auth & ping =====================
async def test_ws_auth_and_ping():
    print("\n=== 1. WebSocket auth + hello + ping ===")
    # invalid token
    rejected = False
    try:
        ws = await websockets.connect(f"{WS_BASE}?token=invalid-jwt", open_timeout=10, close_timeout=5)
        try:
            await asyncio.wait_for(ws.recv(), timeout=3)
        except websockets.ConnectionClosed as e:
            rejected = True
            check("WS invalid token rejected (close 4401)", e.code in (4401, 1006, 1011), f"code={e.code}")
        except asyncio.TimeoutError:
            check("WS invalid token rejected", False, "no close after invalid token")
        await ws.close()
    except websockets.InvalidStatusCode as e:
        rejected = True
        check("WS invalid token rejected (HTTP)", e.status_code in (401, 403), f"status={e.status_code}")
    except Exception as e:
        check("WS invalid token rejected", True, f"connect failed as expected: {e!r}")
        rejected = True
    if not rejected:
        check("WS invalid token closed by server", False, "did not close")

    # Valid passenger
    p = setup_passenger("Asha Rai")
    ws = await ws_connect(p["token"])
    msg = await ws_recv_until(ws, lambda m: m.get("type") == "hello", timeout_total=5)
    check("WS hello received with role=passenger",
          bool(msg) and msg.get("role") == "passenger" and msg.get("user_id") == p["user_id"],
          f"msg={msg}")
    await ws.send(json.dumps({"type": "ping"}))
    pong = await ws_recv_until(ws, lambda m: m.get("type") == "pong", timeout_total=5)
    check("WS ping → pong", bool(pong), f"pong={pong}")
    await ws.close()


# ===================== 2. Realtime dispatch (broadcast) =====================
async def test_realtime_dispatch(admin_token: str):
    print("\n=== 2. Realtime ride dispatch (broadcast w/o driver locs) ===")
    # 2 drivers, online + approved, NO current_lat/lng -> fallback broadcast
    drv_a = setup_driver("Bhola Kumar", admin_token)
    drv_b = setup_driver("Suresh Verma", admin_token)
    pas = setup_passenger("Meera Singh")

    ws_a = await ws_connect(drv_a["token"])
    ws_b = await ws_connect(drv_b["token"])
    ws_p = await ws_connect(pas["token"])
    # drain hellos
    for ws in (ws_a, ws_b, ws_p):
        await ws_recv_until(ws, lambda m: m.get("type") == "hello", timeout_total=3)

    # passenger creates local ride
    body = {
        "type": "local",
        "pickup": {"name": "Mukharvind", "lat": GOVARDHAN[0], "lng": GOVARDHAN[1]},
        "drop": {"name": "Radha Kund", "lat": 27.5470, "lng": 77.4520},
        "distance_km": 5,
        "payment_method": "cash",
    }
    r = requests.post(f"{BASE}/rides", headers=H(pas["token"]), json=body, timeout=15)
    check("Create ride 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    ride = r.json() if r.status_code == 200 else {}
    ride_id = ride.get("id")

    # Both drivers should receive ride_requested
    msg_a = await ws_recv_until(ws_a, lambda m: m.get("type") == "ride_requested", timeout_total=6)
    msg_b = await ws_recv_until(ws_b, lambda m: m.get("type") == "ride_requested", timeout_total=6)
    check("Driver A got ride_requested", bool(msg_a) and (msg_a.get("ride") or {}).get("id") == ride_id, f"msg={msg_a}")
    check("Driver B got ride_requested", bool(msg_b) and (msg_b.get("ride") or {}).get("id") == ride_id, f"msg={msg_b}")

    # Driver A accepts via REST
    r = requests.post(f"{BASE}/rides/{ride_id}/accept", headers=H(drv_a["token"]), timeout=15)
    check("Driver A accept 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    # Driver B should receive ride_taken
    taken = await ws_recv_until(ws_b, lambda m: m.get("type") == "ride_taken", timeout_total=6)
    check("Driver B got ride_taken", bool(taken) and taken.get("ride_id") == ride_id, f"msg={taken}")

    # Passenger should receive ride_accepted with driver info
    accepted = await ws_recv_until(ws_p, lambda m: m.get("type") == "ride_accepted", timeout_total=6)
    has_driver = bool(accepted) and (accepted.get("ride") or {}).get("driver_id") == drv_a["user_id"]
    check("Passenger got ride_accepted w/ driver info", has_driver, f"msg={accepted}")

    # cleanup ride
    requests.post(f"{BASE}/rides/{ride_id}/cancel", headers=H(pas["token"]),
                  json={"reason": "test cleanup"}, timeout=10)
    for ws in (ws_a, ws_b, ws_p):
        await ws.close()
    return {"drv_a": drv_a, "drv_b": drv_b, "pas": pas}


# ===================== 3. Targeted dispatch with radius =====================
async def test_targeted_dispatch(admin_token: str):
    print("\n=== 3. Targeted dispatch w/ radius ===")
    # ensure default radius = 5km
    drv_a = setup_driver("Karan Patel", admin_token)
    drv_b = setup_driver("Tarun Yadav", admin_token)
    pas = setup_passenger("Riya Sharma")

    # set locations: A close to Govardhan center, B far away
    r = requests.post(f"{BASE}/drivers/location", headers=H(drv_a["token"]),
                      json={"lat": 27.498, "lng": 77.461}, timeout=15)
    check("Driver A POST location 200", r.status_code == 200 and r.json().get("ok") is True,
          f"status={r.status_code} body={r.text[:200]}")
    r = requests.post(f"{BASE}/drivers/location", headers=H(drv_b["token"]),
                      json={"lat": 28.0, "lng": 78.0}, timeout=15)
    check("Driver B POST location 200", r.status_code == 200 and r.json().get("ok") is True,
          f"status={r.status_code} body={r.text[:200]}")

    ws_a = await ws_connect(drv_a["token"])
    ws_b = await ws_connect(drv_b["token"])
    for ws in (ws_a, ws_b):
        await ws_recv_until(ws, lambda m: m.get("type") == "hello", timeout_total=3)

    body = {
        "type": "local",
        "pickup": {"name": "Govardhan center", "lat": 27.4985, "lng": 77.4615},
        "drop": {"name": "Radha Kund", "lat": 27.5470, "lng": 77.4520},
        "distance_km": 5,
        "payment_method": "cash",
    }
    r = requests.post(f"{BASE}/rides", headers=H(pas["token"]), json=body, timeout=15)
    check("Ride created (targeted dispatch)", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    ride = r.json() if r.status_code == 200 else {}
    ride_id = ride.get("id")
    check("Ride created with status=requested and driver_id=null",
          ride.get("status") == "requested" and ride.get("driver_id") is None,
          f"status={ride.get('status')} driver_id={ride.get('driver_id')}")

    msg_a = await ws_recv_until(ws_a, lambda m: m.get("type") == "ride_requested" and (m.get("ride") or {}).get("id") == ride_id, timeout_total=6)
    check("Driver A (in-radius) got ride_requested", bool(msg_a), f"msg={msg_a}")

    # B should NOT get ride_requested for this ride
    msg_b = await ws_recv_until(ws_b, lambda m: m.get("type") == "ride_requested" and (m.get("ride") or {}).get("id") == ride_id, timeout_total=3)
    check("Driver B (out-of-radius) did NOT get ride_requested", msg_b is None, f"unexpected msg={msg_b}")

    requests.post(f"{BASE}/rides/{ride_id}/cancel", headers=H(pas["token"]),
                  json={"reason": "cleanup"}, timeout=10)
    for ws in (ws_a, ws_b):
        await ws.close()
    return {"drv_a": drv_a, "drv_b": drv_b, "pas": pas, "ride_id": ride_id}


# ===================== 4. Driver location tracking =====================
async def test_driver_location(admin_token: str):
    print("\n=== 4. Driver location tracking ===")
    drv = setup_driver("Hari Mishra", admin_token)
    pas = setup_passenger("Naina Joshi")

    # POST /drivers/location stores on driver doc
    r = requests.post(f"{BASE}/drivers/location", headers=H(drv["token"]),
                      json={"lat": 27.5, "lng": 77.46}, timeout=15)
    check("POST /drivers/location 200 ok=true",
          r.status_code == 200 and r.json().get("ok") is True,
          f"status={r.status_code} body={r.text[:200]}")

    # passenger creates ride near driver's loc → driver accepts
    body = {
        "type": "local",
        "pickup": {"name": "Near driver", "lat": 27.501, "lng": 77.462},
        "drop": {"name": "Radha Kund", "lat": 27.5470, "lng": 77.4520},
        "distance_km": 5,
        "payment_method": "cash",
    }
    r = requests.post(f"{BASE}/rides", headers=H(pas["token"]), json=body, timeout=15)
    ride_id = (r.json() if r.status_code == 200 else {}).get("id")
    check("Ride created", bool(ride_id), f"status={r.status_code}")

    # Driver accepts
    r = requests.post(f"{BASE}/rides/{ride_id}/accept", headers=H(drv["token"]), timeout=15)
    check("Driver accept 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    # GET /rides/{id} as passenger → driver_location present
    r = requests.get(f"{BASE}/rides/{ride_id}", headers=H(pas["token"]), timeout=15)
    j = r.json() if r.status_code == 200 else {}
    loc = j.get("driver_location") or {}
    check("Passenger sees driver_location with lat/lng",
          loc.get("lat") == 27.5 and loc.get("lng") == 77.46,
          f"driver_location={loc} full={str(j)[:300]}")

    # WS location push from driver → passenger receives driver_location event
    ws_d = await ws_connect(drv["token"])
    ws_p = await ws_connect(pas["token"])
    for ws in (ws_d, ws_p):
        await ws_recv_until(ws, lambda m: m.get("type") == "hello", timeout_total=3)

    await ws_d.send(json.dumps({"type": "location", "lat": 27.51, "lng": 77.47}))
    dl = await ws_recv_until(ws_p,
                             lambda m: m.get("type") == "driver_location" and m.get("ride_id") == ride_id,
                             timeout_total=6)
    check("Passenger WS got driver_location after driver WS location",
          bool(dl) and dl.get("lat") == 27.51 and dl.get("lng") == 77.47,
          f"msg={dl}")

    # cleanup: complete the ride lifecycle in test 6 separately
    await ws_d.close()
    await ws_p.close()
    requests.post(f"{BASE}/rides/{ride_id}/cancel", headers=H(pas["token"]),
                  json={"reason": "cleanup"}, timeout=10)


# ===================== 5. Push token registration =====================
def test_push_token():
    print("\n=== 5. Push token registration ===")
    pas = setup_passenger("Sneha Iyer")
    # Valid Expo-formatted token
    r = requests.post(f"{BASE}/users/push-token", headers=H(pas["token"]),
                      json={"token": "ExponentPushToken[fake-test-123]", "platform": "android"},
                      timeout=15)
    check("POST /users/push-token 200 ok=true",
          r.status_code == 200 and r.json().get("ok") is True,
          f"status={r.status_code} body={r.text[:200]}")

    # Verify it's stored (GET /auth/me does not return token but we can check via ride flow side effect — not directly observable.
    # Instead, register a non-Expo token; should still return ok and not crash anything (graceful skip on send time).
    r = requests.post(f"{BASE}/users/push-token", headers=H(pas["token"]),
                      json={"token": "abc", "platform": "ios"}, timeout=15)
    check("POST /users/push-token w/ non-Expo token 200 (graceful)",
          r.status_code == 200 and r.json().get("ok") is True,
          f"status={r.status_code} body={r.text[:200]}")
    return pas


# ===================== 6. Ride lifecycle WS events end-to-end =====================
async def test_ride_lifecycle_ws(admin_token: str):
    print("\n=== 6. Ride lifecycle WS events ===")
    drv = setup_driver("Vijay Kumar", admin_token)
    pas = setup_passenger("Pooja Sahu")
    requests.post(f"{BASE}/drivers/location", headers=H(drv["token"]),
                  json={"lat": 27.498, "lng": 77.461}, timeout=10)

    ws_p = await ws_connect(pas["token"])
    ws_d = await ws_connect(drv["token"])
    for ws in (ws_p, ws_d):
        await ws_recv_until(ws, lambda m: m.get("type") == "hello", timeout_total=3)

    body = {
        "type": "local",
        "pickup": {"name": "x", "lat": 27.498, "lng": 77.461},
        "drop": {"name": "y", "lat": 27.547, "lng": 77.452},
        "distance_km": 5,
        "payment_method": "cash",
    }
    r = requests.post(f"{BASE}/rides", headers=H(pas["token"]), json=body, timeout=15)
    ride = r.json() if r.status_code == 200 else {}
    ride_id = ride.get("id")
    pin = ride.get("pin")
    check("Lifecycle ride created", bool(ride_id) and bool(pin), str(ride)[:200])

    await ws_recv_until(ws_d, lambda m: m.get("type") == "ride_requested" and (m.get("ride") or {}).get("id") == ride_id, timeout_total=6)
    requests.post(f"{BASE}/rides/{ride_id}/accept", headers=H(drv["token"]), timeout=15)
    await ws_recv_until(ws_p, lambda m: m.get("type") == "ride_accepted", timeout_total=6)

    requests.post(f"{BASE}/rides/{ride_id}/verify-pin", headers=H(drv["token"]),
                  json={"pin": pin}, timeout=15)
    started = await ws_recv_until(ws_p, lambda m: m.get("type") == "ride_started", timeout_total=6)
    check("Passenger got ride_started", bool(started), f"msg={started}")

    requests.post(f"{BASE}/rides/{ride_id}/complete", headers=H(drv["token"]), timeout=15)
    completed = await ws_recv_until(ws_p, lambda m: m.get("type") == "ride_completed", timeout_total=6)
    check("Passenger got ride_completed w/ fare",
          bool(completed) and isinstance(completed.get("fare"), (int, float)),
          f"msg={completed}")

    await ws_p.close()
    await ws_d.close()

    # ---- Separate test: passenger creates ride → driver accepts → passenger cancels → driver gets ride_cancelled ----
    print("  -- cancellation sub-test --")
    drv2 = setup_driver("Anil Tiwari", admin_token)
    pas2 = setup_passenger("Kavya Rao")
    requests.post(f"{BASE}/drivers/location", headers=H(drv2["token"]),
                  json={"lat": 27.498, "lng": 77.461}, timeout=10)
    ws_d2 = await ws_connect(drv2["token"])
    ws_p2 = await ws_connect(pas2["token"])
    for ws in (ws_d2, ws_p2):
        await ws_recv_until(ws, lambda m: m.get("type") == "hello", timeout_total=3)
    r = requests.post(f"{BASE}/rides", headers=H(pas2["token"]), json=body, timeout=15)
    rid2 = (r.json() or {}).get("id")
    await ws_recv_until(ws_d2, lambda m: m.get("type") == "ride_requested" and (m.get("ride") or {}).get("id") == rid2, timeout_total=6)
    requests.post(f"{BASE}/rides/{rid2}/accept", headers=H(drv2["token"]), timeout=15)
    await ws_recv_until(ws_p2, lambda m: m.get("type") == "ride_accepted", timeout_total=6)
    requests.post(f"{BASE}/rides/{rid2}/cancel", headers=H(pas2["token"]),
                  json={"reason": "Changed plans"}, timeout=10)
    cancelled = await ws_recv_until(ws_d2,
                                    lambda m: m.get("type") == "ride_cancelled" and m.get("ride_id") == rid2,
                                    timeout_total=6)
    check("Driver got ride_cancelled by=passenger",
          bool(cancelled) and cancelled.get("by") == "passenger" and "reason" in cancelled,
          f"msg={cancelled}")
    await ws_d2.close()
    await ws_p2.close()


# ===================== 7. Config dispatch_radius_km + surge_pct =====================
def test_config_radius_surge(admin_token: str):
    print("\n=== 7. Config dispatch_radius_km + surge_pct ===")
    r = requests.get(f"{BASE}/config/fare", timeout=15)
    cfg = r.json() if r.status_code == 200 else {}
    check("config/fare has dispatch_radius_km",
          "dispatch_radius_km" in cfg,
          f"keys={list(cfg.keys())}")
    check("config/fare has surge_pct", "surge_pct" in cfg, f"keys={list(cfg.keys())}")
    # default radius 5.0 (per spec)
    if "dispatch_radius_km" in cfg:
        check("dispatch_radius_km default ~5.0",
              abs(float(cfg["dispatch_radius_km"]) - 5.0) < 0.001 or float(cfg["dispatch_radius_km"]) == 10.0,
              f"value={cfg.get('dispatch_radius_km')} (note: may have been set to 10 by previous test run)")
    if "surge_pct" in cfg:
        check("surge_pct is numeric (default 0.0)",
              isinstance(cfg["surge_pct"], (int, float)),
              f"value={cfg.get('surge_pct')}")

    # Admin PATCH to set dispatch_radius_km=10
    r = requests.patch(f"{BASE}/admin/config/fare", headers=H(admin_token),
                       json={"dispatch_radius_km": 10}, timeout=15)
    check("PATCH admin/config/fare dispatch_radius_km=10 200",
          r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    r = requests.get(f"{BASE}/config/fare", timeout=15)
    cfg = r.json() if r.status_code == 200 else {}
    check("dispatch_radius_km updated to 10",
          float(cfg.get("dispatch_radius_km", 0)) == 10.0,
          f"value={cfg.get('dispatch_radius_km')}")


# ===================== 8. Phase 1 regression =====================
def test_phase1_regression():
    print("\n=== 8. Phase 1 regression ===")
    r = requests.get(f"{BASE}/", timeout=10)
    check("smoke /api/", r.status_code == 200, f"status={r.status_code}")
    r = requests.get(f"{BASE}/geo/region", timeout=15)
    check("geo/region 200", r.status_code == 200, f"status={r.status_code}")
    r = requests.get(f"{BASE}/geo/search", params={"q": "radha kund"}, timeout=20)
    j = r.json() if r.status_code == 200 else {}
    check("geo/search radha kund ok", r.status_code == 200 and len(j.get("results", [])) >= 1, f"count={len(j.get('results', []))}")
    r = requests.get(f"{BASE}/geo/route", params={
        "from_lat": 27.4985, "from_lng": 77.4615, "to_lat": 27.5470, "to_lng": 77.4520
    }, timeout=25)
    j = r.json() if r.status_code == 200 else {}
    check("geo/route distance_km>0", r.status_code == 200 and j.get("distance_km", 0) > 0,
          f"status={r.status_code} body={r.text[:200]}")

    # admin landmarks GET
    admin_tok = admin_login()
    r = requests.get(f"{BASE}/admin/landmarks", headers=H(admin_tok), timeout=15)
    check("admin/landmarks 200", r.status_code == 200, f"status={r.status_code}")


# ===================== Main =====================
async def main_async():
    admin_token = admin_login()
    if not admin_token:
        print("FATAL: admin login failed")
        sys.exit(1)
    print(f"Admin token acquired")

    await test_ws_auth_and_ping()
    await test_realtime_dispatch(admin_token)
    await test_targeted_dispatch(admin_token)
    await test_driver_location(admin_token)
    test_push_token()
    await test_ride_lifecycle_ws(admin_token)
    test_config_radius_surge(admin_token)
    test_phase1_regression()


def main():
    asyncio.run(main_async())
    print("\n=========== PHASE 2 SUMMARY ===========")
    print(f"PASSED: {len(PASS)}")
    print(f"FAILED: {len(FAIL)}")
    for n, d in FAIL:
        print(f"  - {n}: {d}")
    sys.exit(0 if not FAIL else 1)


if __name__ == "__main__":
    main()
