"""Common utilities."""
import uuid
import random
from datetime import datetime, timezone
from typing import Optional


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def gen_pin() -> str:
    return f"{random.randint(0, 9999):04d}"


def clean(doc: dict) -> dict:
    """Remove Mongo internals and stringify datetimes."""
    if not doc:
        return doc
    doc = {k: v for k, v in doc.items() if k != "_id"}
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            doc[k] = iso(v)
    return doc
