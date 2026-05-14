"""TirthRide — Iteration 4 backend tests.

Focus:
  A) Login OTP reverted to global mock 123456 for ALL phones (no sticky login OTP)
  B) Sticky per-PASSENGER ride PIN (users.ride_pin generated once, reused for every ride)
  C) Name validation in verify-otp
  D) Tip feature (10/20/50)
  E) Passenger location streaming over WebSocket
  F) Regression (geo, ratings, complaints, admin dashboards, WS dispatch, ride lifecycle)

The preview HTTPS ingress responds to WS upgrade with HTTP 307, so all WS uses
ws://localhost:8001/api/ws?token=<jwt>. REST uses preview URL.
"""
import asyncio
import json
import os
import sys
import time

import httpx
import websockets

# Read EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env
def _load_preview():
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return "https://govardhan-erickshaw.preview.emergentagent.com"


PREVIEW = _load_preview()
# The preview URL 307-redirects to the internal preview, and httpx (following
# redirects) drops the Authorization header on cross-origin hops. Use the
# internal target directly to avoid the redirect entirely while still routing
# via the production ingress.
if "preview.emergentagent.com" in PREVIEW and "internal" not in PREVIEW:
    PREVIEW_DIRECT = PREVIEW.replace(".preview.", ".internal.preview.")
else:
    PREVIEW_DIRECT = PREVIEW
BASE = f"{PREVIEW_DIRECT}/api"
WS_LOCAL = "ws://localhost:8001/api/ws"
WS_PREVIEW = PREVIEW.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"

ADMIN_PHONE = "9999999999"
EXPECTED_OTP = "123456"
TIMEOUT = 30.0


_phone_counter = 0


def uniq_phone(prefix: str = "8") -> str:
    """Unique 10-digit phone using time + monotonic counter."""
    global _phone_counter
    _phone_counter += 1
    t = int(time.time() * 1000) % 100_000_000
    return f"{prefix}{t:08d}{_phone_counter % 10}"[:10]


class Result:
    def __init__(self):
        self.passed = []
        self.failed = []

    def ok(self, name):
        print(f"  PASS  {name}")
        self.passed.append(name)

    def fail(self, name, detail=""):
        print(f"  FAIL  {name}  -- {detail}")
        self.failed.append((name, detail))

    def summary(self):
        print("\n" + "=" * 70)
        print(f"PASSED: {len(self.passed)}")
        print(f"FAILED: {len(self.failed)}")
        if self.failed:
            print("\nFAILED CASES:")
            for n, d in self.failed:
                print(f"  - {n}: {d}")
        print("=" * 70)


R = Result()


async def send_otp(client, phone, role):
    return await client.post(f"{BASE}/auth/send-otp", json={"phone": phone, "role": role})


async def verify_otp(client, phone, role, otp, name=None):
    payload = {"phone": phone, "role": role, "otp": otp}
    if name is not None:
        payload["name"] = name
    return await client.post(f"{BASE}/auth/verify-otp", json=payload)


async def signup_passenger(client, phone, name="Test Passenger"):
    r = await send_otp(client, phone, "passenger")
    otp = r.json()["dev_otp"]
    r2 = await verify_otp(client, phone, "passenger", otp, name=name)
    if r2.status_code != 200:
        raise RuntimeError(f"signup_passenger failed: {r2.status_code} {r2.text}")
    return r2.json()["access_token"], r2.json()["user"]


async def signup_driver(client, phone, name="Test Driver"):
    r = await send_otp(client, phone, "driver")
    otp = r.json()["dev_otp"]
    r2 = await verify_otp(client, phone, "driver", otp, name=name)
    if r2.status_code != 200:
        raise RuntimeError(f"signup_driver failed: {r2.status_code} {r2.text}")
    return r2.json()["access_token"], r2.json()["user"]


