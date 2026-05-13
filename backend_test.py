"""TirthRide backend test suite.

Tests against the external preview URL configured in frontend/.env (EXPO_PUBLIC_BACKEND_URL).
All routes are prefixed with /api.
"""
import os
import random
import string
import sys
import time
from typing import Any, Dict, Optional

import requests

BASE = "https://tirthride-preview.preview.emergentagent.com/api"
OTP = "123456"
ADMIN_PHONE = "9999999999"


# ---------- helpers ----------
def H(token: Optional[str] = None) -> Dict[str, str]:
    h = {"Content-Type": "application/json"}
    if token:
        h["X-Auth-Token"] = token
    return h


def rand_phone(prefix="95") -> str:
    return prefix + "".join(random.choices(string.digits, k=10 - len(prefix)))


PASS = []
FAIL = []


def check(name: str, cond: bool, detail: str = ""):
    if cond:
        PASS.append(name)
        print(f"  PASS  {name}")
    else:
        FAIL.append((name, detail))
        print(f"  FAIL  {name}  | {detail}")
    return cond


def login(phone: str, role: str, name: Optional[str] = None) -> Dict[str, Any]:
    requests.post(f"{BASE}/auth/send-otp", json={"phone": phone, "role": role}, timeout=15)
    body = {"phone": phone, "role": role, "otp": OTP}
    if name:
        body["name"] = name
    r = requests.post(f"{BASE}/auth/verify-otp", json=body, timeout=15)
    return r.json()


# ---------- 1. Smoke ----------
def test_smoke():
    print("\n=== 1. Smoke ===")
    r = requests.get(f"{BASE}/", timeout=10)
    check("GET /api/ returns 200", r.status_code == 200, f"status={r.status_code}")
    j = r.json()
    check("GET /api/ has app=TirthRide", j.get("app") == "TirthRide", str(j))
    check("GET /api/ has version 1.0.0", j.get("version") == "1.0.0", str(j))

    r = requests.get(f"{BASE}/config/fare", timeout=15)
    check("GET /api/config/fare 200", r.status_code == 200, f"status={r.status_code}")
    cfg = r.json()
    check("fare config has base_fare", "base_fare" in cfg, str(cfg)[:200])
    check("fare config landmarks list >=10",
          isinstance(cfg.get("landmarks"), list) and len(cfg["landmarks"]) >= 10,
          f"landmarks_count={len(cfg.get('landmarks', []))}")


