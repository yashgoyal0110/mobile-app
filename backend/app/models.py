"""Pydantic models."""
from pydantic import BaseModel
from typing import List, Optional, Literal, Dict, Any

RoleType = Literal["passenger", "driver", "admin"]
RideType = Literal["local", "poochari", "radhakund", "combined"]
RideStatus = Literal["requested", "accepted", "started", "completed", "cancelled", "scheduled"]
PaymentMethod = Literal["upi", "cash"]
KycStatus = Literal["not_submitted", "pending", "approved", "rejected"]


class SendOtpReq(BaseModel):
    phone: str
    role: RoleType


class VerifyOtpReq(BaseModel):
    phone: str
    role: RoleType
    otp: str
    name: Optional[str] = None  # provided when signing up a new user


class UpdateUserReq(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


class KycReq(BaseModel):
    name: str
    aadhar_number: str
    aadhar_photo: str
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
    scheduled_at: Optional[str] = None
    notes: Optional[str] = None


class CancelReq(BaseModel):
    reason: str


class VerifyPinReq(BaseModel):
    pin: str


class SuggestFareReq(BaseModel):
    ride_type: str
    amount: float
    note: Optional[str] = None


class VoteReq(BaseModel):
    vote: Literal["up", "down"]


class WithdrawReq(BaseModel):
    amount: float


class LandmarkReq(BaseModel):
    name: str
    lat: float
    lng: float


class LandmarkUpdateReq(BaseModel):
    name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
