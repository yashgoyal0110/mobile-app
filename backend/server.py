"""
TirthRide Backend — FastAPI + MongoDB
E-rickshaw booking & management for Govardhan, Mathura.

This is the thin app entry-point. Business routes live under app/routes/*.
"""
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from app.seed import ensure_seed
from app.db import close as close_db
from app.routes import (
    auth as auth_routes,
    users as users_routes,
    config as config_routes,
    drivers as drivers_routes,
    rides as rides_routes,
    suggestions as suggestions_routes,
    admin as admin_routes,
    geo as geo_routes,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("tirthride")

app = FastAPI(title="TirthRide API", version="1.0.0")
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


@api.get("/")
async def root():
    return {"app": "TirthRide", "status": "running", "version": "1.0.0"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    await ensure_seed()
    logger.info("TirthRide API started")


@app.on_event("shutdown")
async def _shutdown():
    await close_db()
