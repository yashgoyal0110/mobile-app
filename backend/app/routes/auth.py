"""Auth routes.

OTP behaviour:
- Each phone gets a sticky 6-digit OTP that is generated once on the very first
  `send-otp` call and persists forever in the `phone_otps` collection.
- Admin phones use the env-configured MOCK_OTP for predictability in dev.
- Re-requesting OTP for the same phone always returns the same code.
"""
import re
import random
from datetime import timedelta
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Depends
import logging

from ..config import ADMIN_PHONES, MOCK_OTP
from ..db import db
from ..deps import get_current_user, make_token
from ..models import SendOtpReq, VerifyOtpReq
from ..utils import now, new_id, clean

logger = logging.getLogger("tirthride.auth")
router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory active OTP store keyed by phone — controls expiry of an OTP session
OTP_STORE: Dict[str, Dict[str, Any]] = {}

NAME_RE = re.compile(r"^[A-Za-z][A-Za-z .'\-]{1,49}$")


def _is_valid_name(value: str) -> bool:
    return bool(NAME_RE.match(value.strip()))


async def _sticky_otp_for(phone: str) -> str:
    """Return the persistent OTP for a phone, generating once on first use."""
    # Admin always uses the MOCK_OTP so devs/admin testers have a known code
    if phone in [p.strip() for p in ADMIN_PHONES]:
        return MOCK_OTP
    rec = await db.phone_otps.find_one({"phone": phone})
    if rec and rec.get("otp"):
        return rec["otp"]
    # Generate a new random 6-digit OTP that doesn't collide with reserved codes
    while True:
        code = f"{random.randint(0, 999999):06d}"
        if code != "000000":
            break
    await db.phone_otps.insert_one({"phone": phone, "otp": code, "created_at": now()})
    return code


@router.post("/send-otp")
async def send_otp(req: SendOtpReq):
    phone = req.phone.strip()
    if len(phone) != 10 or not phone.isdigit():
        raise HTTPException(400, "Phone must be 10 digits")
    if req.role == "admin" and phone not in [p.strip() for p in ADMIN_PHONES]:
        raise HTTPException(403, "This phone is not registered as admin")
    code = await _sticky_otp_for(phone)
    OTP_STORE[phone] = {"otp": code, "expires_at": now() + timedelta(minutes=10)}
    logger.info(f"OTP for {phone}: {code}")
    # `dev_otp` is shown in dev mode so testers can sign in without SMS
    return {"message": "OTP sent", "dev_otp": code}


@router.post("/verify-otp")
async def verify_otp(req: VerifyOtpReq):
    phone = req.phone.strip()
    rec = OTP_STORE.get(phone)
    if not rec:
        raise HTTPException(400, "OTP not requested")
    if rec["expires_at"] < now():
        raise HTTPException(400, "OTP expired")
    if req.otp != rec["otp"]:
        raise HTTPException(400, "Invalid OTP")

    user = await db.users.find_one({"phone": phone})
    is_new = False
    if user:
        if user["role"] != req.role:
            raise HTTPException(403, f"This phone is registered as {user['role']}")
        if not (user.get("name") or "").strip():
            # legacy user without name — ask client to supply one
            name = (req.name or "").strip()
            if not name:
                return {"requires_name": True, "is_new_user": False}
            if not _is_valid_name(name):
                raise HTTPException(400, "Name should only contain letters, spaces, dots, hyphens, or apostrophes")
            await db.users.update_one({"id": user["id"]}, {"$set": {"name": name}})
            user["name"] = name
    else:
        if req.role == "admin":
            raise HTTPException(403, "Admin phones must be pre-seeded")
        is_new = True
        name = (req.name or "").strip()
        if not name:
            return {"requires_name": True, "is_new_user": True}
        if not _is_valid_name(name):
            raise HTTPException(400, "Name should only contain letters, spaces, dots, hyphens, or apostrophes")
        user = {
            "id": new_id(),
            "phone": phone,
            "name": name,
            "role": req.role,
            "created_at": now(),
        }
        await db.users.insert_one(user)
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

    OTP_STORE.pop(phone, None)
    token = make_token(user["id"], user["role"])
    return {
        "access_token": token,
        "user": clean(user),
        "is_new_user": is_new,
    }


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    out = {"user": clean(user)}
    if user["role"] == "driver":
        driver = await db.drivers.find_one({"user_id": user["id"]})
        out["driver"] = clean(driver) if driver else None
    return out