async def admin_login(client):
    r = await send_otp(client, ADMIN_PHONE, "admin")
    if r.status_code != 200:
        raise RuntimeError(f"admin send-otp failed: {r.status_code} {r.text}")
    otp = r.json()["dev_otp"]
    r2 = await verify_otp(client, ADMIN_PHONE, "admin", otp)
    if r2.status_code != 200:
        raise RuntimeError(f"admin verify-otp failed: {r2.status_code} {r2.text}")
    return r2.json()["access_token"]


# ===================== A) LOGIN OTP = GLOBAL MOCK 123456 =====================
async def test_global_login_otp(client):
    print("\n--- A) Login OTP reverted to global mock 123456 ---")
    test_cases = [
        (ADMIN_PHONE, "admin", "admin"),
        ("9000000001", "driver", "existing driver"),
        ("9000000002", "passenger", "existing passenger"),
        (uniq_phone(), "passenger", "brand new"),
    ]
    for phone, role, label in test_cases:
        r = await send_otp(client, phone, role)
        if r.status_code == 200 and r.json().get("dev_otp") == EXPECTED_OTP:
            R.ok(f"A1: send-otp {role} {phone} ({label}) → dev_otp=123456")
        else:
            R.fail(f"A1: send-otp {role} {phone} ({label})", f"{r.status_code} {r.text}")
            continue

        # Verify with 123456 — admin/existing have no name needed (existing users already have name).
        # Brand-new needs name. We pass name to be safe.
        name = "Rohan Patel" if label == "brand new" else None
        # For existing accounts we need to confirm verify works — but we don't want to mutate
        # so we just include a valid name (only used if user lacks one in DB)
        r2 = await verify_otp(client, phone, role, EXPECTED_OTP, name=name)
        if r2.status_code == 200:
            body = r2.json()
            if body.get("requires_name"):
                # legacy / brand new without name. Retry with name.
                r3 = await verify_otp(client, phone, role, EXPECTED_OTP, name="Rohan Patel")
                if r3.status_code == 200 and r3.json().get("access_token"):
                    R.ok(f"A2: verify-otp {role} {phone} (after name) → access_token")
                else:
                    R.fail(f"A2: verify-otp {role} {phone}", f"{r3.status_code} {r3.text}")
            elif body.get("access_token"):
                R.ok(f"A2: verify-otp {role} {phone} → access_token")
            else:
                R.fail(f"A2: verify-otp {role} {phone}", f"unexpected body: {body}")
        else:
            R.fail(f"A2: verify-otp {role} {phone}", f"{r2.status_code} {r2.text}")


# ===================== B) STICKY PER-PASSENGER RIDE PIN =====================
async def create_ride(client, token, pickup=None, drop=None, payment="cash"):
    body = {
        "type": "local",
        "pickup": pickup or {"name": "Govardhan Chauraha", "lat": 27.4977, "lng": 77.4625},
        "drop": drop or {"name": "Radha Kund", "lat": 27.5470, "lng": 77.4520},
        "distance_km": 5.5,
        "payment_method": payment,
    }
    return await client.post(f"{BASE}/rides", json=body, headers={"Authorization": f"Bearer {token}"})


async def submit_kyc(client, token):
    body = {
        "name": "Mohan Verma",
        "aadhar_number": "1234-5678-9012",
        "aadhar_photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "vehicle_no": "UP85AB1234",
        "vehicle_type": "e-rickshaw",
        "rc_photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "profile_photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "upi_id": "mohanverma@upi",
    }
    return await client.post(f"{BASE}/drivers/kyc", json=body, headers={"Authorization": f"Bearer {token}"})


async def approve_driver(client, admin_tok, driver_user_id):
    return await client.post(
        f"{BASE}/admin/drivers/{driver_user_id}/approve",
        headers={"Authorization": f"Bearer {admin_tok}"},
    )


async def driver_online(client, token, online=True):
    return await client.post(
        f"{BASE}/drivers/online", json={"online": online},
        headers={"Authorization": f"Bearer {token}"},
    )


