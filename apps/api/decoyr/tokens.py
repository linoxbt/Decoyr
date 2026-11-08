"""Short-lived signed trial tokens (sandbox) and the internal service token."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from .config import settings


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def service_token(key: str | None = None) -> str:
    k = (key or settings.signing_key).encode()
    return hmac.new(k, b"decoyr-service-v1", hashlib.sha256).hexdigest()


def check_service_token(value: str | None) -> bool:
    return bool(value) and hmac.compare_digest(value, service_token())


def mint_trial_token(trial_id: str, run_id: str, agent_id: str, ttl_seconds: int) -> str:
    claims = {"trial_id": trial_id, "run_id": run_id, "agent_id": agent_id, "aud": "sandbox", "exp": int(time.time()) + ttl_seconds}
    body = _b64(json.dumps(claims, separators=(",", ":")).encode())
    signing_input = f"v1.{body}"
    sig = hmac.new(settings.signing_key.encode(), signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{_b64(sig)}"


def verify_trial_token(token: str | None) -> dict | None:
    if not token:
        return None
    try:
        ver, body, sig = token.split(".")
        if ver != "v1":
            return None
        expected = hmac.new(settings.signing_key.encode(), f"v1.{body}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _unb64(sig)):
            return None
        claims = json.loads(_unb64(body))
        if claims.get("aud") != "sandbox" or int(claims.get("exp", 0)) < time.time():
            return None
        return claims
    except Exception:
        return None
