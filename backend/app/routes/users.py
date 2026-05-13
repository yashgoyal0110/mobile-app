"""User routes."""
from fastapi import APIRouter, Depends

from ..db import db
from ..deps import get_current_user
from ..models import UpdateUserReq
from ..utils import clean

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me")
async def update_me(req: UpdateUserReq, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    fresh = await db.users.find_one({"id": user["id"]})
    return clean(fresh)
