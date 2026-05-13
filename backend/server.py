"""
TirthRide Backend — FastAPI + MongoDB
E-rickshaw booking & management for Govardhan, Mathura.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from jose import jwt, JWTError
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os
import uuid
import random
import logging

# ----------------- Setup -----------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("tirthride")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "tirthride")]

JWT_SECRET = os.environ.get("JWT_SECRET", "tirthride-dev-secret-change-in-prod")
JWT_ALG = "HS256"
JWT_EXPIRE_DAYS = 30
ADMIN_PHONES = os.environ.get("ADMIN_PHONES", "9999999999").split(",")
MOCK_OTP = "123456"

app = FastAPI(title="TirthRide API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

# ----------------- Utility -----------------
def now() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

def make_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "iat": int(now().timestamp()),
        "exp": int((now() + timedelta(days=JWT_EXPIRE_DAYS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def gen_pin() -> str:
    return f"{random.randint(0, 9999):04d}"

def clean(doc: dict) -> dict:
    """Remove Mongo internals and stringify datetimes."""
    if not doc:
        return doc
    doc = {k: v for k, v in doc.items() if k != "_id"}
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            doc[k] = iso(v)
    return doc

# ----------------- Models -----------------
RoleType = Literal["passenger", "driver", "admin"]
RideType = Literal["local", "poochari", "radhakund", "combined"]
RideStatus = Literal["requested", "accepted", "started", "completed", "cancelled"]
PaymentMethod = Literal["upi", "cash"]
KycStatus = Literal["not_submitted", "pending", "approved", "rejected"]

class SendOtpReq(BaseModel):
    phone: str
    role: RoleType

class VerifyOtpReq(BaseModel):
    phone: str
    role: RoleType
    otp: str

class UpdateUserReq(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

class KycReq(BaseModel):
    name: str
    aadhar_number: str
    aadhar_photo: str  # base64 data URL
    vehicle_no: str
    vehicle_type: str = "e-rickshaw"
    rc_photo: str
    profile_photo: str
    upi_id: str

class OnlineReq(BaseModel):
    online: bool

class FareConfig(BaseModel):
    base_fare: float = 30.0
    per_km: float = 12.0
    poochari_fare: float = 250.0
    radhakund_fare: float = 150.0
    combined_fare: float = 350.0
    commission_pct: float = 10.0
    cancellation_fee: float = 20.0
    landmarks: List[Dict[str, Any]] = []
    city_center: Dict[str, float] = {"lat": 27.4985, "lng": 77.4615}
    boundary_radius_km: float = 15.0

class CreateRideReq(BaseModel):
    type: RideType
    pickup: Optional[Dict[str, Any]] = None
    drop: Optional[Dict[str, Any]] = None
    distance_km: Optional[float] = None
    payment_method: PaymentMethod
    scheduled_at: Optional[str] = None  # ISO future time
    notes: Optional[str] = None

class CancelReq(BaseModel):
    reason: str

class VerifyPinReq(BaseModel):
    pin: str

class SuggestFareReq(BaseModel):
    ride_type: str  # "local-base", "local-per-km", "poochari", "radhakund", "combined"
    amount: float
    note: Optional[str] = None

class VoteReq(BaseModel):
    vote: Literal["up", "down"]

class WithdrawReq(BaseModel):
    amount: float

# ----------------- Auth Deps -----------------
async def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    # Accept token from either standard Authorization header OR custom X-Auth-Token
    # header. The custom header is needed because some ingresses 307-redirect
    # cross-origin and browsers strip the Authorization header on cross-origin
    # redirects (per fetch spec).
    token = None
    if creds and creds.credentials:
        token = creds.credentials
    if not token:
        token = request.headers.get("x-auth-token") or request.headers.get("X-Auth-Token")
    if not token:
        raise HTTPException(401, "Missing token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(401, "User not found")
    return user

def require_role(*roles: str):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, f"Requires role: {', '.join(roles)}")
        return user
    return checker

# In-memory OTP store (phone -> {otp, expires_at})
OTP_STORE: Dict[str, Dict[str, Any]] = {}

# ----------------- Default Data -----------------
GOVARDHAN_LANDMARKS = [
    {"id": "mukharvind", "name": "Mukharvind Mandir, Jatipura", "lat": 27.4985, "lng": 77.4615},
    {"id": "danghati", "name": "Daan Ghati Mandir", "lat": 27.4961, "lng": 77.4694},
    {"id": "radhakund", "name": "Radha Kund", "lat": 27.5470, "lng": 77.4520},
    {"id": "kusumsarovar", "name": "Kusum Sarovar", "lat": 27.5288, "lng": 77.4478},
    {"id": "anyor", "name": "Anyor Village", "lat": 27.4790, "lng": 77.4523},
    {"id": "poochari", "name": "Poochari ka Lota", "lat": 27.4756, "lng": 77.4445},
    {"id": "manasi-ganga", "name": "Manasi Ganga", "lat": 27.4983, "lng": 77.4680},
    {"id": "govind-kund", "name": "Govind Kund", "lat": 27.4870, "lng": 77.4612},
    {"id": "jatipura", "name": "Jatipura Bus Stand", "lat": 27.4990, "lng": 77.4530},
    {"id": "govardhan-chauraha", "name": "Govardhan Chauraha", "lat": 27.4977, "lng": 77.4625},
]

async def ensure_seed():
    """Seed admin user and fare config."""
    cfg = await db.fare_config.find_one({"id": "default"})
    if not cfg:
        default_cfg = FareConfig().model_dump()
        default_cfg["id"] = "default"
        default_cfg["landmarks"] = GOVARDHAN_LANDMARKS
        default_cfg["updated_at"] = now()
        await db.fare_config.insert_one(default_cfg)
        logger.info("Seeded fare config")

    for phone in ADMIN_PHONES:
        phone = phone.strip()
        existing = await db.users.find_one({"phone": phone})
        if not existing:
            await db.users.insert_one({
                "id": new_id(),
                "phone": phone,
                "name": "TirthRide Admin",
                "role": "admin",
                "created_at": now(),
            })
            logger.info(f"Seeded admin: {phone}")

@app.on_event("startup")
async def startup():
    await ensure_seed()

@app.on_event("shutdown")
async def shutdown():
    client.close()

# ----------------- AUTH -----------------
@api.post("/auth/send-otp")
async def send_otp(req: SendOtpReq):
    phone = req.phone.strip()
    if len(phone) != 10 or not phone.isdigit():
        raise HTTPException(400, "Phone must be 10 digits")
    if req.role == "admin" and phone not in [p.strip() for p in ADMIN_PHONES]:
        raise HTTPException(403, "This phone is not registered as admin")
    OTP_STORE[phone] = {"otp": MOCK_OTP, "expires_at": now() + timedelta(minutes=5)}
    logger.info(f"OTP for {phone}: {MOCK_OTP}")
    return {"message": "OTP sent", "dev_otp": MOCK_OTP}

@api.post("/auth/verify-otp")
async def verify_otp(req: VerifyOtpReq):
    phone = req.phone.strip()
    rec = OTP_STORE.get(phone)
    if not rec:
        raise HTTPException(400, "OTP not requested")
    if rec["expires_at"] < now():
        raise HTTPException(400, "OTP expired")
    if req.otp != rec["otp"]:
        raise HTTPException(400, "Invalid OTP")
    OTP_STORE.pop(phone, None)

    # Find or create user
    user = await db.users.find_one({"phone": phone})
    if user:
        if user["role"] != req.role:
            raise HTTPException(403, f"This phone is registered as {user['role']}")
    else:
        if req.role == "admin":
            raise HTTPException(403, "Admin phones must be pre-seeded")
        user = {
            "id": new_id(),
            "phone": phone,
            "name": "",
            "role": req.role,
            "created_at": now(),
        }
        await db.users.insert_one(user)
        # initialize driver doc
        if req.role == "driver":
            await db.drivers.insert_one({
                "id": new_id(),
                "user_id": user["id"],
                "kyc_status": "not_submitted",
                "online": False,
                "earnings_total": 0.0,
                "earnings_withdrawn": 0.0,
                "created_at": now(),
            })

    token = make_token(user["id"], user["role"])
    return {"access_token": token, "user": clean(user)}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    out = {"user": clean(user)}
    if user["role"] == "driver":
        driver = await db.drivers.find_one({"user_id": user["id"]})
        out["driver"] = clean(driver) if driver else None
    return out

# ----------------- USERS -----------------
@api.patch("/users/me")
async def update_me(req: UpdateUserReq, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    fresh = await db.users.find_one({"id": user["id"]})
    return clean(fresh)

# ----------------- CONFIG -----------------
@api.get("/config/fare")
async def get_fare_config():
    cfg = await db.fare_config.find_one({"id": "default"})
    return clean(cfg)

@api.patch("/admin/config/fare")
async def update_fare_config(payload: Dict[str, Any], _: dict = Depends(require_role("admin"))):
    allowed = {"base_fare", "per_km", "poochari_fare", "radhakund_fare", "combined_fare",
               "commission_pct", "cancellation_fee", "boundary_radius_km", "landmarks", "city_center"}
    updates = {k: v for k, v in payload.items() if k in allowed}
    updates["updated_at"] = now()
    await db.fare_config.update_one({"id": "default"}, {"$set": updates})
    cfg = await db.fare_config.find_one({"id": "default"})
    return clean(cfg)

# ----------------- DRIVERS -----------------
@api.post("/drivers/kyc")
async def submit_kyc(req: KycReq, user: dict = Depends(require_role("driver"))):
    # Update driver doc; if vehicle changed, status -> pending
    driver = await db.drivers.find_one({"user_id": user["id"]})
    if not driver:
        raise HTTPException(404, "Driver record missing")
    updates = req.model_dump()
    updates["kyc_status"] = "pending"
    updates["submitted_at"] = now()
    await db.drivers.update_one({"user_id": user["id"]}, {"$set": updates})
    if req.name:
        await db.users.update_one({"id": user["id"]}, {"$set": {"name": req.name}})
    fresh = await db.drivers.find_one({"user_id": user["id"]})
    return clean(fresh)

@api.post("/drivers/online")
async def set_online(req: OnlineReq, user: dict = Depends(require_role("driver"))):
    driver = await db.drivers.find_one({"user_id": user["id"]})
    if not driver:
        raise HTTPException(404, "Driver record missing")
    if req.online and driver.get("kyc_status") != "approved":
        raise HTTPException(403, "Complete KYC and get admin approval to go online")
    await db.drivers.update_one({"user_id": user["id"]}, {"$set": {"online": req.online}})
    return {"online": req.online}

@api.get("/drivers/incoming-rides")
async def incoming_rides(user: dict = Depends(require_role("driver"))):
    driver = await db.drivers.find_one({"user_id": user["id"]})
    if not driver or not driver.get("online") or driver.get("kyc_status") != "approved":
        return {"rides": []}
    rides = await db.rides.find({"status": "requested", "driver_id": None}).sort("created_at", -1).to_list(20)
    return {"rides": [clean(r) for r in rides]}

@api.get("/drivers/earnings")
async def driver_earnings(user: dict = Depends(require_role("driver"))):
    driver = await db.drivers.find_one({"user_id": user["id"]})
    if not driver:
        raise HTTPException(404, "Driver not found")
    balance = (driver.get("earnings_total") or 0) - (driver.get("earnings_withdrawn") or 0)
    rides = await db.rides.find({"driver_id": user["id"], "status": "completed"}).sort("completed_at", -1).to_list(50)
    return {
        "total": driver.get("earnings_total", 0),
        "withdrawn": driver.get("earnings_withdrawn", 0),
        "balance": balance,
        "completed_rides": [clean(r) for r in rides],
    }

@api.post("/drivers/withdraw")
async def withdraw(req: WithdrawReq, user: dict = Depends(require_role("driver"))):
    driver = await db.drivers.find_one({"user_id": user["id"]})
    if not driver:
        raise HTTPException(404, "Driver not found")
    balance = (driver.get("earnings_total") or 0) - (driver.get("earnings_withdrawn") or 0)
    if req.amount <= 0 or req.amount > balance:
        raise HTTPException(400, f"Amount must be between 0 and {balance}")
    w = {
        "id": new_id(),
        "driver_id": user["id"],
        "amount": req.amount,
        "upi_id": driver.get("upi_id"),
        "status": "requested",
        "requested_at": now(),
    }
    await db.withdrawals.insert_one(w)
    await db.drivers.update_one({"user_id": user["id"]},
                                {"$inc": {"earnings_withdrawn": req.amount}})
    return clean(w)

@api.get("/admin/drivers")
async def admin_list_drivers(status_filter: Optional[str] = None, _: dict = Depends(require_role("admin"))):
    q = {}
    if status_filter:
        q["kyc_status"] = status_filter
    drivers = await db.drivers.find(q).sort("created_at", -1).to_list(100)
    out = []
    for d in drivers:
        u = await db.users.find_one({"id": d["user_id"]})
        item = clean(d)
        item["user"] = clean(u) if u else None
        out.append(item)
    return {"drivers": out}

@api.post("/admin/drivers/{driver_user_id}/approve")
async def approve_driver(driver_user_id: str, _: dict = Depends(require_role("admin"))):
    res = await db.drivers.update_one(
        {"user_id": driver_user_id},
        {"$set": {"kyc_status": "approved", "approved_at": now()}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Driver not found")
    return {"ok": True}

@api.post("/admin/drivers/{driver_user_id}/reject")
async def reject_driver(driver_user_id: str, body: Dict[str, Any] = None, _: dict = Depends(require_role("admin"))):
    reason = (body or {}).get("reason", "Documents not verified")
    res = await db.drivers.update_one(
        {"user_id": driver_user_id},
        {"$set": {"kyc_status": "rejected", "rejection_reason": reason, "online": False}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Driver not found")
    return {"ok": True}

# ----------------- RIDES -----------------
def calc_fare(ride_type: str, distance_km: Optional[float], cfg: dict) -> float:
    if ride_type == "local":
        return round(cfg["base_fare"] + cfg["per_km"] * max(distance_km or 0, 1), 2)
    if ride_type == "poochari":
        return cfg["poochari_fare"]
    if ride_type == "radhakund":
        return cfg["radhakund_fare"]
    if ride_type == "combined":
        return cfg["combined_fare"]
    raise HTTPException(400, "Unknown ride type")

@api.post("/rides")
async def create_ride(req: CreateRideReq, user: dict = Depends(require_role("passenger"))):
    cfg = await db.fare_config.find_one({"id": "default"})
    fare = calc_fare(req.type, req.distance_km, cfg)
    commission = round(fare * cfg["commission_pct"] / 100, 2)
    pin = gen_pin()
    scheduled_at = None
    if req.scheduled_at:
        try:
            scheduled_at = datetime.fromisoformat(req.scheduled_at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(400, "Invalid scheduled_at")

    ride = {
        "id": new_id(),
        "passenger_id": user["id"],
        "passenger_name": user.get("name") or user["phone"],
        "passenger_phone": user["phone"],
        "driver_id": None,
        "driver_name": None,
        "driver_phone": None,
        "driver_vehicle_no": None,
        "type": req.type,
        "pickup": req.pickup,
        "drop": req.drop,
        "distance_km": req.distance_km,
        "fare": fare,
        "commission": commission,
        "driver_earning": round(fare - commission, 2),
        "payment_method": req.payment_method,
        "status": "scheduled" if scheduled_at else "requested",
        "pin": pin,
        "scheduled_at": scheduled_at,
        "notes": req.notes,
        "audit_log": [{"at": iso(now()), "event": "created", "by": user["id"]}],
        "created_at": now(),
        "accepted_at": None,
        "started_at": None,
        "completed_at": None,
        "cancelled_at": None,
        "cancel_reason": None,
        "cancelled_by": None,
    }
    await db.rides.insert_one(ride)
    return clean(ride)

@api.get("/rides/mine")
async def my_rides(user: dict = Depends(get_current_user)):
    q = {"passenger_id": user["id"]} if user["role"] == "passenger" else {"driver_id": user["id"]}
    rides = await db.rides.find(q).sort("created_at", -1).to_list(100)
    return {"rides": [clean(r) for r in rides]}

@api.get("/rides/{ride_id}")
async def get_ride(ride_id: str, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if user["role"] not in ("admin",) and user["id"] not in (ride.get("passenger_id"), ride.get("driver_id")):
        raise HTTPException(403, "Forbidden")
    out = clean(ride)
    # Hide PIN from driver until accepted
    if user["role"] == "driver" and ride.get("status") == "requested":
        out["pin"] = None
    return out

@api.post("/rides/{ride_id}/accept")
async def accept_ride(ride_id: str, user: dict = Depends(require_role("driver"))):
    driver = await db.drivers.find_one({"user_id": user["id"]})
    if not driver or driver.get("kyc_status") != "approved":
        raise HTTPException(403, "KYC not approved")
    ride = await db.rides.find_one({"id": ride_id, "status": "requested", "driver_id": None})
    if not ride:
        raise HTTPException(409, "Ride no longer available")
    audit = ride.get("audit_log", []) + [{"at": iso(now()), "event": "accepted", "by": user["id"]}]
    await db.rides.update_one({"id": ride_id, "driver_id": None}, {"$set": {
        "driver_id": user["id"],
        "driver_name": user.get("name") or user["phone"],
        "driver_phone": user["phone"],
        "driver_vehicle_no": driver.get("vehicle_no"),
        "status": "accepted",
        "accepted_at": now(),
        "audit_log": audit,
    }})
    fresh = await db.rides.find_one({"id": ride_id})
    return clean(fresh)

@api.post("/rides/{ride_id}/verify-pin")
async def verify_pin(ride_id: str, req: VerifyPinReq, user: dict = Depends(require_role("driver"))):
    ride = await db.rides.find_one({"id": ride_id, "driver_id": user["id"]})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if ride["status"] != "accepted":
        raise HTTPException(400, f"Cannot start from status {ride['status']}")
    if req.pin != ride["pin"]:
        raise HTTPException(400, "Incorrect PIN")
    audit = ride.get("audit_log", []) + [{"at": iso(now()), "event": "started", "by": user["id"]}]
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "status": "started",
        "started_at": now(),
        "audit_log": audit,
    }})
    return {"ok": True, "status": "started"}

@api.post("/rides/{ride_id}/complete")
async def complete_ride(ride_id: str, user: dict = Depends(require_role("driver"))):
    ride = await db.rides.find_one({"id": ride_id, "driver_id": user["id"]})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if ride["status"] != "started":
        raise HTTPException(400, f"Cannot complete from {ride['status']}")
    audit = ride.get("audit_log", []) + [{"at": iso(now()), "event": "completed", "by": user["id"]}]
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "status": "completed",
        "completed_at": now(),
        "audit_log": audit,
    }})
    # add to driver earnings
    await db.drivers.update_one({"user_id": user["id"]},
                                {"$inc": {"earnings_total": ride["driver_earning"]}})
    return {"ok": True, "status": "completed"}

@api.post("/rides/{ride_id}/cancel")
async def cancel_ride(ride_id: str, req: CancelReq, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id})
    if not ride:
        raise HTTPException(404, "Ride not found")
    if user["id"] not in (ride.get("passenger_id"), ride.get("driver_id")):
        raise HTTPException(403, "Not your ride")
    if ride["status"] in ("completed", "cancelled"):
        raise HTTPException(400, f"Already {ride['status']}")
    audit = ride.get("audit_log", []) + [{"at": iso(now()), "event": "cancelled",
                                          "by": user["id"], "role": user["role"], "reason": req.reason}]
    await db.rides.update_one({"id": ride_id}, {"$set": {
        "status": "cancelled",
        "cancelled_at": now(),
        "cancel_reason": req.reason,
        "cancelled_by": user["role"],
        "audit_log": audit,
    }})
    return {"ok": True}

# ----------------- FARE SUGGESTIONS -----------------
@api.post("/suggestions")
async def create_suggestion(req: SuggestFareReq, user: dict = Depends(require_role("driver"))):
    s = {
        "id": new_id(),
        "driver_id": user["id"],
        "driver_name": user.get("name") or user["phone"],
        "ride_type": req.ride_type,
        "amount": req.amount,
        "note": req.note,
        "votes_up": 0,
        "votes_down": 0,
        "voters": [],
        "status": "open",
        "created_at": now(),
    }
    await db.fare_suggestions.insert_one(s)
    return clean(s)

@api.get("/suggestions")
async def list_suggestions(user: dict = Depends(get_current_user)):
    s = await db.fare_suggestions.find({"status": "open"}).sort("created_at", -1).to_list(50)
    return {"suggestions": [clean(x) for x in s]}

@api.post("/suggestions/{sid}/vote")
async def vote_suggestion(sid: str, req: VoteReq, user: dict = Depends(require_role("driver"))):
    s = await db.fare_suggestions.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Not found")
    if user["id"] in s.get("voters", []):
        raise HTTPException(400, "Already voted")
    inc = {"votes_up": 1} if req.vote == "up" else {"votes_down": 1}
    await db.fare_suggestions.update_one(
        {"id": sid}, {"$inc": inc, "$push": {"voters": user["id"]}}
    )
    return {"ok": True}

@api.post("/admin/suggestions/{sid}/apply")
async def apply_suggestion(sid: str, _: dict = Depends(require_role("admin"))):
    s = await db.fare_suggestions.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Not found")
    rt = s["ride_type"]
    field_map = {
        "local-base": "base_fare",
        "local-per-km": "per_km",
        "poochari": "poochari_fare",
        "radhakund": "radhakund_fare",
        "combined": "combined_fare",
    }
    field = field_map.get(rt)
    if not field:
        raise HTTPException(400, "Unknown ride_type")
    await db.fare_config.update_one({"id": "default"}, {"$set": {field: s["amount"], "updated_at": now()}})
    await db.fare_suggestions.update_one({"id": sid}, {"$set": {"status": "applied"}})
    return {"ok": True}

# ----------------- ADMIN AUDIT -----------------
@api.get("/admin/audit/rides")
async def audit_rides(_: dict = Depends(require_role("admin")),
                      status_filter: Optional[str] = None,
                      limit: int = 100):
    q = {}
    if status_filter:
        q["status"] = status_filter
    rides = await db.rides.find(q).sort("created_at", -1).to_list(limit)
    return {"rides": [clean(r) for r in rides]}

@api.get("/admin/dashboard")
async def admin_dashboard(_: dict = Depends(require_role("admin"))):
    today_start = datetime.combine(now().date(), datetime.min.time(), tzinfo=timezone.utc)
    total_rides = await db.rides.count_documents({})
    rides_today = await db.rides.count_documents({"created_at": {"$gte": today_start}})
    active_drivers = await db.drivers.count_documents({"online": True, "kyc_status": "approved"})
    pending_approvals = await db.drivers.count_documents({"kyc_status": "pending"})
    completed = await db.rides.find({"status": "completed"}).to_list(10000)
    revenue = sum(r.get("commission", 0) for r in completed)
    total_fare = sum(r.get("fare", 0) for r in completed)
    return {
        "total_rides": total_rides,
        "rides_today": rides_today,
        "active_drivers": active_drivers,
        "pending_approvals": pending_approvals,
        "platform_revenue": round(revenue, 2),
        "total_fare_processed": round(total_fare, 2),
    }

@api.get("/admin/withdrawals")
async def list_withdrawals(_: dict = Depends(require_role("admin"))):
    w = await db.withdrawals.find().sort("requested_at", -1).to_list(100)
    return {"withdrawals": [clean(x) for x in w]}

@api.post("/admin/withdrawals/{wid}/mark-paid")
async def mark_withdrawal_paid(wid: str, _: dict = Depends(require_role("admin"))):
    await db.withdrawals.update_one({"id": wid}, {"$set": {"status": "paid", "paid_at": now()}})
    return {"ok": True}

# ----------------- Mount -----------------
@api.get("/")
async def root():
    return {"app": "TirthRide", "status": "running"}

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
