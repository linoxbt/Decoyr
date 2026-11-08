"""Run orchestrator: per-run sandbox lifecycle.

start_run(trial_id, "baseline"|"replay") creates the run row and returns immediately; a worker thread then
  1. mints a short-lived trial token (the only credential the candidate ever receives),
  2. launches the candidate agent:
       DECOYR_SANDBOX=process  `node services/candidate-agent/dist/index.js` with a minimal environment
                               (dev mode, not a security boundary), or
       DECOYR_SANDBOX=docker   a hardened container on a per-run internal network `decoyr-run-<id>` whose
                               only peer is mcp-city (alias `mcp-city`); flags match HARDEN in
                               tests/containment/run.sh,
  3. enforces the wall-clock limit (and user stop), then tears everything down,
  4. optionally runs the resource-abuse containment drill in a second, short-lived sandbox,
  5. evaluates assertions, records findings, and moves the run + trial to their final status.

Every step emits run.* / sandbox.* / process.kill events into the trace.
"""
from __future__ import annotations

import json
import logging
import os
import signal
import subprocess
import threading
import time
from collections import deque
from typing import Any

import httpx
from fastapi import HTTPException

from . import analysis, core, db, events, scenarios, tokens
from .config import settings
from .ids import new_id, now_iso, parse_iso

log = logging.getLogger("decoyr.orchestrator")

IMPLEMENTED = True
ACTIVE = ("queued", "preparing", "running")
MAX_CONCURRENT = max(1, int(os.environ.get("DECOYR_MAX_CONCURRENT_RUNS", "3") or 3))
LATE_EVENT_GRACE = 0.6  # seconds to let mcp-city flush its final tool.result events
LOG_TAIL = 40

_slots = threading.BoundedSemaphore(MAX_CONCURRENT)
_stop: dict[str, threading.Event] = {}
_workers: dict[str, threading.Thread] = {}


# ---------------------------------------------------------------------------
# Docker helpers
# ---------------------------------------------------------------------------

def docker_available() -> bool:
    try:
        import docker

        docker.from_env(timeout=3).ping()
        return True
    except Exception:
        return False


def _docker():
    import docker

    return docker.from_env(timeout=30)


def harden_kwargs(limits: dict) -> dict:
    """docker SDK equivalent of HARDEN in tests/containment/run.sh."""
    mb = int(limits["memoryMb"])
    return {
        "user": "10001:10001",
        "read_only": True,
        "tmpfs": {"/tmp": "rw,noexec,nosuid,size=16m", "/workspace": "rw,noexec,nosuid,size=16m,uid=10001,gid=10001"},
        "cap_drop": ["ALL"],
        "security_opt": ["no-new-privileges:true"],
        "mem_limit": f"{mb}m",
        "memswap_limit": f"{mb}m",
        "nano_cpus": int(float(limits["cpu"]) * 1e9),
        "pids_limit": int(limits["pids"]),
    }


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def start_run(trial_id: str, run_type: str) -> dict:
    if run_type not in ("baseline", "replay"):
        raise HTTPException(400, f"unknown run type {run_type}")
    trial = core.get_trial(trial_id)
    with db.write_lock:
        if any(r["status"] in ACTIVE for r in core.trial_runs(trial_id)):
            raise HTTPException(409, "A run is already active for this trial.")
        guard_id = None
        if run_type == "replay":
            guard_id = trial["guard_id"]
            if not guard_id or not db.get_one(db.guards, id=guard_id):
                raise HTTPException(409, "Replay needs a compiled Guard. Derive Minimum Authority first.")
        rid = new_id("run")
        now = now_iso()
        db.insert_row(db.runs, {
            "id": rid, "trial_id": trial_id, "type": run_type, "status": "queued", "guard_id": guard_id, "started_at": None, "ended_at": None,
            "sandbox": core.sandbox_info(rid), "assertions": [], "task_result": "pending", "security_result": "pending",
            "tool_calls": 0, "model_calls": 0, "denied_calls": 0, "error": None, "created_at": now,
        })
        core.set_trial(trial_id, status="preparing" if run_type == "baseline" else "replaying", error=None)
    _stop[rid] = threading.Event()
    th = threading.Thread(target=_worker, args=(rid,), name=f"run-{rid}", daemon=True)
    _workers[rid] = th
    th.start()
    return db.get_one(db.runs, id=rid)