async def test_sticky_ride_pin(client, admin_token):
    print("\n--- B) Sticky per-passenger ride PIN ---")
    phone = uniq_phone()
    p_tok, p_user = await signup_passenger(client, phone, name="Aarti Sharma")

    # B1: signup response has user.ride_pin (4 digits)
    p1 = (p_user or {}).get("ride_pin")
    if p1 and isinstance(p1, str) and len(p1) == 4 and p1.isdigit():
        R.ok(f"B1: signup user.ride_pin = '{p1}' (4 digits)")
    else:
        R.fail("B1: signup user.ride_pin", f"got={p1!r}")
        return

    # B2: Ride 1 — pin should equal P1
    r1 = await create_ride(client, p_tok)
    if r1.status_code != 200:
        R.fail("B2: create Ride#1", f"{r1.status_code} {r1.text}")
        return
    ride1 = r1.json()
    if ride1.get("pin") == p1:
        R.ok(f"B2: Ride#1.pin == P1 ('{p1}')")
    else:
        R.fail("B2: Ride#1.pin", f"expected {p1} got {ride1.get('pin')}")

    # B3: Ride 2 with different pickup/drop — same P1
    r2 = await create_ride(
        client, p_tok,
        pickup={"name": "Kusum Sarovar", "lat": 27.5288, "lng": 77.4478},
        drop={"name": "Mukharvind", "lat": 27.4985, "lng": 77.4615},
    )
    if r2.status_code != 200:
        R.fail("B3: create Ride#2", f"{r2.status_code} {r2.text}")
    else:
        if r2.json().get("pin") == p1:
            R.ok(f"B3: Ride#2.pin == P1 ('{p1}') — NOT regenerated")
        else:
            R.fail("B3: Ride#2.pin", f"expected {p1} got {r2.json().get('pin')}")

    # B4: Ride 3 — same P1
    r3 = await create_ride(
        client, p_tok,
        pickup={"name": "Govind Kund", "lat": 27.4870, "lng": 77.4612},
        drop={"name": "Anyor Village", "lat": 27.4790, "lng": 77.4523},
    )
    if r3.status_code != 200:
        R.fail("B4: create Ride#3", f"{r3.status_code} {r3.text}")
    else:
        if r3.json().get("pin") == p1:
            R.ok(f"B4: Ride#3.pin == P1 ('{p1}')")
        else:
            R.fail("B4: Ride#3.pin", f"expected {p1} got {r3.json().get('pin')}")

    # B5: driver accepts Ride#1 → verify-pin with P1 succeeds → status=started
    d_phone = uniq_phone()
    d_tok, d_user = await signup_driver(client, d_phone, name="Hari Mohan")
    rk = await submit_kyc(client, d_tok)
    if rk.status_code != 200:
        R.fail("B5-setup: KYC submit", f"{rk.status_code} {rk.text}")
        return
    ra = await approve_driver(client, admin_token, d_user["id"])
    if ra.status_code != 200:
        R.fail("B5-setup: approve", f"{ra.status_code} {ra.text}")
        return
    ro = await driver_online(client, d_tok, True)
    if ro.status_code != 200:
        R.fail("B5-setup: online", f"{ro.status_code} {ro.text}")
        return
    rid1 = ride1["id"]
    rac = await client.post(f"{BASE}/rides/{rid1}/accept", headers={"Authorization": f"Bearer {d_tok}"})
    if rac.status_code != 200:
        R.fail("B5-setup: accept Ride#1", f"{rac.status_code} {rac.text}")
        return
    rvp = await client.post(
        f"{BASE}/rides/{rid1}/verify-pin", json={"pin": p1},
        headers={"Authorization": f"Bearer {d_tok}"},
    )
    if rvp.status_code == 200 and rvp.json().get("status") == "started":
        R.ok("B5: verify-pin(P1) → 200, ride.status = started")
    else:
        R.fail("B5: verify-pin", f"{rvp.status_code} {rvp.text}")

    # B6: different passenger has different ride_pin
    phone2 = uniq_phone()
    _, p2_user = await signup_passenger(client, phone2, name="Priya Devi")
    p2 = (p2_user or {}).get("ride_pin")
    if p2 and p2 != p1:
        R.ok(f"B6: different passenger has different PIN (P1={p1}, P2={p2})")
    else:
        R.fail("B6: distinct PIN", f"p1={p1} p2={p2}")

    # B7: Legacy back-fill — try via mongo (motor)
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
        mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
        dbn = os.environ.get("DB_NAME", "tirthride")
        # Unset ride_pin on phone (passenger 2)
        await mongo[dbn].users.update_one({"phone": phone2}, {"$unset": {"ride_pin": ""}})
        # Re-login phone2 — verify-otp should back-fill
        r_so = await send_otp(client, phone2, "passenger")
        otp = r_so.json()["dev_otp"]
        r_vo = await verify_otp(client, phone2, "passenger", otp)
        if r_vo.status_code == 200 and r_vo.json().get("user", {}).get("ride_pin"):
            new_pin = r_vo.json()["user"]["ride_pin"]
            R.ok(f"B7: legacy account back-filled ride_pin = '{new_pin}' on re-login")
        else:
            R.fail("B7: legacy back-fill", f"{r_vo.status_code} {r_vo.text}")
        mongo.close()
    except Exception as e:
        R.fail("B7: legacy back-fill (mongo)", f"skipped/failed: {e}")


