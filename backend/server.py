"""
TirthRide Backend — FastAPI + MongoDB
E-rickshaw booking & management for Govardhan, Mathura.

This is the thin app entry-point. Business routes live under app/routes/*.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from app.seed import ensure_seed, ensure_indexes
from app.db import db, close as close_db
from app.routes import (
    auth as auth_routes,
    users as users_routes,
    config as config_routes,
    drivers as drivers_routes,
    rides as rides_routes,
    suggestions as suggestions_routes,
    admin as admin_routes,
    geo as geo_routes,
    ws as ws_routes,
    ratings as ratings_routes,
    stays as stays_routes,
    temples as temples_routes,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("tirthride")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_seed()
    await ensure_indexes()
    logger.info("TirthRide API started")
    yield
    await close_db()


app = FastAPI(title="TirthRide API", version="1.0.0", lifespan=lifespan)
api = APIRouter(prefix="/api")

# Mount sub-routers
api.include_router(auth_routes.router)
api.include_router(users_routes.router)
api.include_router(config_routes.router)
api.include_router(drivers_routes.router)
api.include_router(rides_routes.router)
api.include_router(suggestions_routes.router)
api.include_router(admin_routes.router)
api.include_router(geo_routes.router)
api.include_router(ws_routes.router)
api.include_router(ratings_routes.router)
api.include_router(ratings_routes.admin_router)
api.include_router(stays_routes.router)
api.include_router(stays_routes.admin_router)
api.include_router(temples_routes.router)
api.include_router(temples_routes.admin_router)


@api.get("/")
async def root():
    return {"app": "TirthRide", "status": "running", "version": "1.0.0"}


@api.get("/health")
async def health():
    """Liveness/readiness probe (used by Cloud Run / load balancers)."""
    try:
        await db.command("ping")
        db_ok = True
    except Exception:  # pragma: no cover - surfaced via status field
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "db": db_ok}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