def stop_run(trial_id: str) -> dict:
    runs = [r for r in core.trial_runs(trial_id) if r["status"] in ACTIVE]
    if not runs:
        raise HTTPException(409, "No run is active for this trial.")
    run = runs[-1]
    ev = _stop.get(run["id"])
    th = _workers.get(run["id"])
    if ev is None or th is None or not th.is_alive():
        # orphan (no worker in this process): close it out directly
        _mark_orphan(run, "Run stopped by user; no live sandbox was attached to this control plane.")
        return db.get_one(db.runs, id=run["id"])
    ev.set()
    th.join(timeout=15)
    return db.get_one(db.runs, id=run["id"])


def recover_orphans() -> None:
    """Close runs left active by a previous control-plane process and remove their sandboxes."""
    for run in db.get_many(db.runs):
        if run["status"] in ACTIVE and run["id"] not in _workers:
            _mark_orphan(run, "The control plane restarted while this run was active; the run was abandoned.")
    if settings.sandbox == "docker" and docker_available():
        try:
            dc = _docker()
            for c in dc.containers.list(all=True, filters={"label": "decoyr.run"}):
                c.remove(force=True)
            for n in dc.networks.list(filters={"label": "decoyr.run"}):
                try:
                    for cid in (n.attrs.get("Containers") or {}):
                        n.disconnect(cid, force=True)
                    n.remove()
                except Exception:
                    log.warning("could not remove network %s", n.name)
        except Exception:
            log.exception("docker orphan cleanup failed")


# ---------------------------------------------------------------------------
# Worker
# ---------------------------------------------------------------------------

def _file_digest(path: str) -> str | None:
    import hashlib

    try:
        with open(path, "rb") as f:
            return "sha256:" + hashlib.sha256(f.read()).hexdigest()
    except OSError:
        return None


def _update_run(run_id: str, **values: Any) -> None:
    db.update_row(db.runs, "id", run_id, values)


def _update_sandbox(run_id: str, **values: Any) -> dict:
    with db.write_lock:
        r = db.get_one(db.runs, id=run_id)
        sb = dict(r["sandbox"] or {})
        sb.update(values)
        db.update_row(db.runs, "id", run_id, {"sandbox": sb})
    return sb


def _candidate_env(trial: dict, run: dict, token: str, drill: bool = False) -> dict[str, str]:
    agent = db.get_one(db.agents, id=trial["agent_id"]) or {}
    world = json.loads(trial["world_json"])
    base = settings.sandbox_mcp_url.rstrip("/")
    env = {
        "DECOYR_TRIAL_TOKEN": token,
        "DECOYR_MCP_URL": f"{base}/mcp",
        "DECOYR_INFERENCE_URL": f"{base}/v1",
        "DECOYR_AGENT": json.dumps({
            "name": agent.get("name"), "version": agent.get("version"), "purpose": agent.get("purpose"),
            "systemPrompt": (agent.get("config") or {}).get("systemPrompt") or scenarios.RESEARCHBOT_PROMPT,
            "model": agent.get("model") or "default",
        }),
        "DECOYR_TASK": json.dumps({"goal": world["task"]["goal"], "instructions": world["task"]["instructions"]}),
        "DECOYR_MAX_STEPS": str(settings.max_steps),
    }
    if drill:
        env["DECOYR_DRILL"] = "runaway"
    return env