# ---------- 2. Auth name-collection ----------
def test_auth_name_collection():
    print("\n=== 2. Auth name-collection ===")
    phone = rand_phone("9555")
    # send-otp
    r = requests.post(f"{BASE}/auth/send-otp", json={"phone": phone, "role": "passenger"}, timeout=15)
    check("send-otp passenger 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        check("send-otp returns dev_otp=123456", r.json().get("dev_otp") == OTP, str(r.json()))

    # verify-otp without name
    r = requests.post(f"{BASE}/auth/verify-otp",
                      json={"phone": phone, "role": "passenger", "otp": OTP}, timeout=15)
    check("verify-otp (no name) returns 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    j = r.json() if r.status_code == 200 else {}
    check("verify-otp (no name) requires_name=True", j.get("requires_name") is True, str(j))
    check("verify-otp (no name) is_new_user=True", j.get("is_new_user") is True, str(j))
    check("verify-otp (no name) no access_token", "access_token" not in j, str(j))

    # OTP must NOT be consumed - try again with no name, must still return requires_name
    r = requests.post(f"{BASE}/auth/verify-otp",
                      json={"phone": phone, "role": "passenger", "otp": OTP}, timeout=15)
    j = r.json() if r.status_code == 200 else {}
    check("OTP not consumed after requires_name response", j.get("requires_name") is True,
          f"status={r.status_code} body={r.text[:200]}")

    # verify-otp with name
    r = requests.post(f"{BASE}/auth/verify-otp",
                      json={"phone": phone, "role": "passenger", "otp": OTP, "name": "Test User"}, timeout=15)
    check("verify-otp (with name) 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    j = r.json() if r.status_code == 200 else {}
    check("verify-otp (with name) has access_token", bool(j.get("access_token")), str(j)[:200])
    check("verify-otp (with name) is_new_user=True", j.get("is_new_user") is True, str(j)[:200])
    check("verify-otp (with name) user.name=Test User",
          (j.get("user") or {}).get("name") == "Test User", str(j)[:200])

    # role conflict: same phone as driver should 403
    requests.post(f"{BASE}/auth/send-otp", json={"phone": phone, "role": "driver"}, timeout=15)
    r = requests.post(f"{BASE}/auth/verify-otp",
                      json={"phone": phone, "role": "driver", "otp": OTP, "name": "X"}, timeout=15)
    check("role conflict returns 403", r.status_code == 403, f"status={r.status_code} body={r.text[:200]}")

    # admin: seeded user, no name needed
    r = requests.post(f"{BASE}/auth/send-otp", json={"phone": ADMIN_PHONE, "role": "admin"}, timeout=15)
    check("admin send-otp 200", r.status_code == 200, f"status={r.status_code}")
    r = requests.post(f"{BASE}/auth/verify-otp",
                      json={"phone": ADMIN_PHONE, "role": "admin", "otp": OTP}, timeout=15)
    check("admin verify-otp 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    j = r.json() if r.status_code == 200 else {}
    check("admin returns access_token w/o name", bool(j.get("access_token")), str(j)[:200])
    return j.get("access_token")


# ---------- 3. Geo endpoints ----------
def test_geo():
    print("\n=== 3. Geo endpoints ===")
    r = requests.get(f"{BASE}/geo/region", timeout=15)
    check("GET /geo/region 200", r.status_code == 200, f"status={r.status_code}")
    j = r.json() if r.status_code == 200 else {}
    bbox = j.get("bbox", {})
    check("geo/region has bbox with N/S/E/W",
          all(k in bbox for k in ("south", "north", "west", "east")), str(j))
    check("geo/region has center", "center" in j, str(j))
    check("geo/region provider=osm", j.get("provider") == "osm", str(j))

    r = requests.get(f"{BASE}/geo/search", params={"q": "radha kund"}, timeout=20)
    check("GET /geo/search radha kund 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    j = r.json() if r.status_code == 200 else {}
    results = j.get("results", [])
    check("geo/search radha kund >= 1 result", len(results) >= 1, f"count={len(results)}")
    if results:
        first = results[0]
        check("geo/search result has name/address/lat/lng",
              all(k in first for k in ("name", "address", "lat", "lng")), str(first))

    r = requests.get(f"{BASE}/geo/search", params={"q": "deeg"}, timeout=20)
    check("GET /geo/search deeg 200", r.status_code == 200, f"status={r.status_code}")
    j = r.json() if r.status_code == 200 else {}
    check("geo/search deeg returns >=1 result",
          len(j.get("results", [])) >= 1, f"count={len(j.get('results', []))} body={r.text[:300]}")

    r = requests.get(f"{BASE}/geo/reverse", params={"lat": 27.4985, "lng": 77.4615}, timeout=20)
    check("GET /geo/reverse 200", r.status_code == 200, f"status={r.status_code}")
    j = r.json() if r.status_code == 200 else {}
    check("geo/reverse returns name/address/lat/lng",
          all(k in j for k in ("name", "address", "lat", "lng")), str(j)[:300])

    r = requests.get(f"{BASE}/geo/route",
                     params={"from_lat": 27.4985, "from_lng": 77.4615,
                             "to_lat": 27.5470, "to_lng": 77.4520}, timeout=25)
    check("GET /geo/route 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    j = r.json() if r.status_code == 200 else {}
    check("geo/route distance_km > 5",
          isinstance(j.get("distance_km"), (int, float)) and j["distance_km"] > 5,
          f"distance_km={j.get('distance_km')}")
    check("geo/route duration_min > 0",
          isinstance(j.get("duration_min"), (int, float)) and j["duration_min"] > 0,
          f"duration_min={j.get('duration_min')}")
    pl = j.get("polyline", [])
    check("geo/route polyline >= 2 points", isinstance(pl, list) and len(pl) >= 2, f"len={len(pl)}")
    check("geo/route source=osrm", j.get("source") == "osrm",
          f"source={j.get('source')} (note: 'fallback' would mean OSRM failed)")


# ---------- 4. Admin landmarks CRUD ----------
def test_admin_landmarks(admin_token: str):
    print("\n=== 4. Admin landmarks CRUD ===")
    if not admin_token:
        FAIL.append(("admin landmarks", "no admin token"))
        return
    r = requests.get(f"{BASE}/admin/landmarks", headers=H(admin_token), timeout=15)
    check("GET /admin/landmarks 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    j = r.json() if r.status_code == 200 else {}
    initial_count = len(j.get("landmarks", []))
    check("admin/landmarks initial count >= 10", initial_count >= 10, f"count={initial_count}")

    r = requests.post(f"{BASE}/admin/landmarks", headers=H(admin_token),
                      json={"name": "QA Test Landmark", "lat": 27.50, "lng": 77.46}, timeout=15)
    check("POST /admin/landmarks 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    new = r.json() if r.status_code == 200 else {}
    lid = new.get("id")
    check("POST returns id+name+lat+lng",
          all(k in new for k in ("id", "name", "lat", "lng")), str(new))

    if lid:
        r = requests.patch(f"{BASE}/admin/landmarks/{lid}", headers=H(admin_token),
                           json={"name": "QA Updated"}, timeout=15)
        check("PATCH /admin/landmarks 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

        r = requests.get(f"{BASE}/admin/landmarks", headers=H(admin_token), timeout=15)
        lms = r.json().get("landmarks", [])
        updated = next((x for x in lms if x.get("id") == lid), None)
        check("Updated landmark name=QA Updated",
              updated and updated.get("name") == "QA Updated", str(updated))

        r = requests.delete(f"{BASE}/admin/landmarks/{lid}", headers=H(admin_token), timeout=15)
        check("DELETE /admin/landmarks 200", r.status_code == 200, f"status={r.status_code}")

        r = requests.get(f"{BASE}/admin/landmarks", headers=H(admin_token), timeout=15)
        final_count = len(r.json().get("landmarks", []))
        check("Landmark count restored after delete",
              final_count == initial_count, f"initial={initial_count} final={final_count}")


# ---------- 5. Ride flow regression ----------
def test_ride_flow(admin_token: str):
    print("\n=== 5. Ride flow regression ===")
    # passenger
    p_phone = rand_phone("9555")
    p = login(p_phone, "passenger", name="Ravi Passenger")
    p_tok = p.get("access_token")
    if not check("Passenger login ok", bool(p_tok), str(p)[:200]):
        return

    # passenger creates local ride
    body = {
        "type": "local",
        "pickup": {"name": "Mukharvind Mandir", "lat": 27.4985, "lng": 77.4615},
        "drop": {"name": "Radha Kund", "lat": 27.5470, "lng": 77.4520},
        "distance_km": 5,
        "payment_method": "cash",
    }
    r = requests.post(f"{BASE}/rides", headers=H(p_tok), json=body, timeout=15)
    check("Create ride 200", r.status_code == 200, f"status={r.status_code} body={r.text[:300]}")
    ride = r.json() if r.status_code == 200 else {}
    ride_id = ride.get("id")
    correct_pin = ride.get("pin")
    check("Ride has id and pin", bool(ride_id) and bool(correct_pin), str(ride)[:300])

    # driver
    d_phone = rand_phone("9444")
    d = login(d_phone, "driver", name="Mohan Driver")
    d_tok = d.get("access_token")
    check("Driver login ok", bool(d_tok), str(d)[:200])

    # driver submits KYC
    kyc = {
        "name": "Mohan Driver",
        "aadhar_number": "123412341234",
        "aadhar_photo": "https://example.com/aadhar.jpg",
        "vehicle_no": "UP85AB1234",
        "vehicle_type": "e-rickshaw",
        "rc_photo": "https://example.com/rc.jpg",
        "profile_photo": "https://example.com/p.jpg",
        "upi_id": "mohan@upi",
    }
    r = requests.post(f"{BASE}/drivers/kyc", headers=H(d_tok), json=kyc, timeout=15)
    check("Driver KYC submit 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    # admin approve - need driver user_id
    r = requests.get(f"{BASE}/auth/me", headers=H(d_tok), timeout=15)
    driver_user_id = r.json().get("user", {}).get("id") if r.status_code == 200 else None
    check("Get driver user_id", bool(driver_user_id), str(r.json())[:200])

    r = requests.post(f"{BASE}/admin/drivers/{driver_user_id}/approve",
                      headers=H(admin_token), timeout=15)
    check("Admin approve driver 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    # driver online
    r = requests.post(f"{BASE}/drivers/online", headers=H(d_tok), json={"online": True}, timeout=15)
    check("Driver online 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    # incoming-rides
    r = requests.get(f"{BASE}/drivers/incoming-rides", headers=H(d_tok), timeout=15)
    rides = r.json().get("rides", []) if r.status_code == 200 else []
    check("Incoming rides includes our ride",
          any(x.get("id") == ride_id for x in rides),
          f"count={len(rides)} ids={[x.get('id') for x in rides]}")

    # accept
    r = requests.post(f"{BASE}/rides/{ride_id}/accept", headers=H(d_tok), timeout=15)
    check("Driver accept ride 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    j = r.json() if r.status_code == 200 else {}
    check("Ride status=accepted", j.get("status") == "accepted", str(j)[:200])

    # passenger gets ride with pin
    r = requests.get(f"{BASE}/rides/{ride_id}", headers=H(p_tok), timeout=15)
    pj = r.json() if r.status_code == 200 else {}
    check("Passenger sees pin",
          pj.get("pin") == correct_pin, f"got={pj.get('pin')} expected={correct_pin}")

    # driver verify-pin
    r = requests.post(f"{BASE}/rides/{ride_id}/verify-pin",
                      headers=H(d_tok), json={"pin": correct_pin}, timeout=15)
    check("Driver verify-pin 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    # driver complete
    r = requests.post(f"{BASE}/rides/{ride_id}/complete", headers=H(d_tok), timeout=15)
    check("Driver complete ride 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    # driver earnings
    r = requests.get(f"{BASE}/drivers/earnings", headers=H(d_tok), timeout=15)
    j = r.json() if r.status_code == 200 else {}
    expected_earning = ride.get("driver_earning", 0)
    check("Driver earnings balance >= ride earning",
          j.get("balance", 0) >= expected_earning,
          f"balance={j.get('balance')} expected_earning={expected_earning}")


def main():
    test_smoke()
    admin_token = test_auth_name_collection()
    test_geo()
    test_admin_landmarks(admin_token)
    test_ride_flow(admin_token)

    print("\n=========== SUMMARY ===========")
    print(f"PASSED: {len(PASS)}")
    print(f"FAILED: {len(FAIL)}")
    for n, d in FAIL:
        print(f"  - {n}: {d}")
    sys.exit(0 if not FAIL else 1)


if __name__ == "__main__":
    main()
