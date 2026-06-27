"""Default seed data."""
from .config import ADMIN_PHONES
from .db import db
from .models import FareConfig
from .utils import now, new_id

SAMPLE_STAYS = [
    {
        "id": "stay-shri-giriraj-dharamshala",
        "name": "Shri Giriraj Dharamshala",
        "type": "dharamshala",
        "description": "Trust-run dharamshala steps from Daan Ghati Mandir. Clean rooms, "
                       "bhojanalaya on premises, ideal for family groups doing parikrama.",
        "address": "Daan Ghati Road, near Mukharvind Mandir, Govardhan",
        "area": "Daan Ghati",
        "lat": 27.4958, "lng": 77.4699,
        "contact_phone": "9690000001", "whatsapp": "9690000001",
        "price_min": 400, "price_max": 1200, "donation_based": False,
        "room_types": ["Single", "Double", "Family"],
        "capacity": 60,
        "amenities": ["parking", "food", "hot_water", "family_rooms", "elderly_friendly", "power_backup"],
        "photos": [],
        "verified": True, "available": True, "featured": True,
    },
    {
        "id": "stay-radha-kund-ashram",
        "name": "Radha Kund Seva Ashram",
        "type": "ashram",
        "description": "Peaceful ashram beside Radha Kund. Donation-based stay for pilgrims, "
                       "sattvic prasad served morning and evening.",
        "address": "Radha Kund Parikrama Marg, Govardhan",
        "area": "Radha Kund",
        "lat": 27.5472, "lng": 77.4525,
        "contact_phone": "9690000002", "whatsapp": "9690000002",
        "price_min": None, "price_max": None, "donation_based": True,
        "room_types": ["Dormitory", "Single"],
        "capacity": 40,
        "amenities": ["food", "hot_water", "locker"],
        "photos": [],
        "verified": True, "available": True, "featured": False,
    },
    {
        "id": "stay-jatipura-guest-house",
        "name": "Jatipura Yatri Guest House",
        "type": "guesthouse",
        "description": "Budget guest house near Jatipura Mukharvind, walking distance to the "
                       "parikrama start point. Good for first-time and outside-state pilgrims.",
        "address": "Jatipura Main Road, opp. Bus Stand, Govardhan",
        "area": "Jatipura",
        "lat": 27.4988, "lng": 77.4535,
        "contact_phone": "9690000003", "whatsapp": "9690000003",
        "price_min": 600, "price_max": 1800, "donation_based": False,
        "room_types": ["Double", "Family", "Deluxe AC"],
        "capacity": 30,
        "amenities": ["parking", "ac", "hot_water", "wifi", "family_rooms", "power_backup", "lift"],
        "photos": [],
        "verified": True, "available": True, "featured": True,
    },
    {
        "id": "stay-kusum-sarovar-lodge",
        "name": "Kusum Sarovar Pilgrim Lodge",
        "type": "lodge",
        "description": "Simple, clean lodge on the Kusum Sarovar route. Senior-citizen friendly "
                       "with ground-floor rooms and assisted check-in.",
        "address": "Kusum Sarovar Road, Govardhan",
        "area": "Kusum Sarovar",
        "lat": 27.5290, "lng": 77.4482,
        "contact_phone": "9690000004", "whatsapp": "9690000004",
        "price_min": 500, "price_max": 1000, "donation_based": False,
        "room_types": ["Single", "Double"],
        "capacity": 24,
        "amenities": ["parking", "hot_water", "elderly_friendly", "wheelchair"],
        "photos": [],
        "verified": True, "available": True, "featured": False,
    },
]