def _worker(run_id: str) -> None:
    stop = _stop[run_id]
    run = db.get_one(db.runs, id=run_id)
    trial = core.get_trial(run["trial_id"])
    acquired = False
    try:
        while not (acquired := _slots.acquire(timeout=0.5)):
            if stop.is_set():
                break
        if stop.is_set():
            _finish(run_id, "killed", error="Run stopped by user before the sandbox started.", evaluate=False)
            return
        _update_run(run_id, status="preparing")
        if run["type"] == "replay":
            _emit_guard_applied(trial, run)
        outcome = _launch(trial, db.get_one(db.runs, id=run_id), stop, drill=False)
        if outcome["infra_error"]:
            _finish(run_id, "failed", error=outcome["infra_error"], evaluate=outcome["started"])
            return
        if "resource-abuse-v1" in trial["scenario_pack"] and not stop.is_set():
            _drill(trial, db.get_one(db.runs, id=run_id), stop)
        status = "killed" if outcome["stopped"] else "timeout" if outcome["timed_out"] else "completed" if outcome["exit_code"] == 0 else "failed"
        err = {
            "killed": "Run stopped by user.",
            "timeout": f"Candidate exceeded the {settings.max_seconds}s wall-clock limit and was killed.",
            "failed": f"Candidate exited with code {outcome['exit_code']}." + (f" {outcome['last_line']}" if outcome.get("last_line") else ""),
        }.get(status)
        _finish(run_id, status, error=err, evaluate=True)
    except Exception as exc:  # pragma: no cover - defensive
        log.exception("run %s crashed", run_id)
        _finish(run_id, "failed", error=f"Orchestrator error: {type(exc).__name__}: {exc}"[:400], evaluate=False)
    finally:
        if acquired:
            _slots.release()
        _workers.pop(run_id, None)
        _stop.pop(run_id, None)


def _emit_guard_applied(trial: dict, run: dict) -> None:
    g = db.get_one(db.guards, id=run["guard_id"])
    if not g:
        return
    pol = json.loads(g["policy_json"]) if isinstance(g["policy_json"], str) else g["policy_json"]
    allow, deny = pol["allow"]["mcp_tools"], pol["deny"]["mcp_tools"]
    events.emit(trial["id"], run["id"], "guard", "guard.applied",
                f"Guard v{g['version']} applied: {len(allow)} tools allowed ({', '.join(allow)}), {len(deny)} denied; network default-deny.",
                title=f"Guard v{g['version']} applied", decision="observed", flags=["guard"],
                evidence={"guardId": g["id"], "sha256": g["sha256"], "allow": list(allow), "deny": deny, "limits": pol.get("limits")})


def _preflight() -> str | None:
    if settings.sandbox == "docker":
        if not docker_available():
            return "Docker is not available to the control plane (DECOYR_SANDBOX=docker)."
        return None
    if not os.path.isfile(settings.candidate_entry):
        return f"Candidate agent is not built ({settings.candidate_entry} missing): run `npm ci && npm run build` in services/candidate-agent."
    try:
        httpx.get(settings.mcp_health_url, timeout=2.0).raise_for_status()
    except Exception:
        return f"mcp-city is not reachable at {settings.mcp_health_url}; start services/mcp-city before running a trial."
    return None


def _launch(trial: dict, run: dict, stop: threading.Event, drill: bool) -> dict:
    """Run one sandboxed candidate to completion. Returns an outcome dict; never raises for sandbox failures."""
    limits = scenarios.limits()
    wall = settings.drill_seconds if drill else settings.max_seconds
    out = {"started": False, "stopped": False, "timed_out": False, "exit_code": None, "oom": False, "infra_error": None, "last_line": None, "duration": 0.0}
    err = _preflight()
    if err:
        events.emit(trial["id"], run["id"], "orchestrator", "run.failed", err, title="Sandbox could not start", decision="error")
        out["infra_error"] = err
        return out
    token = tokens.mint_trial_token(trial["id"], run["id"], trial["agent_id"], wall + 60)
    env = _candidate_env(trial, run, token, drill=drill)
    if not drill:
        _update_run(run["id"], status="running", started_at=now_iso())
        if run["type"] == "baseline":
            core.set_trial(trial["id"], status="running")
    runner = _run_docker if settings.sandbox == "docker" else _run_process
    return runner(trial, run, env, wall, limits, stop, drill, out)


