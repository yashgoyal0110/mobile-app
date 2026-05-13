"""Public fare configuration routes."""
from fastapi import APIRouter

from ..db import db
from ..utils import clean

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/fare")
async def get_fare_config():
    cfg = await db.fare_config.find_one({"id": "default"})
    return clean(cfg)