# ===================== C) NAME VALIDATION =====================
async def test_name_validation(client):
    print("\n--- C) Name validation in verify-otp ---")
    phone = uniq_phone()
    r = await send_otp(client, phone, "passenger")
    otp = r.json().get("dev_otp")
    if not otp:
        R.fail("C-setup: send-otp", str(r.json()))
        return

    # C1: 'Rohan9' (digit) → 400 with 'letters'
    r1 = await verify_otp(client, phone, "passenger", otp, name="Rohan9")
    if r1.status_code == 400 and "letters" in (r1.text or "").lower():
        R.ok("C1: 'Rohan9' → 400 with 'letters' message")
    else:
        R.fail("C1: 'Rohan9' should 400 w/ 'letters'", f"{r1.status_code} {r1.text}")

    # C2: '@#$' → 400
    r2 = await verify_otp(client, phone, "passenger", otp, name="@#$")
    if r2.status_code == 400:
        R.ok("C2: '@#$' → 400")
    else:
        R.fail("C2: '@#$' should 400", f"{r2.status_code} {r2.text}")

    # C4: No name field at all → requires_name=true, is_new_user=true
    r4 = await verify_otp(client, phone, "passenger", otp, name=None)
    if r4.status_code == 200 and r4.json().get("requires_name") is True and r4.json().get("is_new_user") is True:
        R.ok("C4: no name field → {requires_name:true, is_new_user:true}")
    else:
        R.fail("C4: no name → requires_name", f"{r4.status_code} {r4.text}")

    # C3: 'Rohan Sharma' → 200 (consumes OTP)
    r3 = await verify_otp(client, phone, "passenger", otp, name="Rohan Sharma")
    if r3.status_code == 200 and r3.json().get("access_token"):
        R.ok("C3: 'Rohan Sharma' → 200 with access_token")
    else:
        R.fail("C3: valid name should 200", f"{r3.status_code} {r3.text}")

    # C5: legacy user without name → simulate by unsetting name then re-login → requires_name
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
        mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
        dbn = os.environ.get("DB_NAME", "tirthride")
        await mongo[dbn].users.update_one({"phone": phone}, {"$unset": {"name": ""}})
        r5_so = await send_otp(client, phone, "passenger")
        otp5 = r5_so.json()["dev_otp"]
        r5 = await verify_otp(client, phone, "passenger", otp5)  # no name
        if r5.status_code == 200 and r5.json().get("requires_name") is True:
            R.ok("C5: legacy user (no name) → requires_name=true (is_new_user=false)")
        else:
            R.fail("C5: legacy user requires_name", f"{r5.status_code} {r5.text}")
        # restore name to not break later tests
        await mongo[dbn].users.update_one({"phone": phone}, {"$set": {"name": "Rohan Sharma"}})
        mongo.close()
    except Exception as e:
        R.fail("C5: legacy user (mongo)", f"skipped: {e}")