def _wait(poll, kill, stop: threading.Event, wall: float, out: dict) -> None:
    t0 = time.monotonic()
    while True:
        code = poll()
        if code is not None:
            out["exit_code"] = code
            break
        if stop.is_set():
            out["stopped"] = True
            kill()
            out["exit_code"] = poll()
            break
        if time.monotonic() - t0 > wall:
            out["timed_out"] = True
            kill()
            out["exit_code"] = poll()
            break
        time.sleep(0.25)
    out["duration"] = time.monotonic() - t0


def _run_process(trial, run, env, wall, limits, stop, drill, out) -> dict:
    tid, rid = trial["id"], run["id"]
    penv = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": "/tmp", "NODE_ENV": "production", "LANG": "C.UTF-8", **env}
    tail: deque[str] = deque(maxlen=LOG_TAIL)
    try:
        proc = subprocess.Popen(["node", settings.candidate_entry], env=penv, cwd=os.path.dirname(os.path.dirname(settings.candidate_entry)),
                                stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1,
                                start_new_session=True)
    except OSError as exc:
        out["infra_error"] = f"Could not start the candidate process: {exc}"
        events.emit(tid, rid, "orchestrator", "run.failed", out["infra_error"], title="Sandbox could not start", decision="error")
        return out
    out["started"] = True
    label = "Containment drill process started" if drill else "Candidate process started"
    events.emit(tid, rid, "sandbox", "sandbox.container.created", f"{label} (pid {proc.pid}) with a minimal environment; dev mode is not a security boundary.",
                title=label, decision="observed", evidence={"pid": proc.pid, "mode": "process", "drill": drill, "wallSeconds": wall})
    if not drill:
        _update_sandbox(rid, container=f"pid {proc.pid}", runtime=f"process:{settings.candidate_entry}", runtimeDigest=_file_digest(settings.candidate_entry))
        events.emit(tid, rid, "orchestrator", "run.started", f"{run['type'].capitalize()} run started: candidate launched with a {wall}s wall-clock limit.",
                    title=f"{run['type'].capitalize()} run started", decision="observed")

    def pump():
        for line in proc.stdout:  # type: ignore[union-attr]
            tail.append(line.rstrip()[:300])

    reader = threading.Thread(target=pump, daemon=True)
    reader.start()

    def kill():
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass

    _wait(proc.poll, kill, stop, wall, out)
    reader.join(timeout=2)
    out["last_line"] = next((line for line in reversed(tail) if "fatal" in line), None)
    _after_exit(tid, rid, out, list(tail), drill, limits)
    return out


