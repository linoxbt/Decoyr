"""Trial/agent/run state and API serialization."""
from __future__ import annotations

import json
import os

from fastapi import HTTPException

from . import db, inference, scenarios
from .config import settings
from .ids import new_id, now_iso

FINAL_TRIAL_STATUSES = frozenset({"observed", "compromised", "contained", "failed"})

HARDENING_DOCKER = ["non-root uid 10001", "cap-drop ALL", "no-new-privileges", "read-only rootfs", "per-run internal network (no internet)", "no Docker socket", "CPU/memory/PID limits", "wall-clock kill"]
HARDENING_PROCESS = ["separate OS process", "minimal environment (no control-plane secrets)", "wall-clock kill", "dev mode: not a security boundary"]

NEXT_ACTION = {
    "draft": "Review the World, then start the baseline trial.",
    "preparing": "The sandbox is being prepared for the baseline run.",
    "running": "The baseline is running inside the sandbox. Watch the Live Trial.",
    "compromised": "Unsafe behavior was observed. Derive Minimum Authority from the evidence.",
    "observed": "Baseline complete. Derive Minimum Authority to remove capabilities the task did not need.",
    "calibrating": "Deriving Minimum Viable Authority from the baseline evidence.",
    "guarded": "Guard compiled. Replay the identical trial with Guard.",
    "replaying": "Guarded replay running: same agent, world, task and attack.",
    "contained": "Contained for this tested scope. Review the Passport.",
    "failed": "The last run failed. Review the evidence, then recalibrate or reset.",
}


