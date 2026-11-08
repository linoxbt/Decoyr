"""Test setup: isolated SQLite database per session, keyless (simulated) inference."""
import os
import sys
import tempfile
from pathlib import Path

_tmp = tempfile.mkdtemp(prefix="decoyr-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ.pop("VULTR_SERVERLESS_INFERENCE_API_KEY", None)
os.environ.setdefault("DECOYR_SANDBOX", "process")
# Disable the public-demo abuse limits for the suite (the TestClient hammers routes from one IP).
os.environ["DECOYR_IP_ACTIONS_PER_10MIN"] = "0"
os.environ["DECOYR_IP_RUNS_PER_10MIN"] = "0"
os.environ["DECOYR_DAILY_MODEL_CALLS"] = "0"
os.environ["TRIAL_RATE_PER_HOUR"] = "100000"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from decoyr import main

    with TestClient(main.app) as c:
        yield c
