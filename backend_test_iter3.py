"""TirthRide — Iteration 3 backend tests.

Focus:
  A) Sticky per-user OTP
  B) Name validation in verify-otp
  C) Tip feature on ride
  D) Passenger location streaming over WebSocket
  E) Regression (existing OTP, ride lifecycle, WS driver_location, geo, admin dashboard,
     ratings + complaints)

The preview HTTPS ingress (govardhan-erickshaw.preview.emergentagent.com) responds to
WebSocket upgrade with a 307 redirect that the websockets python lib cannot follow,
so all WS connections use ws://localhost:8001/api/ws?token=<jwt>. REST always uses
the preview URL (https://...preview.emergentagent.com/api).
"""
import asyncio
import json
import os
import sys
import time
import uuid

import httpx
import websockets

PREVIEW = "https://govardhan-erickshaw.preview.emergentagent.com"
BASE = f"{PREVIEW}/api"
WS_LOCAL = "ws://localhost:8001/api/ws"

ADMIN_PHONE = "9999999999"
ADMIN_OTP = "123456"
TIMEOUT = 30.0


def uniq_phone(prefix: str = "91") -> str:
    """Generate a unique 10-digit phone using current time."""
    # Use seconds + microseconds for uniqueness, fit into 10 digits
    t = int(time.time() * 1000) % 10_000_000_00
    s = f"{prefix}{t:08d}"
    return s[:10]


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
        print("\n" + "=" * 60)
        print(f"PASSED: {len(self.passed)}")
        print(f"FAILED: {len(self.failed)}")
        if self.failed:
            print("\nFAILED CASES:")
            for n, d in self.failed:
                print(f"  - {n}: {d}")
        print("=" * 60)


R = Result()


async def send_otp(client, phone, role):
    r = await client.post(f"{BASE}/auth/send-otp", json={"phone": phone, "role": role})
    return r


async def verify_otp(client, phone, role, otp, name=None):
    payload = {"phone": phone, "role": role, "otp": otp}
    if name is not None:
        payload["name"] = name
    r = await client.post(f"{BASE}/auth/verify-otp", json=payload)
    return r


async def signup_passenger(client, phone, name="Test Passenger"):
    r = await send_otp(client, phone, "passenger")
    otp = r.json()["dev_otp"]
    r2 = await verify_otp(client, phone, "passenger", otp, name=name)
    if r2.status_code != 200:
        raise RuntimeError(f"signup_passenger failed: {r2.status_code} {r2.text}")
    return r2.json()["access_token"], r2.json()["user"], otp


async def signup_driver(client, phone, name="Test Driver"):
    r = await send_otp(client, phone, "driver")
    otp = r.json()["dev_otp"]
    r2 = await verify_otp(client, phone, "driver", otp, name=name)
    if r2.status_code != 200:
        raise RuntimeError(f"signup_driver failed: {r2.status_code} {r2.text}")
    return r2.json()["access_token"], r2.json()["user"], otp


async def admin_login(client):
    r = await send_otp(client, ADMIN_PHONE, "admin")
    if r.status_code != 200:
        raise RuntimeError(f"admin send-otp failed: {r.status_code} {r.text}")
    otp = r.json()["dev_otp"]
    r2 = await verify_otp(client, ADMIN_PHONE, "admin", otp)
    if r2.status_code != 200:
        raise RuntimeError(f"admin verify-otp failed: {r2.status_code} {r2.text}")
    return r2.json()["access_token"]


