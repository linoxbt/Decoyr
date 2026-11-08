"""Run orchestrator — PLACEHOLDER.

Not implemented in this repository yet. Required interface (see docs/contracts.md):
  start_run(trial_id: str, run_type: "baseline"|"replay") -> run row
  stop_run(trial_id: str) -> run row
  recover_orphans() -> None
Until implemented, run endpoints respond 501 with an explicit message.
"""
from __future__ import annotations

from fastapi import HTTPException

IMPLEMENTED = False
MESSAGE = "Run orchestrator is not configured in this deployment (apps/api/decoyr/orchestrator.py is a placeholder)."


def docker_available() -> bool:
    try:
        import docker

        docker.from_env(timeout=3).ping()
        return True
    except Exception:
        return False


def start_run(trial_id: str, run_type: str) -> dict:
    raise HTTPException(status_code=501, detail=MESSAGE)


def stop_run(trial_id: str) -> dict:
    raise HTTPException(status_code=501, detail=MESSAGE)


def recover_orphans() -> None:
    return None
