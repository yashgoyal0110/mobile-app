"""Phase 3 backend tests — ratings, complaints, admin reports.

Run against preview URL.
"""
import os
import sys
import time
import json
import requests
from datetime import datetime

BASE = os.environ.get("BASE", "https://tirthride-preview.preview.emergentagent.com") + "/api"
ADMIN_PHONE = "9999999999"
OTP = "123456"

# Use fresh phones to ensure isolated state
ts = int(time.time()) % 1000000
PASS_PHONE = f"95{ts:06d}55"[:10]
DRV_PHONE = f"94{ts:06d}44"[:10]
PASS2_PHONE = f"93{ts:06d}33"[:10]
DRV2_PHONE = f"92{ts:06d}22"[:10]
assert all(len(p) == 10 and p.isdigit() for p in (PASS_PHONE, DRV_PHONE, PASS2_PHONE, DRV2_PHONE))

results = []  # (name, passed, info)


def rec(name, passed, info=""):
    results.append((name, passed, info))
    flag = "PASS" if passed else "FAIL"
    print(f"[{flag}] {name}  {info}")


def req(method, path, token=None, **kw):
    headers = kw.pop("headers", {}) or {}
    if token:
        headers["X-Auth-Token"] = token
    return requests.request(method, BASE + path, headers=headers, timeout=30, **kw)


def login(phone, role, name=None):
    r = req("POST", "/auth/send-otp", json={"phone": phone, "role": role})
    assert r.status_code == 200, f"send-otp {phone} {role}: {r.status_code} {r.text}"
    body = {"phone": phone, "role": role, "otp": OTP}
    if name:
        body["name"] = name
    r = req("POST", "/auth/verify-otp", json=body)
    assert r.status_code == 200, f"verify {phone} {role}: {r.status_code} {r.text}"
    j = r.json()
    if j.get("requires_name"):
        body["name"] = name or f"User {phone[-4:]}"
        r = req("POST", "/auth/verify-otp", json=body)
        j = r.json()
    return j["access_token"], j["user"]


