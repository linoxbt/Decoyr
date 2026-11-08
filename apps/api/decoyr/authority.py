"""Authority engine + Guard compiler — PLACEHOLDER.

Not implemented in this repository yet. Required interface:
  calibrate(trial_id) -> AuthorityReport dict (and persists a Guard row, sets trial.guard_id)
  report(trial_id) -> AuthorityReport dict
Until implemented, POST /calibrate responds 501 and GET /authority returns status "not_started".
"""
from __future__ import annotations

from fastapi import HTTPException

from . import db

IMPLEMENTED = False
MESSAGE = "Authority engine is not configured in this deployment (apps/api/decoyr/authority.py is a placeholder)."


def calibrate(trial_id: str) -> dict:
    raise HTTPException(status_code=501, detail=MESSAGE)


def report(trial_id: str) -> dict:
    row = db.get_one(db.authority, trial_id=trial_id)
    if row:
        return row["data"]
    return {
        "trialId": trial_id, "status": "not_started", "baselineRunId": None, "capabilities": [], "iterations": [],
        "summary": {k: 0 for k in ("requested", "observed", "required", "constrained", "unnecessary", "dangerous", "untested", "removed", "narrowed")},
        "deltaText": "", "rationaleSource": "deterministic", "generatedAt": None,
    }
