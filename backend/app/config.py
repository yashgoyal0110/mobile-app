"""App constants / env-driven config."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

JWT_SECRET = os.environ.get("JWT_SECRET", "tirthride-dev-secret-change-in-prod")
JWT_ALG = "HS256"
JWT_EXPIRE_DAYS = 30
ADMIN_PHONES = [p.strip() for p in os.environ.get("ADMIN_PHONES", "9999999999").split(",")]
MOCK_OTP = os.environ.get("MOCK_OTP", "123456")

# Geo provider config - swap to google later by switching this
GEO_PROVIDER = os.environ.get("GEO_PROVIDER", "osm")  # 'osm' or 'google'
NOMINATIM_URL = os.environ.get("NOMINATIM_URL", "https://nominatim.openstreetmap.org")
OSRM_URL = os.environ.get("OSRM_URL", "https://router.project-osrm.org")
GOOGLE_MAPS_KEY = os.environ.get("GOOGLE_MAPS_KEY", "")

# Govardhan bounding box: roughly 27.42-27.58 N, 77.40-77.55 E
REGION_BBOX = {
    "south": float(os.environ.get("REGION_SOUTH", "27.40")),
    "north": float(os.environ.get("REGION_NORTH", "27.60")),
    "west": float(os.environ.get("REGION_WEST", "77.38")),
    "east": float(os.environ.get("REGION_EAST", "77.58")),
}
REGION_CENTER = {"lat": 27.4985, "lng": 77.4615}
USER_AGENT = "TirthRide/1.0 (govardhan-e-rickshaw)"
