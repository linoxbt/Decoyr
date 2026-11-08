"""Ed25519 signatures for Passports.

The control plane generates one Ed25519 key pair on first use and stores it in the database, so
signatures stay verifiable across restarts and redeploys. Anyone can fetch the public key
(GET /api/v1/passports/public-key) and verify a Passport offline, or ask the API to verify one
(POST /api/v1/passports/verify). The signature covers the canonical JSON of the whole Passport
except the "signature" field itself, so any edit to any field invalidates it.
"""
from __future__ import annotations

import base64
import hashlib
import json
import threading
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

from . import db
from .ids import now_iso

KEY_NAME = "passport-ed25519-v1"
ALG = "Ed25519"
_lock = threading.Lock()
_cached: Ed25519PrivateKey | None = None


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def _private_key() -> Ed25519PrivateKey:
    global _cached
    if _cached is not None:
        return _cached
    with _lock:
        if _cached is not None:
            return _cached
        row = db.get_one(db.keys, name=KEY_NAME)
        if row is None:
            key = Ed25519PrivateKey.generate()
            raw = key.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
            try:
                db.insert_row(db.keys, {"name": KEY_NAME, "value": _b64(raw), "created_at": now_iso()})
            except Exception:  # another worker created it first: use theirs
                pass
            row = db.get_one(db.keys, name=KEY_NAME)
        _cached = Ed25519PrivateKey.from_private_bytes(base64.b64decode(row["value"]))
        return _cached


def _public_raw() -> bytes:
    return _private_key().public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)


def key_id() -> str:
    return hashlib.sha256(_public_raw()).hexdigest()[:16]


def public_key_info() -> dict:
    pem = _private_key().public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    return {"alg": ALG, "keyId": key_id(), "publicKey": _b64(_public_raw()), "publicKeyPem": pem,
            "signs": "canonical JSON of the Passport without its 'signature' field (sorted keys, no whitespace, UTF-8)"}


def canonical(doc: dict) -> bytes:
    body = {k: v for k, v in doc.items() if k != "signature"}
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def sign(doc: dict) -> dict:
    """Return a copy of doc with a detached Ed25519 signature over its canonical form."""
    sig = _private_key().sign(canonical(doc))
    return {**{k: v for k, v in doc.items() if k != "signature"},
            "signature": {"alg": ALG, "keyId": key_id(), "value": _b64(sig),
                          "payloadSha256": hashlib.sha256(canonical(doc)).hexdigest()}}


def verify(doc: Any) -> dict:
    if not isinstance(doc, dict) or not isinstance(doc.get("signature"), dict):
        return {"valid": False, "reason": "No signature found on this document."}
    s = doc["signature"]
    if s.get("alg") != ALG:
        return {"valid": False, "reason": f"Unsupported algorithm {s.get('alg')!r}."}
    if s.get("keyId") != key_id():
        return {"valid": False, "keyId": s.get("keyId"), "reason": "Signed by a different key than this deployment's Passport key."}
    try:
        Ed25519PublicKey.from_public_bytes(_public_raw()).verify(base64.b64decode(s.get("value", "")), canonical(doc))
    except (InvalidSignature, ValueError):
        return {"valid": False, "keyId": s.get("keyId"), "reason": "Signature does not match: the Passport was altered or not issued by this deployment."}
    return {"valid": True, "keyId": s.get("keyId"), "reason": "Signature valid: issued by this Decoyr deployment and unaltered."}
