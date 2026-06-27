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
    dispatch_radius_km: float = 5.0
    surge_pct: float = 0.0
    support_phone: Optional[str] = None


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


class TipReq(BaseModel):
    amount: float  # increment on top of current fare (e.g. 10 or 20)


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


class RateRideReq(BaseModel):
    stars: int  # 1..5
    comment: Optional[str] = None


class ComplaintReq(BaseModel):
    category: Literal[
        "rash_driving", "rude_behaviour", "overcharge", "vehicle_unsafe",
        "no_show", "wrong_route", "payment_issue", "lost_item", "other",
    ]
    description: str
    against: Optional[Literal["driver", "passenger"]] = None  # admin can leave blank


class ResolveComplaintReq(BaseModel):
    resolution: str
    status: Literal["resolved", "rejected"] = "resolved"


# ---------- Stays (Dharamshala / Guest-house discovery) ----------
StayType = Literal["dharamshala", "guesthouse", "ashram", "lodge", "hotel"]

# Amenity keys understood by the frontend (rendered as icons/labels).
AMENITY_KEYS = {
    "parking", "food", "ac", "hot_water", "wifi", "lift",
    "family_rooms", "elderly_friendly", "wheelchair", "locker", "power_backup",
}


class StayReq(BaseModel):
    name: str
    type: StayType = "dharamshala"
    description: Optional[str] = None
    address: str
    area: Optional[str] = None            # e.g. "Jatipura", "Daan Ghati"
    lat: Optional[float] = None
    lng: Optional[float] = None
    contact_phone: str
    whatsapp: Optional[str] = None        # falls back to contact_phone if empty
    price_min: Optional[float] = None     # indicative ₹/night; None => donation/on-request
    price_max: Optional[float] = None
    donation_based: bool = False
    room_types: List[str] = []            # e.g. ["Single", "Family", "Dormitory"]
    capacity: Optional[int] = None        # approx rooms or beds
    amenities: List[str] = []             # subset of AMENITY_KEYS
    photos: List[str] = []                # urls or base64 data-URIs
    verified: bool = False
    available: bool = True
    featured: bool = False


class StayUpdateReq(BaseModel):
    name: Optional[str] = None
    type: Optional[StayType] = None
    description: Optional[str] = None
    address: Optional[str] = None
    area: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    contact_phone: Optional[str] = None
    whatsapp: Optional[str] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    donation_based: Optional[bool] = None
    room_types: Optional[List[str]] = None
    capacity: Optional[int] = None
    amenities: Optional[List[str]] = None
    photos: Optional[List[str]] = None
    verified: Optional[bool] = None
    available: Optional[bool] = None
    featured: Optional[bool] = None


# ---------- Temples (darshan timings / aarti / crowd) ----------
CrowdLevel = Literal["low", "moderate", "high", "very_high"]


class DarshanSlot(BaseModel):
    label: Optional[str] = None      # e.g. "Morning Darshan", "Shringar"
    open: str                        # "HH:MM" 24h IST
    close: str                       # "HH:MM" 24h IST


class AartiTiming(BaseModel):
    name: str                        # e.g. "Mangala Aarti"
    time: str                        # "HH:MM" 24h IST


class TempleReq(BaseModel):
    name: str
    deity: Optional[str] = None
    description: Optional[str] = None
    address: str
    area: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    contact_phone: Optional[str] = None
    darshan_slots: List[DarshanSlot] = []
    aarti_timings: List[AartiTiming] = []
    crowd_level: Optional[CrowdLevel] = None   # admin-set, optional
    entry_info: Optional[str] = None           # free text: entry fee / rules
    special_note: Optional[str] = None         # festival / temporary timing notes
    photos: List[str] = []
    verified: bool = False
    featured: bool = False


class TempleUpdateReq(BaseModel):
    name: Optional[str] = None
    deity: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    area: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    contact_phone: Optional[str] = None
    darshan_slots: Optional[List[DarshanSlot]] = None
    aarti_timings: Optional[List[AartiTiming]] = None
    crowd_level: Optional[CrowdLevel] = None
    entry_info: Optional[str] = None
    special_note: Optional[str] = None
    photos: Optional[List[str]] = None
    verified: Optional[bool] = None
    featured: Optional[bool] = None