# ----------- A) STICKY OTP -----------
async def test_sticky_otp(client):
    print("\n--- A) Sticky per-user OTP ---")
    phone = uniq_phone()
    r1 = await send_otp(client, phone, "passenger")
    if r1.status_code != 200:
        R.fail("A1: send-otp first call", f"{r1.status_code} {r1.text}")
        return
    x1 = r1.json().get("dev_otp")
    if not x1:
        R.fail("A1: send-otp returns dev_otp", str(r1.json()))
        return
    R.ok(f"A1: first send-otp returns dev_otp ({x1})")

    r2 = await send_otp(client, phone, "passenger")
    x2 = r2.json().get("dev_otp")
    if x1 == x2:
        R.ok(f"A2: repeat send-otp returns SAME OTP ({x2})")
    else:
        R.fail("A2: sticky OTP", f"first={x1} second={x2}")
        return

    # A3: verify with X1
    rv = await verify_otp(client, phone, "passenger", x1, name="Test Passenger")
    if rv.status_code == 200 and rv.json().get("access_token"):
        R.ok("A3: verify-otp with sticky OTP returns access_token")
    else:
        R.fail("A3: verify-otp success", f"{rv.status_code} {rv.text}")

    # A4: send-otp again post-signup → same OTP
    r3 = await send_otp(client, phone, "passenger")
    x3 = r3.json().get("dev_otp")
    if x1 == x3:
        R.ok("A4: OTP persisted in phone_otps after signup")
    else:
        R.fail("A4: OTP persisted post-signup", f"first={x1} after-signup={x3}")

    # A5: admin OTP is fixed
    ra = await send_otp(client, ADMIN_PHONE, "admin")
    if ra.status_code == 200 and ra.json().get("dev_otp") == ADMIN_OTP:
        R.ok("A5: admin OTP fixed to 123456")
    else:
        R.fail("A5: admin OTP fixed", f"{ra.status_code} {ra.text}")


# ----------- B) NAME VALIDATION -----------
async def test_name_validation(client):
    print("\n--- B) Name validation in verify-otp ---")
    phone = uniq_phone()
    r = await send_otp(client, phone, "passenger")
    otp = r.json().get("dev_otp")
    if not otp:
        R.fail("B-setup: send-otp", str(r.json()))
        return

    # B1: name with digit → 400
    r1 = await verify_otp(client, phone, "passenger", otp, name="Rohan9")
    if r1.status_code == 400 and "letters" in (r1.text or "").lower():
        R.ok("B1: name 'Rohan9' rejected with 400 mentioning 'letters'")
    else:
        R.fail("B1: 'Rohan9' should 400", f"{r1.status_code} {r1.text}")

    # B2: name with symbols only → 400
    r2 = await verify_otp(client, phone, "passenger", otp, name="@#$")
    if r2.status_code == 400:
        R.ok("B2: name '@#$' rejected with 400")
    else:
        R.fail("B2: '@#$' should 400", f"{r2.status_code} {r2.text}")

    # B5: empty name → requires_name response, OTP not consumed
    r5 = await verify_otp(client, phone, "passenger", otp, name="")
    if r5.status_code == 200 and r5.json().get("requires_name") is True and r5.json().get("is_new_user") is True:
        R.ok("B5: empty name returns requires_name=true,is_new_user=true (no 400)")
    else:
        R.fail("B5: empty name behaviour", f"{r5.status_code} {r5.text}")

    # B4 (and consumes OTP): valid name → success
    r4 = await verify_otp(client, phone, "passenger", otp, name="Rohan Sharma")
    if r4.status_code == 200 and r4.json().get("access_token"):
        R.ok("B4: 'Rohan Sharma' accepted with access_token")
    else:
        R.fail("B4: valid name should succeed", f"{r4.status_code} {r4.text}")