# ===================== D) TIP FEATURE =====================
async def test_tip(client, admin_token):
    print("\n--- D) Tip feature ---")
    p_phone = uniq_phone()
    p_tok, _ = await signup_passenger(client, p_phone, name="Suman Yadav")

    rc = await create_ride(client, p_tok)
    if rc.status_code != 200:
        R.fail("D1: create ride", f"{rc.status_code} {rc.text}")
        return
    ride = rc.json()
    rid = ride["id"]
    f0 = float(ride["fare"])
    if abs(float(ride.get("tip", 0))) < 1e-6:
        R.ok(f"D1: ride created fare=F0={f0}, tip=0")
    else:
        R.fail("D1: baseline tip", f"tip not 0: {ride.get('tip')}")

    # D2: tip 10 → fare = F0+10, tip=10
    r2 = await client.post(
        f"{BASE}/rides/{rid}/tip", json={"amount": 10},
        headers={"Authorization": f"Bearer {p_tok}"},
    )
    if (r2.status_code == 200
            and abs(float(r2.json()["fare"]) - (f0 + 10)) < 0.01
            and abs(float(r2.json()["tip"]) - 10) < 0.01):
        body = r2.json()
        # also check commission/driver_earning recomputed
        cfg = body.get("commission")
        de = body.get("driver_earning")
        R.ok(f"D2: tip 10 → fare={body['fare']}, tip=10, commission={cfg}, driver_earning={de}")
    else:
        R.fail("D2: tip 10", f"{r2.status_code} {r2.text}")

    # D3: tip 20 → fare = F0+30, tip=30
    r3 = await client.post(
        f"{BASE}/rides/{rid}/tip", json={"amount": 20},
        headers={"Authorization": f"Bearer {p_tok}"},
    )
    if (r3.status_code == 200
            and abs(float(r3.json()["fare"]) - (f0 + 30)) < 0.01
            and abs(float(r3.json()["tip"]) - 30) < 0.01):
        R.ok(f"D3: tip 20 → fare={r3.json()['fare']}, tip=30")
    else:
        R.fail("D3: tip 20 cumulative", f"{r3.status_code} {r3.text}")

    # D4: tip 50 → fare = F0+80, tip=80
    r4 = await client.post(
        f"{BASE}/rides/{rid}/tip", json={"amount": 50},
        headers={"Authorization": f"Bearer {p_tok}"},
    )
    if (r4.status_code == 200
            and abs(float(r4.json()["fare"]) - (f0 + 80)) < 0.01
            and abs(float(r4.json()["tip"]) - 80) < 0.01):
        R.ok(f"D4: tip 50 → fare={r4.json()['fare']}, tip=80")
    else:
        R.fail("D4: tip 50", f"{r4.status_code} {r4.text}")

    # D5: tip 100 → 400
    r5 = await client.post(
        f"{BASE}/rides/{rid}/tip", json={"amount": 100},
        headers={"Authorization": f"Bearer {p_tok}"},
    )
    if r5.status_code == 400:
        R.ok("D5: tip 100 → 400 (invalid amount)")
    else:
        R.fail("D5: tip 100", f"{r5.status_code} {r5.text}")

    # D6: different passenger tries tipping owner's ride → 404
    other_phone = uniq_phone()
    other_tok, _ = await signup_passenger(client, other_phone, name="Neha Singh")
    r6 = await client.post(
        f"{BASE}/rides/{rid}/tip", json={"amount": 10},
        headers={"Authorization": f"Bearer {other_tok}"},
    )
    if r6.status_code == 404:
        R.ok("D6: tip by non-owner passenger → 404")
    else:
        R.fail("D6: tip by other passenger", f"{r6.status_code} {r6.text}")

    # D7: driver accepts → tip after accept → 400
    d_phone = uniq_phone()
    d_tok, d_user = await signup_driver(client, d_phone, name="Karan Driver")
    await submit_kyc(client, d_tok)
    await approve_driver(client, admin_token, d_user["id"])
    await driver_online(client, d_tok, True)
    rac = await client.post(f"{BASE}/rides/{rid}/accept", headers={"Authorization": f"Bearer {d_tok}"})
    if rac.status_code != 200:
        R.fail("D7-setup: accept", f"{rac.status_code} {rac.text}")
        return
    r7 = await client.post(
        f"{BASE}/rides/{rid}/tip", json={"amount": 10},
        headers={"Authorization": f"Bearer {p_tok}"},
    )
    if r7.status_code == 400:
        R.ok("D7: tip after accept → 400 (only allowed in 'requested')")
    else:
        R.fail("D7: tip after accept", f"{r7.status_code} {r7.text}")


