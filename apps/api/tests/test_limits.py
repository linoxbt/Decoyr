"""Per-client rate limit + global daily model-call budget (decoyr.limits)."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from decoyr import limits
from decoyr.config import settings


def _req(ip: str = "203.0.113.7", xff: str | None = None):
    headers = {"x-forwarded-for": xff} if xff else {}
    return SimpleNamespace(headers=headers, client=SimpleNamespace(host=ip))


def setup_function():
    limits._reset_for_tests()


def test_rate_limit_blocks_after_limit():
    r = _req()
    for _ in range(3):
        limits.rate_limit(r, "action", 3)  # first 3 allowed
    with pytest.raises(HTTPException) as e:
        limits.rate_limit(r, "action", 3)
    assert e.value.status_code == 429
    assert "Retry-After" in e.value.headers


def test_rate_limit_is_per_ip_and_per_bucket():
    limits.rate_limit(_req("1.1.1.1"), "run", 1)
    # Different IP, same bucket: allowed.
    limits.rate_limit(_req("2.2.2.2"), "run", 1)
    # Same IP, different bucket: allowed.
    limits.rate_limit(_req("1.1.1.1"), "action", 1)
    # Same IP, same bucket again: blocked.
    with pytest.raises(HTTPException):
        limits.rate_limit(_req("1.1.1.1"), "run", 1)


def test_rate_limit_disabled_when_zero():
    r = _req()
    for _ in range(100):
        limits.rate_limit(r, "action", 0)  # never raises


def test_xff_first_hop_is_the_client():
    # Same original client behind different proxy hops shares a bucket.
    limits.rate_limit(_req("10.0.0.1", xff="9.9.9.9, 10.0.0.1"), "run", 1)
    with pytest.raises(HTTPException):
        limits.rate_limit(_req("10.0.0.2", xff="9.9.9.9, 10.0.0.2"), "run", 1)


def test_daily_model_budget(monkeypatch):
    object.__setattr__(settings, "daily_model_calls", 2)
    try:
        assert limits.reserve_model_call() is True
        assert limits.reserve_model_call() is True
        assert limits.reserve_model_call() is False  # budget exhausted
    finally:
        object.__setattr__(settings, "daily_model_calls", 0)


def test_daily_model_budget_disabled_when_zero():
    object.__setattr__(settings, "daily_model_calls", 0)
    for _ in range(50):
        assert limits.reserve_model_call() is True


def test_run_route_returns_429_when_ip_limit_hit(client):
    """End-to-end: the /run route is gated by gate_run -> limits.rate_limit."""
    limits._reset_for_tests()
    object.__setattr__(settings, "ip_runs_per_10min", 2)
    try:
        t = client.post("/api/v1/trials/prepared-demo").json()
        tid = t["id"]
        codes = [client.post(f"/api/v1/trials/{tid}/run").status_code for _ in range(4)]
        # First 2 pass the IP gate (then hit per-trial 409 or 200); the 3rd+ are gate-rejected 429.
        assert 429 in codes
        assert codes.index(429) >= 2
    finally:
        object.__setattr__(settings, "ip_runs_per_10min", 0)
        limits._reset_for_tests()


def test_check_startup_rejects_dev_key_on_deployment():
    import pytest
    from decoyr.config import settings
    # Non-local deployment with the dev default key must refuse to start.
    orig_host, orig_key = settings.host_provider, settings.signing_key
    object.__setattr__(settings, "host_provider", "vultr")
    object.__setattr__(settings, "signing_key", "dev-signing-key")
    try:
        with pytest.raises(RuntimeError):
            settings.check_startup()
        # A real key is accepted.
        object.__setattr__(settings, "signing_key", "a" * 48)
        settings.check_startup()
    finally:
        object.__setattr__(settings, "host_provider", orig_host)
        object.__setattr__(settings, "signing_key", orig_key)