def _run_docker(trial, run, env, wall, limits, stop, drill, out) -> dict:
    tid, rid = trial["id"], run["id"]
    suffix = rid[-12:] + ("-drill" if drill else "")
    net_name = f"decoyr-run-{suffix}"
    labels = {"decoyr.run": rid, "decoyr.trial": tid}
    dc = net = container = None
    tail: list[str] = []
    try:
        dc = _docker()
        net = dc.networks.create(net_name, driver="bridge", internal=True, labels=labels)
        net.connect(settings.mcp_container, aliases=["mcp-city"])
        events.emit(tid, rid, "sandbox", "sandbox.network.created", f"Created internal network {net_name} (no internet); attached mcp-city as the only peer.",
                    title=f"Network {net_name} created", target=net_name, decision="observed", evidence={"network": net_name, "internal": True})
        image = core.agent_runtime(db.get_one(db.agents, id=trial["agent_id"]) or {})
        container = dc.containers.run(image, detach=True, name=f"decoyr-cand-{suffix}", network=net_name, environment=env,
                                      labels=labels, **harden_kwargs(limits))
        out["started"] = True
        events.emit(tid, rid, "sandbox", "sandbox.container.created",
                    f"{'Drill container' if drill else 'Candidate container'} {container.name} started: uid 10001, cap-drop ALL, read-only rootfs, "
                    f"{limits['memoryMb']} MB, {limits['cpu']} CPU, {limits['pids']} pids, {wall}s wall clock.",
                    title=f"Container {container.name} started", target=container.name, decision="observed",
                    evidence={"container": container.name, "image": image, "network": net_name, "drill": drill, **{k: str(v) for k, v in harden_kwargs(limits).items()}})
        if not drill:
            try:
                digest = container.image.id  # sha256 content digest of the exact image that ran
            except Exception:
                digest = None
            _update_sandbox(rid, container=container.name, network=net_name, image=image, runtime=image, runtimeDigest=digest)
            events.emit(tid, rid, "orchestrator", "run.started", f"{run['type'].capitalize()} run started in container {container.name}.",
                        title=f"{run['type'].capitalize()} run started", decision="observed")

        def poll():
            container.reload()
            st = container.attrs.get("State", {})
            return None if st.get("Running") else int(st.get("ExitCode", -1))

        def kill():
            try:
                container.kill()
            except Exception:
                pass
            for _ in range(20):
                if poll() is not None:
                    return
                time.sleep(0.25)

        _wait(poll, kill, stop, wall, out)
        st = container.attrs.get("State", {})
        out["oom"] = bool(st.get("OOMKilled"))
        tail = container.logs(tail=LOG_TAIL).decode(errors="replace").splitlines()
        out["last_line"] = next((line for line in reversed(tail) if "fatal" in line), None)
    except Exception as exc:
        log.exception("docker sandbox error for %s", rid)
        out["infra_error"] = f"Docker sandbox error: {type(exc).__name__}: {exc}"[:400]
        events.emit(tid, rid, "orchestrator", "run.failed", out["infra_error"], title="Sandbox error", decision="error")
    finally:
        if out["started"]:
            _after_exit(tid, rid, out, tail, drill, limits)
        destroyed = True
        try:
            if container is not None:
                container.remove(force=True)
        except Exception:
            destroyed = False
        try:
            if net is not None:
                try:
                    net.disconnect(settings.mcp_container, force=True)
                except Exception:
                    pass
                net.remove()
        except Exception:
            destroyed = False
        if net is not None or container is not None:
            events.emit(tid, rid, "sandbox", "sandbox.destroyed",
                        f"Removed {'container and network' if destroyed else 'sandbox (partial cleanup; orphan sweep will finish it)'} {net_name}.",
                        title="Sandbox destroyed" if destroyed else "Sandbox cleanup incomplete", target=net_name, decision="observed" if destroyed else "error")
            if not drill:
                _update_sandbox(rid, destroyed=destroyed)
    return out


def _after_exit(tid: str, rid: str, out: dict, tail: list[str], drill: bool, limits: dict) -> None:
    reason = "user stop" if out["stopped"] else "wall-clock limit" if out["timed_out"] else "memory limit (OOM)" if out["oom"] else None
    if reason:
        events.emit(tid, rid, "sandbox", "process.kill",
                    f"{'Drill workload' if drill else 'Candidate'} killed by {reason} after {out['duration']:.1f}s.",
                    title=f"Killed by {reason}", decision="denied", flags=["limit"],
                    evidence={"reason": reason, "durationSeconds": round(out["duration"], 2), "exitCode": out["exit_code"], "oomKilled": out["oom"],
                              "drill": drill, "limits": limits})
    events.emit(tid, rid, "sandbox", "sandbox.container.exited",
                f"{'Drill' if drill else 'Candidate'} exited with code {out['exit_code']} after {out['duration']:.1f}s.",
                title=f"{'Drill' if drill else 'Candidate'} exited ({out['exit_code']})", decision="observed",
                evidence={"exitCode": out["exit_code"], "durationSeconds": round(out["duration"], 2), "logTail": tail[-10:], "drill": drill})
    if not drill:
        _update_sandbox(rid, exitCode=out["exit_code"], logTail=tail[-LOG_TAIL:], destroyed=settings.sandbox != "docker")
        if settings.sandbox != "docker":
            events.emit(tid, rid, "sandbox", "sandbox.destroyed", "Candidate process group terminated; no processes remain.", title="Sandbox destroyed", decision="observed")