# ===================== E) PASSENGER LOCATION VIA WS =====================
async def recv_until(ws, predicate, timeout=5.0):
    deadline = time.time() + timeout
    msgs = []
    while time.time() < deadline:
        remaining = deadline - time.time()
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
        except asyncio.TimeoutError:
            break
        try:
            m = json.loads(raw)
        except Exception:
            continue
        msgs.append(m)
        if predicate(m):
            return m, msgs
    return None, msgs


async def _try_ws_connect(token):
    """Try wss://preview first; fall back to ws://localhost."""
    # Preview is known to 307-redirect WS, so go straight to local.
    return await websockets.connect(f"{WS_LOCAL}?token={token}", open_timeout=5)


async def test_passenger_location_ws(client, admin_token):
    print("\n--- E) Passenger location streaming over WebSocket ---")
    p_phone = uniq_phone()
    d_phone = uniq_phone()
    p_tok, _ = await signup_passenger(client, p_phone, name="Geeta Bai")
    d_tok, d_user = await signup_driver(client, d_phone, name="Sumit Driver")
    await submit_kyc(client, d_tok)
    await approve_driver(client, admin_token, d_user["id"])
    await driver_online(client, d_tok, True)
    rc = await create_ride(client, p_tok)
    if rc.status_code != 200:
        R.fail("E1-setup: create ride", f"{rc.status_code} {rc.text}")
        return
    rid = rc.json()["id"]
    rac = await client.post(f"{BASE}/rides/{rid}/accept", headers={"Authorization": f"Bearer {d_tok}"})
    if rac.status_code != 200:
        R.fail("E1-setup: accept", f"{rac.status_code} {rac.text}")
        return
    R.ok("E1: setup — passenger ride created, driver accepted (status=accepted)")

    try:
        pws = await _try_ws_connect(p_tok)
        dws = await _try_ws_connect(d_tok)
        try:
            # drain hello
            await asyncio.wait_for(pws.recv(), timeout=3)
            await asyncio.wait_for(dws.recv(), timeout=3)
            R.ok("E2: passenger + driver WS connected (hello received)")

            # E3: passenger sends location
            await pws.send(json.dumps({"type": "location", "lat": 27.5, "lng": 77.45}))

            # E4: driver receives passenger_location
            m, msgs = await recv_until(
                dws,
                lambda x: x.get("type") == "passenger_location",
                timeout=3.0,
            )
            if (m and m.get("ride_id") == rid
                    and abs(m.get("lat") - 27.5) < 1e-6
                    and abs(m.get("lng") - 77.45) < 1e-6):
                R.ok(f"E3-4: driver received passenger_location {m}")
            else:
                R.fail("E3-4: passenger_location event", f"got={m} all={msgs}")
        finally:
            await pws.close()
            await dws.close()
    except Exception as e:
        R.fail("E2-4: WS connect/recv", str(e))
        return

    # E5: GET /rides/{id} as driver → response includes passenger_location
    await asyncio.sleep(0.4)
    rg = await client.get(f"{BASE}/rides/{rid}", headers={"Authorization": f"Bearer {d_tok}"})
    if rg.status_code == 200:
        pl = rg.json().get("passenger_location")
        if pl and abs(pl.get("lat") - 27.5) < 1e-6 and abs(pl.get("lng") - 77.45) < 1e-6:
            R.ok(f"E5: GET /rides/{{id}} (driver) → passenger_location={pl}")
        else:
            R.fail("E5: passenger_location in GET", f"got={rg.json()}")
    else:
        R.fail("E5: GET ride", f"{rg.status_code} {rg.text}")