def http404(what: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{what} not found")


# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------

def ensure_builtin_agents() -> None:
    for a in scenarios.BUILTIN_AGENTS:
        if not db.get_one(db.agents, id=a["id"]):
            db.insert_row(db.agents, {
                "id": a["id"], "name": a["name"], "version": a["version"], "purpose": a["purpose"],
                "model": "", "requested_capabilities": a["requestedCapabilities"],
                "config": {"systemPrompt": a["systemPrompt"]}, "builtin": 1, "created_at": now_iso(),
            })


def agent_runtime(a: dict) -> str:
    """The agent's runtime image if the operator allows it, else the default candidate image."""
    rt = ((a.get("config") or {}).get("runtime") or "").strip()
    return rt if rt in settings.candidate_images else settings.candidate_image


def agent_to_api(a: dict, with_stats: bool = False) -> dict:
    out = {
        "id": a["id"], "name": a["name"], "version": a["version"], "purpose": a["purpose"],
        "model": inference.model_for(a["model"]) if a["model"] else inference.info()["model"], "requestedCapabilities": a["requested_capabilities"],
        "builtin": bool(a["builtin"]), "createdAt": a["created_at"],
        "systemPrompt": (a.get("config") or {}).get("systemPrompt") or "",
        "runtime": agent_runtime(a),
    }
    if with_stats:
        ts = db.get_many(db.trials, order_by=[db.trials.c.updated_at.desc()], agent_id=a["id"])
        out["trialCount"] = len(ts)
        out["lastTestedAt"] = ts[0]["updated_at"] if ts else None
        cal = next((t for t in ts if t["status"] == "contained"), None)
        out["latestCalibration"] = f"Calibrated: Release Notes / {scenarios.manifest(cal['world_version'])['worldName']}" if cal else None
    return out


def get_or_create_agent(spec: dict) -> dict:
    pid = spec.get("profileId")
    base = db.get_one(db.agents, id=pid) if pid else None
    caps = [c for c in spec.get("requestedCapabilities", []) if c in scenarios.CAP_INDEX]
    base_cfg = (base or {}).get("config") or {}
    prompt_in = (spec.get("systemPrompt") or "").strip()
    runtime_in = (spec.get("runtime") or "").strip()
    if base and base["name"] == spec.get("name", base["name"]) and base["version"] == spec.get("version", base["version"]) \
            and sorted(base["requested_capabilities"]) == sorted(caps or base["requested_capabilities"]) \
            and (not spec.get("model") or spec.get("model") == base["model"]) \
            and (not prompt_in or prompt_in == (base_cfg.get("systemPrompt") or "").strip()) \
            and (not runtime_in or runtime_in == (base_cfg.get("runtime") or settings.candidate_image)):
        return base
    system_prompt = prompt_in or base_cfg.get("systemPrompt") or scenarios.RESEARCHBOT_PROMPT
    config = {"systemPrompt": system_prompt[:8000]}
    if runtime_in:
        config["runtime"] = runtime_in
    row = {
        "id": new_id("agt"), "name": spec["name"][:120], "version": spec["version"][:40], "purpose": spec.get("purpose", "")[:500],
        "model": spec.get("model") or "", "requested_capabilities": caps, "config": config, "builtin": 0,
        "created_at": now_iso(),
    }
    db.insert_row(db.agents, row)
    return row


# ---------------------------------------------------------------------------
# Trials
# ---------------------------------------------------------------------------

def create_trial(agent: dict, world_version: str, task_id: str, pack: list[str], name: str | None = None) -> dict:
    m = scenarios.manifest(world_version)
    if task_id != m["task"]["id"]:
        raise HTTPException(400, f"unknown task {task_id}")
    pack = [p for p in pack if p in {x["id"] for x in scenarios.PACKS}] or ["indirect-injection-v1"]
    if "indirect-injection-v1" not in pack:
        pack.insert(0, "indirect-injection-v1")
    tid = new_id("trl")
    short = os.urandom(2).hex()
    seed = f"trial_{short}"
    raw, sha = scenarios.render_world(world_version, "indirect-injection-v1", seed, pack)
    now = now_iso()
    row = {
        "id": tid, "short_id": short, "name": name or f"{agent['name']} {agent['version']} · Release notes",
        "agent_id": agent["id"], "world_version": world_version, "scenario_id": "indirect-injection-v1", "scenario_pack": pack,
        "task_id": task_id, "seed": seed, "world_json": raw, "world_sha256": sha, "status": "draft", "conclusion": "not_tested",
        "guard_id": None, "error": None, "created_at": now, "updated_at": now,
    }
    db.insert_row(db.trials, row)
    return row


def get_trial(trial_id: str) -> dict:
    t = db.get_one(db.trials, id=trial_id)
    if not t:
        raise http404("Trial")
    return t


def set_trial(trial_id: str, **values) -> None:
    values["updated_at"] = now_iso()
    db.update_row(db.trials, "id", trial_id, values)


def trial_runs(trial_id: str) -> list[dict]:
    return db.get_many(db.runs, order_by=[db.runs.c.created_at], trial_id=trial_id)


def run_to_api(r: dict) -> dict:
    from .analysis import db as _  # noqa: F401  (keeps import graph simple)

    arts = db.get_many(db.artifacts, order_by=[db.artifacts.c.created_at], run_id=r["id"])
    dur = None
    if r["started_at"] and r["ended_at"]:
        from .ids import parse_iso
        dur = int((parse_iso(r["ended_at"]) - parse_iso(r["started_at"])).total_seconds() * 1000)
    return {
        "id": r["id"], "trialId": r["trial_id"], "type": r["type"], "status": r["status"], "guardId": r["guard_id"],
        "startedAt": r["started_at"], "endedAt": r["ended_at"], "durationMs": dur,
        "taskResult": r["task_result"], "securityResult": r["security_result"],
        "toolCalls": r["tool_calls"], "modelCalls": r["model_calls"], "deniedCalls": r["denied_calls"],
        "assertions": r["assertions"] or [],
        "artifacts": [{"id": a["id"], "path": a["path"], "sha256": a["sha256"], "size": a["size"]} for a in arts],
        "sandbox": r["sandbox"], "error": r["error"],
    }


def trial_to_api(t: dict) -> dict:
    agent = db.get_one(db.agents, id=t["agent_id"]) or {}
    runs = trial_runs(t["id"])
    m = scenarios.manifest(t["world_version"])
    task_defs, sec_defs = scenarios.assertions_for(t["scenario_pack"])
    baseline = [r for r in runs if r["type"] == "baseline"]
    replays = [r for r in runs if r["type"] == "replay"]
    active = [r for r in runs if r["status"] in ("queued", "preparing", "running")]
    findings = db.get_many(db.findings, trial_id=t["id"])
    next_action = NEXT_ACTION.get(t["status"], "")
    if t["status"] == "failed" and t.get("error"):
        next_action = f"{t['error']} Reset or retry the run."
    return {
        "id": t["id"], "shortId": t["short_id"], "name": t["name"], "agent": agent_to_api(agent) if agent else None,
        "worldVersion": t["world_version"], "worldName": m["worldName"], "scenarioId": t["scenario_id"],
        "scenarioPack": t["scenario_pack"], "seed": t["seed"], "scenarioSha256": t["world_sha256"],
        "legitimateGoal": m["task"]["goal"], "successAssertions": task_defs, "securityAssertions": sec_defs,
        "status": t["status"], "conclusion": t["conclusion"], "nextAction": next_action,
        "runs": [run_to_api(r) for r in runs],
        "baselineRunId": baseline[-1]["id"] if baseline else None,
        "replayRunId": replays[-1]["id"] if replays else None,
        "activeRunId": active[-1]["id"] if active else None,
        "guardId": t["guard_id"], "findingCount": len(findings), "inference": inference.info(),
        "createdAt": t["created_at"], "updatedAt": t["updated_at"],
    }


def trial_list_item(t: dict) -> dict:
    full = trial_to_api(t)
    last = full["runs"][-1] if full["runs"] else None
    keys = ["id", "shortId", "name", "agent", "worldVersion", "worldName", "status", "conclusion", "createdAt", "updatedAt", "baselineRunId", "replayRunId", "guardId", "findingCount"]
    out = {k: full[k] for k in keys}
    out["taskResult"] = last["taskResult"] if last else "pending"
    out["securityResult"] = last["securityResult"] if last else "pending"
    out["purpose"] = full["agent"]["purpose"] if full["agent"] else ""
    return out


def sandbox_info(run_id: str, drill: bool = False) -> dict:
    docker_mode = settings.sandbox == "docker"
    return {
        "mode": "docker" if docker_mode else "process",
        "container": None, "network": f"decoyr-run-{run_id[-12:]}" if docker_mode else None,
        "image": settings.candidate_image if docker_mode else None,
        "limits": scenarios.limits(),
        "hardening": HARDENING_DOCKER if docker_mode else HARDENING_PROCESS,
        "destroyed": False, "exitCode": None, "logTail": [],
    }


def dumps(o) -> str:
    return json.dumps(o, sort_keys=True, separators=(",", ":"))
