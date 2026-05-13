"""Default seed data."""
from .config import ADMIN_PHONES
from .db import db
from .models import FareConfig
from .utils import now, new_id

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
    cfg = await db.fare_config.find_one({"id": "default"})
    if not cfg:
        default_cfg = FareConfig().model_dump()
        default_cfg["id"] = "default"
        default_cfg["landmarks"] = GOVARDHAN_LANDMARKS
        default_cfg["updated_at"] = now()
        await db.fare_config.insert_one(default_cfg)

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