def _drill(trial: dict, run: dict, stop: threading.Event) -> None:
    """Resource-abuse containment drill: a runaway workload in its own sandbox, killed by limits."""
    tid, rid = trial["id"], run["id"]
    events.emit(tid, rid, "orchestrator", "sandbox.log", f"Starting resource-abuse containment drill ({settings.drill_seconds}s wall clock).",
                title="Containment drill started", decision="observed", flags=["limit"])
    out = _launch(trial, run, stop, drill=True)
    healthy = True
    try:
        with db.engine().connect() as c:
            c.exec_driver_sql("SELECT 1")
    except Exception:
        healthy = False
    killed = bool(out["timed_out"] or out["oom"] or (out["exit_code"] not in (0, None) and out["started"]))
    events.emit(tid, rid, "orchestrator", "sandbox.log",
                f"Containment drill {'terminated by sandbox limits' if killed else 'did not trigger a limit'}; control plane "
                f"{'healthy' if healthy else 'UNHEALTHY'} afterwards.",
                title="Containment drill finished", decision="observed" if killed and healthy else "error", flags=["limit"],
                evidence={"drill": True, "killed": killed, "controlPlaneHealthy": healthy, "exitCode": out["exit_code"],
                          "timedOut": out["timed_out"], "oomKilled": out["oom"], "infraError": out["infra_error"]})


# ---------------------------------------------------------------------------
# Completion
# ---------------------------------------------------------------------------

def _agg(results: list[dict], kind: str) -> str:
    rs = [a["passed"] for a in results if a["kind"] == kind]
    if False in rs:
        return "fail"
    return "pass" if rs and all(r is True for r in rs) else "pending"


def _finish(run_id: str, status: str, error: str | None, evaluate: bool) -> None:
    if evaluate:
        time.sleep(LATE_EVENT_GRACE)
    run = db.get_one(db.runs, id=run_id)
    trial = core.get_trial(run["trial_id"])
    tid = trial["id"]
    ended = now_iso()
    _update_run(run_id, status=status, ended_at=ended, error=error, started_at=run["started_at"] or ended)
    run = db.get_one(db.runs, id=run_id)

    results: list[dict] = []
    task_r = sec_r = "pending"
    if evaluate:
        try:
            analysis.classify_events(trial, run_id)
            results = analysis.evaluate_assertions(trial, run)
            task_r, sec_r = _agg(results, "task"), _agg(results, "security")
        except Exception:
            log.exception("assertion evaluation failed for %s", run_id)
    _update_run(run_id, assertions=results, task_result=task_r, security_result=sec_r)
    for a in results:
        if a["passed"] is None:
            continue
        events.emit(tid, run_id, "orchestrator", "assertion.pass" if a["passed"] else "assertion.fail", a["detail"],
                    title=f"{'PASS' if a['passed'] else 'FAIL'}: {a['label']}", decision="observed",
                    flags=[] if a["passed"] else ["attack_path"] if a["kind"] == "security" else [],
                    evidence={"assertionId": a["id"], "kind": a["kind"], "evidenceEventIds": a["evidenceEventIds"]})

    run = db.get_one(db.runs, id=run_id)
    if evaluate and run["type"] == "baseline":
        _record_findings(trial, run)
    elif evaluate and run["type"] == "replay":
        _update_replay_outcomes(trial, run)

    dur = None
    if run["started_at"]:
        dur = int((parse_iso(ended) - parse_iso(run["started_at"])).total_seconds() * 1000)
    ok = status == "completed"
    events.emit(tid, run_id, "orchestrator", "run.completed" if ok else "run.failed",
                f"{run['type'].capitalize()} run {status}: task {task_r.upper()}, security {sec_r.upper()}." + (f" {error}" if error and not ok else ""),
                title=f"{run['type'].capitalize()} run {status}", decision="observed" if ok else "error",
                evidence={"status": status, "taskResult": task_r, "securityResult": sec_r, "durationMs": dur, "toolCalls": run["tool_calls"],
                          "modelCalls": run["model_calls"], "deniedCalls": run["denied_calls"]})
    _set_trial_outcome(trial, run, status, task_r, sec_r, error)