SAMPLE_TEMPLES = [
    {
        "id": "temple-mukharvind-jatipura",
        "name": "Mukharvind Mandir, Jatipura",
        "deity": "Shri Giriraj Ji (Mukharvind)",
        "description": "The mukharvind (mouth) of Giriraj Ji at Jatipura — the main "
                       "starting point of the Govardhan parikrama. Milk abhishek and "
                       "darshan through the day.",
        "address": "Jatipura, Govardhan, Mathura",
        "area": "Jatipura",
        "lat": 27.4985, "lng": 77.4615,
        "contact_phone": None,
        "darshan_slots": [
            {"label": "Morning Darshan", "open": "05:00", "close": "12:00"},
            {"label": "Evening Darshan", "open": "16:00", "close": "21:30"},
        ],
        "aarti_timings": [
            {"name": "Mangala Aarti", "time": "05:15"},
            {"name": "Rajbhog Aarti", "time": "11:30"},
            {"name": "Sandhya Aarti", "time": "19:00"},
        ],
        "crowd_level": "moderate",
        "entry_info": "Free entry. Milk/abhishek samagri available outside.",
        "special_note": None,
        "photos": [],
        "verified": True, "featured": True,
    },
    {
        "id": "temple-daan-ghati",
        "name": "Daan Ghati Mandir",
        "deity": "Shri Giriraj Ji",
        "description": "Famous Giriraj temple on the parikrama marg where pilgrims offer "
                       "daan. Very busy on Ekadashi, Purnima and Guru Purnima.",
        "address": "Daan Ghati, Govardhan, Mathura",
        "area": "Daan Ghati",
        "lat": 27.4961, "lng": 77.4694,
        "contact_phone": None,
        "darshan_slots": [
            {"label": "Morning Darshan", "open": "05:00", "close": "12:30"},
            {"label": "Evening Darshan", "open": "15:30", "close": "22:00"},
        ],
        "aarti_timings": [
            {"name": "Mangala Aarti", "time": "05:30"},
            {"name": "Sandhya Aarti", "time": "19:30"},
        ],
        "crowd_level": "high",
        "entry_info": "Free entry.",
        "special_note": "Heavy crowd on Ekadashi & Purnima — arrive early.",
        "photos": [],
        "verified": True, "featured": True,
    },
    {
        "id": "temple-radha-kund",
        "name": "Radha Kund & Shyam Kund",
        "deity": "Shri Radha Rani",
        "description": "The most sacred kunds of Braj. Snan (holy dip) is especially "
                       "auspicious on Ahoi Ashtami midnight.",
        "address": "Radha Kund, Govardhan, Mathura",
        "area": "Radha Kund",
        "lat": 27.5470, "lng": 77.4520,
        "contact_phone": None,
        "darshan_slots": [
            {"label": "Open all day", "open": "04:00", "close": "22:00"},
        ],
        "aarti_timings": [
            {"name": "Morning Aarti", "time": "06:00"},
            {"name": "Sandhya Aarti", "time": "18:30"},
        ],
        "crowd_level": "low",
        "entry_info": "Free. Snan ghats open through the day.",
        "special_note": None,
        "photos": [],
        "verified": True, "featured": False,
    },
    {
        "id": "temple-kusum-sarovar",
        "name": "Kusum Sarovar",
        "deity": "Radha-Krishna Leela Sthali",
        "description": "Historic sandstone sarovar and memorial. Peaceful spot on the "
                       "Govardhan–Radha Kund route, beautiful at sunset.",
        "address": "Kusum Sarovar Road, Govardhan, Mathura",
        "area": "Kusum Sarovar",
        "lat": 27.5288, "lng": 77.4478,
        "contact_phone": None,
        "darshan_slots": [
            {"label": "Open", "open": "06:00", "close": "19:00"},
        ],
        "aarti_timings": [
            {"name": "Sandhya Deepdaan", "time": "18:45"},
        ],
        "crowd_level": "low",
        "entry_info": "Free entry.",
        "special_note": None,
        "photos": [],
        "verified": True, "featured": False,
    },
]


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
    default_cfg = FareConfig().model_dump()
    if not cfg:
        default_cfg["id"] = "default"
        default_cfg["landmarks"] = GOVARDHAN_LANDMARKS
        default_cfg["updated_at"] = now()
        await db.fare_config.insert_one(default_cfg)
    else:
        # Backfill any newly-introduced fields without overwriting customised ones
        missing = {k: v for k, v in default_cfg.items() if k not in cfg}
        if missing:
            await db.fare_config.update_one({"id": "default"}, {"$set": missing})

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

    # Seed sample dharamshalas/guest-houses once (so the Stays tab is never empty
    # in a demo). Upserts by id, never overwrites admin edits made later.
    for stay in SAMPLE_STAYS:
        existing = await db.stays.find_one({"id": stay["id"]})
        if not existing:
            doc = dict(stay)
            doc["created_at"] = now()
            doc["updated_at"] = now()
            await db.stays.insert_one(doc)

    # Seed sample temples once (Temples tab never empty in a demo).
    for temple in SAMPLE_TEMPLES:
        existing = await db.temples.find_one({"id": temple["id"]})
        if not existing:
            doc = dict(temple)
            doc["created_at"] = now()
            doc["updated_at"] = now()
            doc["crowd_updated_at"] = now() if doc.get("crowd_level") else None
            await db.temples.insert_one(doc)


async def ensure_indexes():
    """Idempotent index creation. Safe to call on every startup."""
    await db.users.create_index("id", unique=True)
    await db.users.create_index("phone")
    await db.drivers.create_index("user_id", unique=True)
    await db.drivers.create_index([("online", 1), ("kyc_status", 1)])
    await db.rides.create_index("id", unique=True)
    await db.rides.create_index("passenger_id")
    await db.rides.create_index("driver_id")
    await db.rides.create_index([("status", 1), ("created_at", -1)])
    await db.stays.create_index("id", unique=True)
    await db.stays.create_index([("verified", 1), ("type", 1)])
    await db.stays.create_index("area")
    await db.temples.create_index("id", unique=True)
    await db.temples.create_index([("verified", 1), ("featured", -1)])
    await db.temples.create_index("area")
    await db.complaints.create_index([("status", 1), ("created_at", -1)])
