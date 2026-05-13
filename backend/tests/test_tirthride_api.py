"""TirthRide backend API tests (BACKEND-1..23)."""
import os, time, uuid, pytest, requests
from requests.sessions import Session

# Cross-host redirect (public -> internal) strips Authorization by default.
# Override to preserve auth headers across the trusted redirect.
class _S(Session):
    def rebuild_auth(self, prepared_request, response):
        return
requests = _S()  # shadow module name within this test file

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"

ADMIN_PHONE = "9999999999"
# Use random phones to avoid cross-iteration conflicts
DRIVER_PHONE = "9" + str(uuid.uuid4().int)[:9]
PASSENGER_PHONE = "9" + str(uuid.uuid4().int)[:9]


def _auth(phone, role):
    r = requests.post(f"{BASE}/auth/send-otp", json={"phone": phone, "role": role})
    assert r.status_code == 200, r.text
    assert r.json()["dev_otp"] == "123456"
    r = requests.post(f"{BASE}/auth/verify-otp", json={"phone": phone, "role": role, "otp": "123456"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"]


@pytest.fixture(scope="module")
def ctx():
    pax_tok, pax = _auth(PASSENGER_PHONE, "passenger")
    drv_tok, drv = _auth(DRIVER_PHONE, "driver")
    adm_tok, adm = _auth(ADMIN_PHONE, "admin")
    return {
        "pax": {"tok": pax_tok, "user": pax, "h": {"Authorization": f"Bearer {pax_tok}"}},
        "drv": {"tok": drv_tok, "user": drv, "h": {"Authorization": f"Bearer {drv_tok}"}},
        "adm": {"tok": adm_tok, "user": adm, "h": {"Authorization": f"Bearer {adm_tok}"}},
    }


# BACKEND-1
def test_send_otp_returns_dev_otp():
    r = requests.post(f"{BASE}/auth/send-otp", json={"phone": "9123456780", "role": "passenger"})
    assert r.status_code == 200
    assert r.json().get("dev_otp") == "123456"

# BACKEND-2
def test_admin_role_blocks_non_admin_phone():
    r = requests.post(f"{BASE}/auth/send-otp", json={"phone": "9123456781", "role": "admin"})
    assert r.status_code == 403

# BACKEND-3
def test_verify_creates_users(ctx):
    assert ctx["pax"]["user"]["role"] == "passenger"
    assert ctx["drv"]["user"]["role"] == "driver"

# BACKEND-5
def test_admin_seeded_login(ctx):
    assert ctx["adm"]["user"]["role"] == "admin"

# BACKEND-4
def test_me_endpoint(ctx):
    r = requests.get(f"{BASE}/auth/me", headers=ctx["drv"]["h"])
    assert r.status_code == 200
    j = r.json()
    assert j["user"]["role"] == "driver"
    assert "driver" in j and j["driver"] is not None

# BACKEND-6
def test_get_fare_config():
    r = requests.get(f"{BASE}/config/fare")
    assert r.status_code == 200
    j = r.json()
    assert "base_fare" in j and "landmarks" in j and len(j["landmarks"]) > 0

# BACKEND-7
def test_admin_update_fare(ctx):
    r = requests.patch(f"{BASE}/admin/config/fare", json={"base_fare": 35.0}, headers=ctx["adm"]["h"])
    assert r.status_code == 200
    assert r.json()["base_fare"] == 35.0
    # restore
    requests.patch(f"{BASE}/admin/config/fare", json={"base_fare": 30.0}, headers=ctx["adm"]["h"])

# BACKEND-22 (role enforcement)
def test_passenger_cannot_access_admin(ctx):
    r = requests.patch(f"{BASE}/admin/config/fare", json={"base_fare": 99}, headers=ctx["pax"]["h"])
    assert r.status_code == 403

# BACKEND-10 (online before approval -> 403)
def test_driver_online_blocked_without_approval(ctx):
    r = requests.post(f"{BASE}/drivers/online", json={"online": True}, headers=ctx["drv"]["h"])
    assert r.status_code == 403

# BACKEND-8 KYC submit
def test_driver_kyc_submit(ctx):
    payload = {
        "name": "Test Driver", "aadhar_number": "1234-5678-9012",
        "aadhar_photo": "data:image/png;base64,AAA", "vehicle_no": "UP85AB1234",
        "vehicle_type": "e-rickshaw", "rc_photo": "data:image/png;base64,BBB",
        "profile_photo": "data:image/png;base64,CCC", "upi_id": "driver@upi",
    }
    r = requests.post(f"{BASE}/drivers/kyc", json=payload, headers=ctx["drv"]["h"])
    assert r.status_code == 200
    assert r.json()["kyc_status"] == "pending"

# BACKEND-9 Admin approves
def test_admin_approves_driver(ctx):
    r = requests.post(f"{BASE}/admin/drivers/{ctx['drv']['user']['id']}/approve", headers=ctx["adm"]["h"])
    assert r.status_code == 200
    # Verify
    r = requests.get(f"{BASE}/auth/me", headers=ctx["drv"]["h"])
    assert r.json()["driver"]["kyc_status"] == "approved"

# BACKEND-10b online success after approval
def test_driver_online_after_approval(ctx):
    r = requests.post(f"{BASE}/drivers/online", json={"online": True}, headers=ctx["drv"]["h"])
    assert r.status_code == 200

# BACKEND-11 create ride
def test_create_ride(ctx):
    r = requests.post(f"{BASE}/rides", json={
        "type": "local", "distance_km": 5, "payment_method": "cash",
        "pickup": {"name": "Jatipura"}, "drop": {"name": "Daan Ghati"},
    }, headers=ctx["pax"]["h"])
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["status"] == "requested"
    assert len(j["pin"]) == 4 and j["pin"].isdigit()
    assert j["fare"] > 0
    ctx["ride_id"] = j["id"]
    ctx["pin"] = j["pin"]

# BACKEND-12 scheduled
def test_create_scheduled_ride(ctx):
    future = "2030-01-01T10:00:00+00:00"
    r = requests.post(f"{BASE}/rides", json={
        "type": "poochari", "payment_method": "upi", "scheduled_at": future,
    }, headers=ctx["pax"]["h"])
    assert r.status_code == 200
    assert r.json()["status"] == "scheduled"

# BACKEND-13 incoming-rides
def test_incoming_rides(ctx):
    r = requests.get(f"{BASE}/drivers/incoming-rides", headers=ctx["drv"]["h"])
    assert r.status_code == 200
    ids = [x["id"] for x in r.json()["rides"]]
    assert ctx["ride_id"] in ids

# BACKEND-14 accept
def test_accept_ride(ctx):
    r = requests.post(f"{BASE}/rides/{ctx['ride_id']}/accept", headers=ctx["drv"]["h"])
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"
    assert r.json()["driver_id"] == ctx["drv"]["user"]["id"]

# BACKEND-15 verify-pin wrong then correct
def test_verify_pin(ctx):
    r = requests.post(f"{BASE}/rides/{ctx['ride_id']}/verify-pin", json={"pin": "0000" if ctx["pin"] != "0000" else "1111"}, headers=ctx["drv"]["h"])
    assert r.status_code == 400
    r = requests.post(f"{BASE}/rides/{ctx['ride_id']}/verify-pin", json={"pin": ctx["pin"]}, headers=ctx["drv"]["h"])
    assert r.status_code == 200
    assert r.json()["status"] == "started"

# BACKEND-16 complete
def test_complete_ride(ctx):
    r = requests.post(f"{BASE}/rides/{ctx['ride_id']}/complete", headers=ctx["drv"]["h"])
    assert r.status_code == 200
    # earnings increment
    r = requests.get(f"{BASE}/drivers/earnings", headers=ctx["drv"]["h"])
    assert r.status_code == 200
    assert r.json()["total"] > 0

# BACKEND-17 cancel with reason
def test_cancel_with_reason(ctx):
    r = requests.post(f"{BASE}/rides", json={
        "type": "local", "distance_km": 2, "payment_method": "cash",
    }, headers=ctx["pax"]["h"])
    rid = r.json()["id"]
    r = requests.post(f"{BASE}/rides/{rid}/cancel", json={"reason": "Changed mind"}, headers=ctx["pax"]["h"])
    assert r.status_code == 200
    r = requests.get(f"{BASE}/rides/{rid}", headers=ctx["pax"]["h"])
    j = r.json()
    assert j["status"] == "cancelled"
    assert j["cancel_reason"] == "Changed mind"
    assert j["cancelled_by"] == "passenger"

# BACKEND-18 audit
def test_admin_audit(ctx):
    r = requests.get(f"{BASE}/admin/audit/rides", headers=ctx["adm"]["h"])
    assert r.status_code == 200
    rides = r.json()["rides"]
    assert len(rides) > 0
    assert any("audit_log" in r and len(r["audit_log"]) > 0 for r in rides)

# BACKEND-19 suggestions
def test_suggestions_flow(ctx):
    r = requests.post(f"{BASE}/suggestions", json={"ride_type": "local-base", "amount": 33.0, "note": "test"}, headers=ctx["drv"]["h"])
    assert r.status_code == 200
    sid = r.json()["id"]
    r = requests.post(f"{BASE}/suggestions/{sid}/vote", json={"vote": "up"}, headers=ctx["drv"]["h"])
    assert r.status_code == 200
    r = requests.post(f"{BASE}/admin/suggestions/{sid}/apply", headers=ctx["adm"]["h"])
    assert r.status_code == 200
    r = requests.get(f"{BASE}/config/fare")
    assert r.json()["base_fare"] == 33.0
    requests.patch(f"{BASE}/admin/config/fare", json={"base_fare": 30.0}, headers=ctx["adm"]["h"])

# BACKEND-20 withdraw
def test_withdraw(ctx):
    r = requests.get(f"{BASE}/drivers/earnings", headers=ctx["drv"]["h"])
    bal = r.json()["balance"]
    if bal <= 0:
        pytest.skip("No balance")
    r = requests.post(f"{BASE}/drivers/withdraw", json={"amount": min(10, bal)}, headers=ctx["drv"]["h"])
    assert r.status_code == 200
    r2 = requests.get(f"{BASE}/drivers/earnings", headers=ctx["drv"]["h"])
    assert r2.json()["balance"] == bal - min(10, bal)

# BACKEND-21 dashboard
def test_admin_dashboard(ctx):
    r = requests.get(f"{BASE}/admin/dashboard", headers=ctx["adm"]["h"])
    assert r.status_code == 200
    j = r.json()
    for k in ["rides_today", "total_rides", "active_drivers", "pending_approvals", "platform_revenue"]:
        assert k in j

# BACKEND-23 rides/mine
def test_rides_mine(ctx):
    r = requests.get(f"{BASE}/rides/mine", headers=ctx["pax"]["h"])
    assert r.status_code == 200
    assert all(x["passenger_id"] == ctx["pax"]["user"]["id"] for x in r.json()["rides"])
    r = requests.get(f"{BASE}/rides/mine", headers=ctx["drv"]["h"])
    assert r.status_code == 200
    assert all(x["driver_id"] == ctx["drv"]["user"]["id"] for x in r.json()["rides"])
