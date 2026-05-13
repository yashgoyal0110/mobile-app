"""JWT helpers + auth dependencies."""
from datetime import timedelta
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from .config import JWT_SECRET, JWT_ALG, JWT_EXPIRE_DAYS
from .db import db
from .utils import now

bearer = HTTPBearer(auto_error=False)


def make_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "iat": int(now().timestamp()),
        "exp": int((now() + timedelta(days=JWT_EXPIRE_DAYS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    # Accept token from either standard Authorization header OR custom X-Auth-Token
    # header. The custom header is needed because some ingresses 307-redirect
    # cross-origin and browsers strip the Authorization header on cross-origin
    # redirects (per fetch spec).
    token = None
    if creds and creds.credentials:
        token = creds.credentials
    if not token:
        token = request.headers.get("x-auth-token") or request.headers.get("X-Auth-Token")
    if not token:
        raise HTTPException(401, "Missing token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(401, "User not found")
    return user


def require_role(*roles: str):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, f"Requires role: {', '.join(roles)}")
        return user

    return checker
