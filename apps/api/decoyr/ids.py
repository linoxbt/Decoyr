from __future__ import annotations

import os
import time
from datetime import datetime, timezone

_ALPH = "0123456789abcdefghjkmnpqrstvwxyz"


def new_id(prefix: str) -> str:
    """Sortable id: prefix + 10 chars time + 8 chars random (ULID-like, Crockford-ish base32)."""
    t = int(time.time() * 1000)
    ts = ""
    for _ in range(10):
        ts = _ALPH[t % 32] + ts
        t //= 32
    rnd = "".join(_ALPH[b % 32] for b in os.urandom(8))
    return f"{prefix}_{ts}{rnd}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00"))