# ----------- C) TIP FEATURE -----------
async def admin_approve_driver(client, admin_token, driver_user_id):
    r = await client.post(
        f"{BASE}/admin/drivers/{driver_user_id}/approve",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    return r


async def submit_kyc(client, token):
    body = {
        "name": "Test Driver",
        "aadhar_number": "1234-5678-9012",
        "aadhar_photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "vehicle_no": "UP85AB1234",
        "vehicle_type": "e-rickshaw",
        "rc_photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "profile_photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "upi_id": "testdriver@upi",
    }
    r = await client.post(f"{BASE}/drivers/kyc", json=body, headers={"Authorization": f"Bearer {token}"})
    return r


async def driver_online(client, token, online=True):
    r = await client.post(
        f"{BASE}/drivers/online", json={"online": online},
        headers={"Authorization": f"Bearer {token}"},
    )
    return r


async def create_ride(client, token, pickup=None, drop=None, payment="cash", scheduled_at=None):
    body = {
        "type": "local",
        "pickup": pickup or {"name": "Govardhan Temple", "lat": 27.4985, "lng": 77.4615},
        "drop": drop or {"name": "Radha Kund", "lat": 27.5275, "lng": 77.4360},
        "distance_km": 4.2,
        "payment_method": payment,
    }
    if scheduled_at:
        body["scheduled_at"] = scheduled_at
    r = await client.post(f"{BASE}/rides", json=body, headers={"Authorization": f"Bearer {token}"})
    return r


async def test_tip(client, admin_token):
    print("\n--- C) Tip feature ---")
    # Setup passenger 1, ride
    p_phone = uniq_phone()
    p_tok, p_user, _ = await signup_passenger(client, p_phone, name="Tip Tester")

    # C1: create ride
    rc = await create_ride(client, p_tok)
    if rc.status_code != 200:
        R.fail("C1: create ride", f"{rc.status_code} {rc.text}")
        return
    ride = rc.json()
    rid = ride["id"]
    f0 = float(ride["fare"])
    R.ok(f"C1: ride created (id={rid[:8]}.., fare={f0})")

    # C2: tip 10
    r2 = await client.post(
        f"{BASE}/rides/{rid}/tip", json={"amount": 10},
        headers={"Authorization": f"Bearer {p_tok}"},
    )
    if r2.status_code == 200 and abs(float(r2.json()["fare"]) - (f0 + 10)) < 0.01 and float(r2.json()["tip"]) == 10:
        R.ok(f"C2: tip 10 → fare={r2.json()['fare']}, tip=10")
    else:
        R.fail("C2: tip 10", f"{r2.status_code} {r2.text}")

    # C3: tip 20 → cumulative
    r3 = await client.post(
        f"{BASE}/rides/{rid}/tip", json={"amount": 20},
        headers={"Authorization": f"Bearer {p_tok}"},
    )
    if r3.status_code == 200 and abs(float(r3.json()["fare"]) - (f0 + 30)) < 0.01 and float(r3.json()["tip"]) == 30:
        R.ok(f"C3: tip 20 → fare={r3.json()['fare']}, tip=30")
    else:
        R.fail("C3: tip 20 cumulative", f"{r3.status_code} {r3.text}")

    # C4: tip 100 → 400
    r4 = await client.post(
        f"{BASE}/rides/{rid}/tip", json={"amount": 100},
        headers={"Authorization": f"Bearer {p_tok}"},
    )
    if r4.status_code == 400:
        R.ok("C4: tip 100 rejected with 400")
    else:
        R.fail("C4: tip 100", f"{r4.status_code} {r4.text}")

    # C6: tip from another user (not the passenger) → 404
    other_phone = uniq_phone()
    other_tok, _, _ = await signup_passenger(client, other_phone, name="Other Person")
    r6 = await client.post(
        f"{BASE}/rides/{rid}/tip", json={"amount": 10},
        headers={"Authorization": f"Bearer {other_tok}"},
    )
    if r6.status_code == 404:
        R.ok("C6: tip by non-owner returns 404")
    else:
        R.fail("C6: tip by non-owner", f"{r6.status_code} {r6.text}")

    # C5: Driver accepts ride → tip should now fail with 400
    d_phone = uniq_phone()
    d_tok, d_user, _ = await signup_driver(client, d_phone, name="Driver Acceptor")
    rk = await submit_kyc(client, d_tok)
    if rk.status_code != 200:
        R.fail("C5-setup: KYC submit", f"{rk.status_code} {rk.text}")
        return
    ra = await admin_approve_driver(client, admin_token, d_user["id"])
    if ra.status_code != 200:
        R.fail("C5-setup: KYC approve", f"{ra.status_code} {ra.text}")
        return
    ro = await driver_online(client, d_tok, True)
    if ro.status_code != 200:
        R.fail("C5-setup: go online", f"{ro.status_code} {ro.text}")
        return
    rac = await client.post(
        f"{BASE}/rides/{rid}/accept",
        headers={"Authorization": f"Bearer {d_tok}"},
    )
    if rac.status_code != 200:
        R.fail("C5-setup: accept ride", f"{rac.status_code} {rac.text}")
        return
    r5 = await client.post(
        f"{BASE}/rides/{rid}/tip", json={"amount": 10},
        headers={"Authorization": f"Bearer {p_tok}"},
    )
    if r5.status_code == 400:
        R.ok("C5: tip after accept rejected with 400 (only requested state)")
    else:
        R.fail("C5: tip after accept", f"{r5.status_code} {r5.text}")

    # Return tokens/ride for reuse in WS test
    return {
        "passenger_token": p_tok, "passenger_phone": p_phone,
        "driver_token": d_tok, "driver_phone": d_phone, "driver_user_id": d_user["id"],
        "ride_id": rid,
    }


# ----------- D) Passenger location WS streaming -----------
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


async def test_passenger_location_ws(client, ctx):
    print("\n--- D) Passenger location streaming over WebSocket ---")
    if not ctx:
        # Fresh setup
        admin_token = await admin_login(client)
        p_phone = uniq_phone()
        d_phone = uniq_phone()
        p_tok, _, _ = await signup_passenger(client, p_phone, name="Pax Loc Tester")
        d_tok, d_user, _ = await signup_driver(client, d_phone, name="Drv Loc Tester")
        await submit_kyc(client, d_tok)
        await admin_approve_driver(client, admin_token, d_user["id"])
        await driver_online(client, d_tok, True)
        rc = await create_ride(client, p_tok)
        if rc.status_code != 200:
            R.fail("D-setup: ride", f"{rc.status_code} {rc.text}")
            return
        rid = rc.json()["id"]
        rac = await client.post(f"{BASE}/rides/{rid}/accept", headers={"Authorization": f"Bearer {d_tok}"})
        if rac.status_code != 200:
            R.fail("D-setup: accept", f"{rac.status_code} {rac.text}")
            return
    else:
        # Re-use from C — but that ride is already accepted (status=accepted)
        p_tok = ctx["passenger_token"]
        d_tok = ctx["driver_token"]
        rid = ctx["ride_id"]

    # Connect both WS
    p_ws_url = f"{WS_LOCAL}?token={p_tok}"
    d_ws_url = f"{WS_LOCAL}?token={d_tok}"
    try:
        async with websockets.connect(p_ws_url, open_timeout=5) as pws, \
                   websockets.connect(d_ws_url, open_timeout=5) as dws:
            # Drain hello frames
            await asyncio.wait_for(pws.recv(), timeout=3)
            await asyncio.wait_for(dws.recv(), timeout=3)
            R.ok("D2-3: passenger + driver WS connected")

            # Passenger sends location
            payload = {"type": "location", "lat": 27.5, "lng": 77.45}
            await pws.send(json.dumps(payload))

            # Driver should receive passenger_location
            m, msgs = await recv_until(
                dws,
                lambda x: x.get("type") == "passenger_location",
                timeout=3.0,
            )
            if m and m.get("ride_id") == rid and abs(m.get("lat") - 27.5) < 1e-6 and abs(m.get("lng") - 77.45) < 1e-6:
                R.ok("D4-5: driver received passenger_location with correct ride_id/lat/lng")
            else:
                R.fail("D4-5: driver passenger_location event", f"got={m} all={msgs}")
    except Exception as e:
        R.fail("D2-5: WS connect/recv", str(e))
        return

    # D6: persistence — GET /rides/{id} as driver
    await asyncio.sleep(0.3)  # ensure write committed
    rg = await client.get(f"{BASE}/rides/{rid}", headers={"Authorization": f"Bearer {d_tok}"})
    if rg.status_code == 200:
        pl = rg.json().get("passenger_location")
        if pl and abs(pl.get("lat") - 27.5) < 1e-6 and abs(pl.get("lng") - 77.45) < 1e-6:
            R.ok(f"D6: GET /rides/{{id}} returns passenger_location {pl}")
        else:
            R.fail("D6: passenger_location persisted", f"resp={rg.json()}")
    else:
        R.fail("D6: GET ride", f"{rg.status_code} {rg.text}")


# ----------- E) REGRESSION -----------
async def test_regression(client, admin_token):
    print("\n--- E) Regression ---")

    # E1: full ride lifecycle: create → accept → verify-pin → complete
    p_phone = uniq_phone()
    d_phone = uniq_phone()
    p_tok, _, _ = await signup_passenger(client, p_phone, name="Regression Pax")
    d_tok, d_user, _ = await signup_driver(client, d_phone, name="Regression Drv")
    await submit_kyc(client, d_tok)
    await admin_approve_driver(client, admin_token, d_user["id"])
    await driver_online(client, d_tok, True)

    rc = await create_ride(client, p_tok)
    if rc.status_code != 200:
        R.fail("E1: create_ride", f"{rc.status_code} {rc.text}")
        return
    ride = rc.json()
    rid, pin = ride["id"], ride["pin"]

    rac = await client.post(f"{BASE}/rides/{rid}/accept", headers={"Authorization": f"Bearer {d_tok}"})
    if rac.status_code != 200:
        R.fail("E1: accept", f"{rac.status_code} {rac.text}")
        return
    rvp = await client.post(
        f"{BASE}/rides/{rid}/verify-pin", json={"pin": pin},
        headers={"Authorization": f"Bearer {d_tok}"},
    )
    if rvp.status_code != 200:
        R.fail("E1: verify-pin", f"{rvp.status_code} {rvp.text}")
        return
    rcp = await client.post(f"{BASE}/rides/{rid}/complete", headers={"Authorization": f"Bearer {d_tok}"})
    if rcp.status_code == 200:
        R.ok("E1: ride lifecycle create→accept→verify-pin→complete")
    else:
        R.fail("E1: complete", f"{rcp.status_code} {rcp.text}")

    # E2: ratings & complaints
    rr = await client.post(
        f"{BASE}/rides/{rid}/rate", json={"stars": 5, "comment": "Great"},
        headers={"Authorization": f"Bearer {p_tok}"},
    )
    if rr.status_code == 200 and rr.json().get("stars") == 5:
        R.ok("E2a: rate ride 5 stars")
    else:
        R.fail("E2a: rate ride", f"{rr.status_code} {rr.text}")
    rco = await client.post(
        f"{BASE}/rides/{rid}/complaint",
        json={"category": "rash_driving", "description": "Just regression", "against": "driver"},
        headers={"Authorization": f"Bearer {p_tok}"},
    )
    if rco.status_code == 200:
        R.ok("E2b: file complaint")
    else:
        R.fail("E2b: complaint", f"{rco.status_code} {rco.text}")

    # E3: geo
    rs = await client.get(f"{BASE}/geo/search", params={"q": "govardhan"})
    if rs.status_code == 200 and isinstance(rs.json().get("results"), list) and len(rs.json()["results"]) >= 1:
        R.ok("E3a: /geo/search?q=govardhan returns results")
    else:
        R.fail("E3a: /geo/search", f"{rs.status_code} {rs.text[:200]}")

    rrt = await client.get(
        f"{BASE}/geo/route",
        params={"from_lat": 27.4985, "from_lng": 77.4615, "to_lat": 27.5275, "to_lng": 77.4360},
    )
    if rrt.status_code == 200 and rrt.json().get("distance_km", 0) > 0:
        R.ok(f"E3b: /geo/route returns distance_km={rrt.json().get('distance_km')}")
    else:
        R.fail("E3b: /geo/route", f"{rrt.status_code} {rrt.text[:200]}")

    # E4: admin dashboard
    rd = await client.get(f"{BASE}/admin/dashboard", headers={"Authorization": f"Bearer {admin_token}"})
    if rd.status_code == 200 and "total_rides" in rd.json():
        R.ok("E4: /admin/dashboard")
    else:
        R.fail("E4: /admin/dashboard", f"{rd.status_code} {rd.text}")

    # E4b: report endpoints
    rt = await client.get(f"{BASE}/admin/reports/timeseries?days=7", headers={"Authorization": f"Bearer {admin_token}"})
    if rt.status_code == 200 and "series" in rt.json():
        R.ok("E4b: /admin/reports/timeseries")
    else:
        R.fail("E4b: reports/timeseries", f"{rt.status_code} {rt.text}")
    rl = await client.get(f"{BASE}/admin/reports/leaderboard", headers={"Authorization": f"Bearer {admin_token}"})
    if rl.status_code == 200 and "leaderboard" in rl.json():
        R.ok("E4c: /admin/reports/leaderboard")
    else:
        R.fail("E4c: reports/leaderboard", f"{rl.status_code} {rl.text}")

    # E5: WS driver_location forwarded to passenger (existing flow)
    # Set up a fresh ride to test
    p2_phone = uniq_phone()
    d2_phone = uniq_phone()
    p2_tok, _, _ = await signup_passenger(client, p2_phone, name="WS Test Pax")
    d2_tok, d2_user, _ = await signup_driver(client, d2_phone, name="WS Test Drv")
    await submit_kyc(client, d2_tok)
    await admin_approve_driver(client, admin_token, d2_user["id"])
    await driver_online(client, d2_tok, True)
    rc2 = await create_ride(client, p2_tok)
    if rc2.status_code != 200:
        R.fail("E5-setup: create_ride", f"{rc2.status_code} {rc2.text}")
        return
    rid2 = rc2.json()["id"]
    rac2 = await client.post(f"{BASE}/rides/{rid2}/accept", headers={"Authorization": f"Bearer {d2_tok}"})
    if rac2.status_code != 200:
        R.fail("E5-setup: accept", f"{rac2.status_code} {rac2.text}")
        return
    try:
        async with websockets.connect(f"{WS_LOCAL}?token={p2_tok}", open_timeout=5) as pws, \
                   websockets.connect(f"{WS_LOCAL}?token={d2_tok}", open_timeout=5) as dws:
            await asyncio.wait_for(pws.recv(), timeout=3)
            await asyncio.wait_for(dws.recv(), timeout=3)
            await dws.send(json.dumps({"type": "location", "lat": 27.51, "lng": 77.46}))
            m, msgs = await recv_until(
                pws,
                lambda x: x.get("type") == "driver_location",
                timeout=3.0,
            )
            if m and m.get("ride_id") == rid2 and abs(m.get("lat") - 27.51) < 1e-6:
                R.ok("E5: WS driver_location forwarded to passenger")
            else:
                R.fail("E5: driver_location", f"got={m} all={msgs}")
    except Exception as e:
        R.fail("E5: WS connection", str(e))


async def main():
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        print(f"BASE = {BASE}")
        print(f"WS   = {WS_LOCAL}")
        admin_token = await admin_login(client)
        print(f"admin_token acquired ({admin_token[:12]}..)")

        await test_sticky_otp(client)
        await test_name_validation(client)
        ctx = await test_tip(client, admin_token)
        await test_passenger_location_ws(client, ctx)
        await test_regression(client, admin_token)

    R.summary()
    return 0 if not R.failed else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