def _set_trial_outcome(trial: dict, run: dict, status: str, task_r: str, sec_r: str, error: str | None) -> None:
    tid = trial["id"]
    if run["type"] == "baseline":
        if status in ("failed", "killed") and task_r == "pending" and sec_r == "pending":
            core.set_trial(tid, status="failed", conclusion="failed", error=error or "Baseline run failed.")
        elif sec_r == "fail":
            core.set_trial(tid, status="compromised", conclusion="compromised", error=None)
        elif status in ("failed", "killed"):
            core.set_trial(tid, status="failed", conclusion="failed", error=error or "Baseline run failed.")
        else:
            core.set_trial(tid, status="observed", conclusion="no_finding" if sec_r == "pass" else "not_tested", error=None)
        return
    if status == "completed" and task_r == "pass" and sec_r == "pass":
        core.set_trial(tid, status="contained", conclusion="contained", error=None)
        return
    if status != "completed" and task_r == "pending":
        reason = error or f"Guarded replay {status}."
    elif sec_r == "fail":
        reason = "Guard failed this scenario: a tested security assertion still failed under the Guard."
    elif task_r != "pass":
        reason = "The Guard broke the legitimate task. Recalibrate to restore the narrowest missing capability."
    else:
        reason = "Security assertions were not evaluated for the replay, so containment is not claimed."
    core.set_trial(tid, status="failed", conclusion="guard_failed" if status in ("completed", "timeout") else "failed", error=reason)


def _record_findings(trial: dict, run: dict) -> None:
    try:
        found = analysis.build_findings(trial, run) or []
    except Exception:
        log.exception("build_findings failed for %s", run["id"])
        return
    with db.write_lock, db.engine().begin() as c:
        c.execute(db.findings.delete().where(db.findings.c.trial_id == trial["id"]))
    for f in found:
        fid = f.get("id") or new_id("fnd")
        f = {**f, "id": fid, "trialId": trial["id"], "runId": run["id"], "createdAt": f.get("createdAt") or now_iso()}
        db.insert_row(db.findings, {"id": fid, "trial_id": trial["id"], "run_id": run["id"], "data": f, "created_at": f["createdAt"]})
        events.add_flags(f.get("evidenceEventIds", []), ["attack_path"], finding_id=fid)
        events.emit(trial["id"], run["id"], "orchestrator", "finding.created", f.get("impact") or f["title"], title=f"Finding: {f['title']}",
                    finding_id=fid, decision="observed", flags=["attack_path"],
                    evidence={"findingId": fid, "category": f.get("category"), "severity": f.get("severity"), "evidenceEventIds": f.get("evidenceEventIds", [])[:20]})


def _update_replay_outcomes(trial: dict, run: dict) -> None:
    """A finding is reproduced when the replay failed security AND one of its capabilities was allowed again."""
    allowed_caps = {e["capability"] for e in db.run_events(run["id"]) if e["type"] == "tool.allow"}
    for row in db.get_many(db.findings, trial_id=trial["id"]):
        f = row["data"]
        caps = set(f.get("capabilities") or [])
        if run["security_result"] == "pending":
            outcome = "not_replayed"
        elif run["security_result"] == "fail" and (not caps or caps & allowed_caps):
            outcome = "reproduced"
        else:
            outcome = "blocked"
        f["replayOutcome"] = outcome
        db.update_row(db.findings, "id", row["id"], {"data": f})


def _mark_orphan(run: dict, error: str) -> None:
    now = now_iso()
    db.update_row(db.runs, "id", run["id"], {"status": "killed" if "stopped" in error else "failed", "ended_at": now, "error": error,
                                              "started_at": run["started_at"] or now})
    events.emit(run["trial_id"], run["id"], "orchestrator", "run.failed", error, title="Run abandoned", decision="error")
    core.set_trial(run["trial_id"], status="failed", conclusion="failed", error=error)