# ===================== F) REGRESSION =====================
async def test_regression(client, admin_token):
    print("\n--- F) Regression (existing flows) ---")

    # F1: WS dispatch — passenger creates ride → online driver receives ride_requested
    p_phone = uniq_phone()
    d_phone = uniq_phone()
    d2_phone = uniq_phone()  # second driver for ride_taken
    p_tok, _ = await signup_passenger(client, p_phone, name="Kavita Devi")
    d_tok, d_user = await signup_driver(client, d_phone, name="Mahesh Driver")
    d2_tok, d2_user = await signup_driver(client, d2_phone, name="Rajesh Driver")
    await submit_kyc(client, d_tok)
    await submit_kyc(client, d2_tok)
    await approve_driver(client, admin_token, d_user["id"])
    await approve_driver(client, admin_token, d2_user["id"])
    await driver_online(client, d_tok, True)
    await driver_online(client, d2_tok, True)

    # Connect both drivers WS first
    try:
        dws = await _try_ws_connect(d_tok)
        d2ws = await _try_ws_connect(d2_tok)
        pws = await _try_ws_connect(p_tok)
        try:
            await asyncio.wait_for(dws.recv(), timeout=3)
            await asyncio.wait_for(d2ws.recv(), timeout=3)
            await asyncio.wait_for(pws.recv(), timeout=3)

            # Create ride
            rc = await create_ride(client, p_tok)
            if rc.status_code != 200:
                R.fail("F1: create ride", f"{rc.status_code} {rc.text}")
                return
            rid = rc.json()["id"]

            # Driver d should receive ride_requested
            m, _ = await recv_until(dws, lambda x: x.get("type") == "ride_requested", timeout=3.0)
            if m and m.get("ride", {}).get("id") == rid:
                R.ok("F1: WS dispatch — driver received ride_requested")
            else:
                R.fail("F1: ride_requested", f"got={m}")

            # Accept by d
            rac = await client.post(f"{BASE}/rides/{rid}/accept", headers={"Authorization": f"Bearer {d_tok}"})
            if rac.status_code != 200:
                R.fail("F2: accept", f"{rac.status_code} {rac.text}")
                return

            # Passenger should get ride_accepted
            pm, _ = await recv_until(pws, lambda x: x.get("type") == "ride_accepted", timeout=3.0)
            if pm and pm.get("ride", {}).get("id") == rid:
                R.ok("F2: passenger received ride_accepted")
            else:
                R.fail("F2: ride_accepted", f"got={pm}")

            # Other driver (d2) should get ride_taken
            t2, _ = await recv_until(d2ws, lambda x: x.get("type") == "ride_taken", timeout=3.0)
            if t2 and t2.get("ride_id") == rid:
                R.ok("F2b: other driver received ride_taken")
            else:
                R.fail("F2b: ride_taken", f"got={t2}")

            # F3: driver streams location → passenger receives driver_location
            await dws.send(json.dumps({"type": "location", "lat": 27.51, "lng": 77.46}))
            dl, _ = await recv_until(pws, lambda x: x.get("type") == "driver_location", timeout=3.0)
            if dl and dl.get("ride_id") == rid and abs(dl.get("lat") - 27.51) < 1e-6:
                R.ok("F3: passenger received driver_location")
            else:
                R.fail("F3: driver_location", f"got={dl}")

            # complete the ride so ratings test can use it
            pin = rc.json().get("pin")
            rvp = await client.post(
                f"{BASE}/rides/{rid}/verify-pin", json={"pin": pin},
                headers={"Authorization": f"Bearer {d_tok}"},
            )
            assert rvp.status_code == 200, rvp.text
            rcp = await client.post(f"{BASE}/rides/{rid}/complete", headers={"Authorization": f"Bearer {d_tok}"})
            if rcp.status_code != 200:
                R.fail("F5-setup: complete ride", f"{rcp.status_code} {rcp.text}")
        finally:
            await dws.close()
            await d2ws.close()
            await pws.close()
    except Exception as e:
        R.fail("F1-3: WS regression", str(e))
        rid = None

    # F4: geo
    rs = await client.get(f"{BASE}/geo/search", params={"q": "govardhan"})
    if rs.status_code == 200 and isinstance(rs.json().get("results"), list) and len(rs.json()["results"]) >= 1:
        R.ok(f"F4a: /geo/search?q=govardhan → {len(rs.json()['results'])} results")
    else:
        R.fail("F4a: /geo/search", f"{rs.status_code} {rs.text[:200]}")

    rrt = await client.get(
        f"{BASE}/geo/route",
        params={"from_lat": 27.4985, "from_lng": 77.4615, "to_lat": 27.5275, "to_lng": 77.4360},
    )
    if rrt.status_code == 200 and rrt.json().get("distance_km", 0) > 0 and rrt.json().get("polyline"):
        R.ok(f"F4b: /geo/route distance={rrt.json()['distance_km']} polyline_len={len(rrt.json()['polyline'])}")
    else:
        R.fail("F4b: /geo/route", f"{rrt.status_code} {rrt.text[:200]}")

    # F5: ratings (use ride from F1-3)
    if rid:
        rr = await client.post(
            f"{BASE}/rides/{rid}/rate", json={"stars": 5, "comment": "Smooth"},
            headers={"Authorization": f"Bearer {p_tok}"},
        )
        if rr.status_code == 200 and rr.json().get("stars") == 5:
            R.ok("F5: rate ride 5 stars")
        else:
            R.fail("F5: rate ride", f"{rr.status_code} {rr.text}")

    # F6: complaints
    if rid:
        rco = await client.post(
            f"{BASE}/rides/{rid}/complaint",
            json={"category": "rash_driving", "description": "Regression complaint", "against": "driver"},
            headers={"Authorization": f"Bearer {p_tok}"},
        )
        if rco.status_code == 200:
            R.ok("F6a: file complaint")
        else:
            R.fail("F6a: complaint create", f"{rco.status_code} {rco.text}")

        # admin list complaints
        rl = await client.get(
            f"{BASE}/admin/complaints",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        if rl.status_code == 200 and "complaints" in rl.json():
            R.ok(f"F6b: /admin/complaints (open) → {len(rl.json()['complaints'])} rows")
        else:
            R.fail("F6b: complaints list", f"{rl.status_code} {rl.text}")

    # F7: admin dashboard + timeseries
    rd = await client.get(f"{BASE}/admin/dashboard", headers={"Authorization": f"Bearer {admin_token}"})
    if rd.status_code == 200 and "total_rides" in rd.json():
        R.ok(f"F7a: /admin/dashboard → total_rides={rd.json()['total_rides']}")
    else:
        R.fail("F7a: dashboard", f"{rd.status_code} {rd.text}")
    rt = await client.get(
        f"{BASE}/admin/reports/timeseries?days=7",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    if rt.status_code == 200 and isinstance(rt.json().get("series"), list):
        R.ok(f"F7b: /admin/reports/timeseries → {len(rt.json()['series'])} days")
    else:
        R.fail("F7b: timeseries", f"{rt.status_code} {rt.text}")


# ===================== MAIN =====================
async def main():
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        print(f"BASE = {BASE}")
        print(f"WS   = {WS_LOCAL}")

        admin_token = await admin_login(client)
        print(f"admin_token acquired ({admin_token[:12]}..)\n")

        await test_global_login_otp(client)
        await test_sticky_ride_pin(client, admin_token)
        await test_name_validation(client)
        await test_tip(client, admin_token)
        await test_passenger_location_ws(client, admin_token)
        await test_regression(client, admin_token)

    R.summary()
    return 0 if not R.failed else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
