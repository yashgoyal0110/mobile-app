"""Auth routes."""
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

# In-memory OTP store (phone -> {otp, expires_at})
OTP_STORE: Dict[str, Dict[str, Any]] = {}


@router.post("/send-otp")
async def send_otp(req: SendOtpReq):
    phone = req.phone.strip()
    if len(phone) != 10 or not phone.isdigit():
        raise HTTPException(400, "Phone must be 10 digits")
    if req.role == "admin" and phone not in [p.strip() for p in ADMIN_PHONES]:
        raise HTTPException(403, "This phone is not registered as admin")
    OTP_STORE[phone] = {"otp": MOCK_OTP, "expires_at": now() + timedelta(minutes=5)}
    logger.info(f"OTP for {phone}: {MOCK_OTP}")
    return {"message": "OTP sent", "dev_otp": MOCK_OTP}


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
            await db.users.update_one({"id": user["id"]}, {"$set": {"name": name}})
            user["name"] = name
    else:
        if req.role == "admin":
            raise HTTPException(403, "Admin phones must be pre-seeded")
        is_new = True
        name = (req.name or "").strip()
        if not name:
            return {"requires_name": True, "is_new_user": True}
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