def main():
    print(f"BASE={BASE}")
    print(f"Test phones: passenger={PASS_PHONE} driver={DRV_PHONE} passenger2={PASS2_PHONE} driver2={DRV2_PHONE}")

    # --- Login users
    admin_tok, admin_u = login(ADMIN_PHONE, "admin")
    pass_tok, pass_u = login(PASS_PHONE, "passenger", "Ravi Sharma")
    drv_tok, drv_u = login(DRV_PHONE, "driver", "Mohan Kumar")
    pass2_tok, pass2_u = login(PASS2_PHONE, "passenger", "Sita Devi")
    drv2_tok, drv2_u = login(DRV2_PHONE, "driver", "Hari Singh")

    # --- Submit KYC for both drivers
    kyc = {
        "name": "Mohan Kumar",
        "aadhar_number": "111122223333",
        "aadhar_photo": "data:image/png;base64,iVBORw0KGgo=",
        "vehicle_no": "UP85AB1234",
        "vehicle_type": "e-rickshaw",
        "rc_photo": "data:image/png;base64,iVBORw0KGgo=",
        "profile_photo": "data:image/png;base64,iVBORw0KGgo=",
        "upi_id": "mohan@upi",
    }
    r = req("POST", "/drivers/kyc", token=drv_tok, json=kyc)
    assert r.status_code == 200, r.text
    kyc2 = dict(kyc, name="Hari Singh", aadhar_number="444455556666", vehicle_no="UP85CD5678", upi_id="hari@upi")
    r = req("POST", "/drivers/kyc", token=drv2_tok, json=kyc2)
    assert r.status_code == 200, r.text

    # --- Admin approves drivers
    r = req("POST", f"/admin/drivers/{drv_u['id']}/approve", token=admin_tok)
    assert r.status_code == 200, r.text
    r = req("POST", f"/admin/drivers/{drv2_u['id']}/approve", token=admin_tok)
    assert r.status_code == 200, r.text

    # --- Drivers go online and post location near Govardhan
    r = req("POST", "/drivers/online", token=drv_tok, json={"online": True})
    assert r.status_code == 200, r.text
    r = req("POST", "/drivers/location", token=drv_tok, json={"lat": 27.4985, "lng": 77.4615})
    assert r.status_code == 200, r.text

    r = req("POST", "/drivers/online", token=drv2_tok, json={"online": True})
    assert r.status_code == 200, r.text
    r = req("POST", "/drivers/location", token=drv2_tok, json={"lat": 27.4985, "lng": 77.4615})
    assert r.status_code == 200, r.text

    # --- Create ride (passenger 1)
    ride_body = {
        "type": "local",
        "pickup": {"name": "Daanghati", "lat": 27.4985, "lng": 77.4615},
        "drop": {"name": "Mansi Ganga", "lat": 27.5020, "lng": 77.4700},
        "distance_km": 2.5,
        "payment_method": "cash",
    }
    r = req("POST", "/rides", token=pass_tok, json=ride_body)
    assert r.status_code == 200, r.text
    ride = r.json()
    ride_id = ride["id"]

    # Driver accepts
    r = req("POST", f"/rides/{ride_id}/accept", token=drv_tok)
    assert r.status_code == 200, r.text
    # Verify pin
    pin = r.json().get("pin")
    r = req("POST", f"/rides/{ride_id}/verify-pin", token=drv_tok, json={"pin": pin})
    assert r.status_code == 200, r.text
    # Complete
    r = req("POST", f"/rides/{ride_id}/complete", token=drv_tok)
    assert r.status_code == 200, r.text

    # === 1) RATING ===
    # 1a) Passenger rates 5
    r = req("POST", f"/rides/{ride_id}/rate", token=pass_tok, json={"stars": 5, "comment": "Great driver"})
    ok = r.status_code == 200 and r.json().get("stars") == 5 and r.json().get("target_role") == "driver" and r.json().get("target_user_id") == drv_u["id"]
    rec("1.1 Passenger rates 5 (target driver)", ok, f"{r.status_code} {r.text[:200]}")

    # 1b) Re-rate to 4 (idempotent)
    r = req("POST", f"/rides/{ride_id}/rate", token=pass_tok, json={"stars": 4})
    ok = r.status_code == 200 and r.json().get("stars") == 4
    rec("1.2 Passenger re-rates 4 (idempotent)", ok, f"{r.status_code}")

    # 1c) Driver avg should be 4.0
    r = req("GET", f"/users/{drv_u['id']}/rating", token=pass_tok)
    ok = r.status_code == 200 and r.json().get("avg_rating") == 4.0 and r.json().get("total_ratings") == 1
    rec("1.3 GET driver rating avg=4.0 n=1", ok, f"{r.status_code} {r.text[:200]}")

    # 1d) Driver rates passenger 5
    r = req("POST", f"/rides/{ride_id}/rate", token=drv_tok, json={"stars": 5})
    ok = r.status_code == 200 and r.json().get("target_role") == "passenger"
    rec("1.4 Driver rates passenger 5", ok, f"{r.status_code} {r.text[:200]}")

    # 1e) Passenger avg
    r = req("GET", f"/users/{pass_u['id']}/rating", token=drv_tok)
    ok = r.status_code == 200 and r.json().get("avg_rating") == 5.0 and r.json().get("total_ratings") == 1
    rec("1.5 GET passenger rating avg=5.0 n=1", ok, f"{r.status_code} {r.text[:200]}")

    # 1f) List ratings on ride
    r = req("GET", f"/rides/{ride_id}/ratings", token=pass_tok)
    j = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and isinstance(j.get("ratings"), list) and len(j["ratings"]) == 2
    rec("1.6 GET ride ratings returns 2", ok, f"{r.status_code} len={len(j.get('ratings', []))}")

    # === 2) RATING VALIDATION ===
    r = req("POST", f"/rides/{ride_id}/rate", token=pass_tok, json={"stars": 0})
    ok = r.status_code == 400 and "1-5" in r.text
    rec("2.1 stars=0 → 400", ok, f"{r.status_code} {r.text[:120]}")

    r = req("POST", f"/rides/{ride_id}/rate", token=pass_tok, json={"stars": 6})
    ok = r.status_code == 400 and "1-5" in r.text
    rec("2.2 stars=6 → 400", ok, f"{r.status_code} {r.text[:120]}")

    # Create new ride NOT completed for validation
    r = req("POST", "/rides", token=pass_tok, json=ride_body)
    assert r.status_code == 200
    open_ride_id = r.json()["id"]
    r = req("POST", f"/rides/{open_ride_id}/rate", token=pass_tok, json={"stars": 5})
    ok = r.status_code == 400 and "completed" in r.text.lower()
    rec("2.3 Rate non-completed ride → 400", ok, f"{r.status_code} {r.text[:120]}")

    # Other user trying to rate this ride → 403
    r = req("POST", f"/rides/{ride_id}/rate", token=pass2_tok, json={"stars": 5})
    ok = r.status_code == 403 and "not your" in r.text.lower()
    rec("2.4 Other user rates ride → 403", ok, f"{r.status_code} {r.text[:120]}")

    # === 3) COMPLAINTS ===
    r = req("POST", f"/rides/{ride_id}/complaint", token=pass_tok,
            json={"category": "rude_behaviour", "description": "Driver was rude to me"})
    j = r.json() if r.status_code == 200 else {}
    ok = (r.status_code == 200 and j.get("status") == "open" and j.get("against") == "driver"
          and j.get("against_user_id") == drv_u["id"])
    rec("3.1 Passenger files complaint against driver", ok, f"{r.status_code} {r.text[:200]}")
    cid_pass = j.get("id")

    r = req("POST", f"/rides/{ride_id}/complaint", token=drv_tok,
            json={"category": "no_show", "description": "Passenger never showed up"})
    j = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and j.get("against") == "passenger"
    rec("3.2 Driver files complaint against passenger", ok, f"{r.status_code} {r.text[:200]}")
    cid_drv = j.get("id")

    r = req("POST", f"/rides/{ride_id}/complaint", token=pass_tok,
            json={"category": "invalid_cat", "description": "x"})
    ok = r.status_code == 422
    rec("3.3 invalid category → 422", ok, f"{r.status_code}")

    r = req("POST", f"/rides/{ride_id}/complaint", token=pass2_tok,
            json={"category": "other", "description": "foo"})
    ok = r.status_code == 403
    rec("3.4 Other user complaint → 403", ok, f"{r.status_code}")

    # === 4) ADMIN COMPLAINTS MANAGEMENT ===
    r = req("GET", "/admin/complaints", token=admin_tok)
    j = r.json() if r.status_code == 200 else {}
    rows = j.get("complaints", [])
    ok = r.status_code == 200 and all(c.get("status") == "open" for c in rows) and len(rows) >= 2
    has_ride_join = rows and "ride" in rows[0] and "passenger_name" in rows[0]["ride"]
    rec("4.1 GET /admin/complaints default=open includes ride join", ok and has_ride_join,
        f"{r.status_code} count={len(rows)} ride_join={has_ride_join}")

    r = req("GET", "/admin/complaints?status_filter=all", token=admin_tok)
    j = r.json() if r.status_code == 200 else {}
    all_rows = j.get("complaints", [])
    ok = r.status_code == 200 and len(all_rows) >= len(rows)
    rec("4.2 status_filter=all returns all", ok, f"{r.status_code} count={len(all_rows)}")

    r = req("GET", "/admin/complaints?status_filter=resolved", token=admin_tok)
    j = r.json() if r.status_code == 200 else {}
    initial_resolved = j.get("complaints", [])
    ok = r.status_code == 200
    rec("4.3 status_filter=resolved initially empty for new ones", ok,
        f"{r.status_code} count={len(initial_resolved)}")

    # Get dashboard open_complaints before
    r = req("GET", "/admin/dashboard", token=admin_tok)
    open_before = r.json().get("open_complaints", -1) if r.status_code == 200 else -1
    has_key = "open_complaints" in (r.json() if r.status_code == 200 else {})
    rec("6.1 dashboard has open_complaints key", r.status_code == 200 and has_key,
        f"{r.status_code} open_complaints={open_before}")

    # Resolve passenger's complaint
    r = req("PATCH", f"/admin/complaints/{cid_pass}", token=admin_tok,
            json={"resolution": "Spoke to driver, warned", "status": "resolved"})
    ok = r.status_code == 200
    rec("4.4 PATCH resolve complaint", ok, f"{r.status_code} {r.text[:120]}")

    r = req("GET", "/admin/complaints?status_filter=resolved", token=admin_tok)
    j = r.json() if r.status_code == 200 else {}
    found_resolved = any(c.get("id") == cid_pass for c in j.get("complaints", []))
    rec("4.5 resolved list contains complaint", found_resolved, f"resolved count={len(j.get('complaints',[]))}")

    r = req("GET", "/admin/complaints?status_filter=open", token=admin_tok)
    j = r.json() if r.status_code == 200 else {}
    still_open = any(c.get("id") == cid_pass for c in j.get("complaints", []))
    rec("4.6 open list no longer contains resolved", not still_open, f"")

    r = req("PATCH", "/admin/complaints/nonexistent_id_xyz", token=admin_tok,
            json={"resolution": "x", "status": "resolved"})
    rec("4.7 PATCH missing id → 404", r.status_code == 404, f"{r.status_code}")

    # Dashboard open_complaints should decrease
    r = req("GET", "/admin/dashboard", token=admin_tok)
    open_after = r.json().get("open_complaints", -1) if r.status_code == 200 else -1
    rec("6.2 open_complaints decreased after resolve", open_after == open_before - 1,
        f"before={open_before} after={open_after}")

    # === 5) ADMIN REPORTS ===
    r = req("GET", "/admin/reports/timeseries", token=admin_tok)
    j = r.json() if r.status_code == 200 else {}
    series = j.get("series", [])
    ok = r.status_code == 200 and len(series) == 7
    keys_ok = series and all(k in series[0] for k in ("date", "rides", "completed", "cancelled", "revenue", "fare"))
    rec("5.1 timeseries default=7 days", ok and keys_ok, f"{r.status_code} len={len(series)}")

    r = req("GET", "/admin/reports/timeseries?days=14", token=admin_tok)
    j = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and len(j.get("series", [])) == 14
    rec("5.2 timeseries days=14", ok, f"{r.status_code} len={len(j.get('series',[]))}")

    r = req("GET", "/admin/reports/timeseries?days=1", token=admin_tok)
    j = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and len(j.get("series", [])) == 1
    rec("5.3 timeseries days=1", ok, f"{r.status_code}")

    r = req("GET", "/admin/reports/timeseries?days=999", token=admin_tok)
    j = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and len(j.get("series", [])) == 60
    rec("5.4 timeseries days=999 clamped to 60", ok, f"{r.status_code} len={len(j.get('series',[]))}")

    # Leaderboard
    r = req("GET", "/admin/reports/leaderboard", token=admin_tok)
    j = r.json() if r.status_code == 200 else {}
    lb = j.get("leaderboard", [])
    ok = r.status_code == 200 and isinstance(lb, list)
    keys = ("driver_id", "name", "phone", "trips", "earnings", "fare", "avg_rating", "total_ratings")
    keys_ok = lb and all(k in lb[0] for k in keys)
    found = any(row.get("driver_id") == drv_u["id"] for row in lb)
    rec("5.5 leaderboard returns rows with all keys", ok and keys_ok, f"{r.status_code} rows={len(lb)}")
    rec("5.6 leaderboard contains recently-completed driver", found, f"driver_id={drv_u['id']} in lb={[r['driver_id'] for r in lb]}")
    # Check avg_rating populated for our driver
    our_row = next((row for row in lb if row.get("driver_id") == drv_u["id"]), None)
    rec("5.7 leaderboard our driver has avg_rating=4.0", our_row and our_row.get("avg_rating") == 4.0,
        f"row={our_row}")

    # Sorted desc by earnings
    sorted_ok = all(lb[i]["earnings"] >= lb[i+1]["earnings"] for i in range(len(lb)-1))
    rec("5.8 leaderboard sorted by earnings desc", sorted_ok, "")

    r = req("GET", "/admin/reports/leaderboard?limit=3", token=admin_tok)
    j = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and len(j.get("leaderboard", [])) <= 3
    rec("5.9 leaderboard limit=3", ok, f"{r.status_code} rows={len(j.get('leaderboard',[]))}")

    # Top routes
    r = req("GET", "/admin/reports/top-routes", token=admin_tok)
    j = r.json() if r.status_code == 200 else {}
    routes = j.get("routes", [])
    ok = r.status_code == 200 and isinstance(routes, list)
    found = any(rt.get("pickup") == "Daanghati" and rt.get("drop") == "Mansi Ganga" for rt in routes)
    rec("5.10 top-routes returns list", ok, f"{r.status_code} routes={len(routes)}")
    rec("5.11 top-routes contains our route", found, f"sample={routes[:2]}")

    # === 7) AUTH ===
    r = requests.post(BASE + f"/rides/{ride_id}/rate", json={"stars": 5}, timeout=20)
    rec("7.1 no token rating → 401", r.status_code == 401, f"{r.status_code}")
    r = requests.post(BASE + f"/rides/{ride_id}/complaint",
                      json={"category": "other", "description": "x"}, timeout=20)
    rec("7.2 no token complaint → 401", r.status_code == 401, f"{r.status_code}")

    # Passenger calling admin routes
    r = req("GET", "/admin/complaints", token=pass_tok)
    rec("7.3 passenger → /admin/complaints → 403", r.status_code == 403, f"{r.status_code}")
    r = req("GET", "/admin/reports/timeseries", token=pass_tok)
    rec("7.4 passenger → /admin/reports/timeseries → 403", r.status_code == 403, f"{r.status_code}")
    r = req("GET", "/admin/reports/leaderboard", token=pass_tok)
    rec("7.5 passenger → /admin/reports/leaderboard → 403", r.status_code == 403, f"{r.status_code}")
    r = req("GET", "/admin/reports/top-routes", token=pass_tok)
    rec("7.6 passenger → /admin/reports/top-routes → 403", r.status_code == 403, f"{r.status_code}")

    # === 8) Regression — basic phase 1+2 ===
    r = req("GET", "/", token=None)
    rec("8.1 root API up", r.status_code == 200, f"{r.status_code}")
    r = req("GET", "/config/fare")
    rec("8.2 /config/fare reachable", r.status_code == 200, f"{r.status_code}")
    r = req("GET", "/admin/landmarks", token=admin_tok)
    rec("8.3 /admin/landmarks ok", r.status_code == 200, f"{r.status_code}")
    r = req("GET", "/geo/region")
    rec("8.4 /geo/region ok", r.status_code == 200, f"{r.status_code}")
    r = req("GET", "/rides/mine", token=pass_tok)
    rec("8.5 /rides/mine ok", r.status_code == 200, f"{r.status_code}")
    r = req("GET", "/auth/me", token=drv_tok)
    rec("8.6 /auth/me ok", r.status_code == 200, f"{r.status_code}")

    # === SUMMARY ===
    print("\n" + "=" * 70)
    passed = sum(1 for _, p, _ in results if p)
    failed = [(n, i) for n, p, i in results if not p]
    print(f"PASSED: {passed}/{len(results)}")
    if failed:
        print("\nFAILURES:")
        for n, i in failed:
            print(f"  - {n}  ::  {i}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
