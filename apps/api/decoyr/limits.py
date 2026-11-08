"""In-process abuse limits for the public demo surface.

All state lives in this process's memory, so the api MUST run a single worker (apps/api/Dockerfile
pins ``uvicorn --workers 1``). Two independent controls:

* per-client sliding-window limits (``rate_limit``), keyed by client IP, for cheap-but-spammable
  actions and for the expensive run/replay routes that launch containers and model calls;
* a global per-UTC-day ceiling on real model calls (``reserve_model_call``) so back-to-back runs
  can't drain the operator's inference bill — the per-run budget alone can't bound that.

Limits with a value of 0 are disabled (the open-demo / test default).
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from fastapi import HTTPException, Request

from .config import settings

_lock = threading.Lock()
# (bucket, client-ip) -> monotonic timestamps of recent hits, oldest first.
_hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
# UTC day string -> model calls reserved that day.
_model_day: dict[str, int] = {}


def client_ip(request: Request) -> str:
    """Best-effort client IP. Caddy sets X-Forwarded-For; take the first (original) hop."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


def rate_limit(request: Request, bucket: str, limit: int, window_seconds: float = 600.0) -> None:
    """Raise 429 if this client has already made ``limit`` ``bucket`` hits in the window.

    A hit is only recorded when the request is allowed, so a rejected request does not extend
    the window. ``limit <= 0`` disables the bucket entirely.
    """
    if limit <= 0:
        return
    ip = client_ip(request)
    now = time.monotonic()
    cutoff = now - window_seconds
    key = (bucket, ip)
    with _lock:
        hits = _hits[key]
        while hits and hits[0] < cutoff:
            hits.popleft()
        if len(hits) >= limit:
            retry = max(1, int(hits[0] + window_seconds - now))
            raise HTTPException(
                429,
                f"Rate limit reached ({limit} per {int(window_seconds // 60)} min). Try again in ~{retry}s.",
                headers={"Retry-After": str(retry)},
            )
        hits.append(now)
        # Opportunistic cleanup so idle keys don't accumulate forever.
        if len(_hits) > 4096:
            for k in [k for k, v in _hits.items() if not v or v[-1] < cutoff]:
                _hits.pop(k, None)


def reserve_model_call() -> bool:
    """Reserve one real model call against today's global budget.

    Returns True if within budget (and the call is counted), False if the day's ceiling is hit.
    A budget of 0 disables the ceiling (always True). Counts only real reservations; callers that
    short-circuit to the simulated model should not call this.
    """
    limit = settings.daily_model_calls
    if limit <= 0:
        return True
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with _lock:
        used = _model_day.get(day, 0)
        if used >= limit:
            return False
        _model_day[day] = used + 1
        # Drop stale days so the dict stays tiny.
        if len(_model_day) > 7:
            for d in [d for d in _model_day if d != day]:
                _model_day.pop(d, None)
    return True


def _reset_for_tests() -> None:  # pragma: no cover - test helper
    with _lock:
        _hits.clear()
        _model_day.clear()
