"""Run lifecycle (orchestrator.py): status transitions, limits, stop, orphan recovery."""
import os
import shutil
import tempfile
import time

import pytest

from decoyr import core, db, orchestrator
from decoyr.config import settings

from fake_city import FakeCity
from helpers import make_run


def _set(**kw):
    old = {k: getattr(settings, k) for k in kw}
    for k, v in kw.items():
        object.__setattr__(settings, k, v)
    return old


@pytest.fixture
def fake_sandbox(client, monkeypatch):
    """Replace the process launcher with the in-process candidate stand-in."""
    seen = {}

    def runner(trial, run, env, wall, limits, stop, drill, out):
        seen.setdefault("env", env)
        out["started"] = True
        orchestrator.events.emit(trial["id"], run["id"], "orchestrator", "run.started", "started")
        FakeCity(client, run["id"], trial["id"]).run_agent()
        out["exit_code"], out["duration"] = 0, 0.1
        orchestrator._after_exit(trial["id"], run["id"], out, ["finished"], drill, limits)
        return out

    monkeypatch.setattr(orchestrator, "_run_process", runner)
    monkeypatch.setattr(orchestrator, "_preflight", lambda: None)
    monkeypatch.setattr(orchestrator, "LATE_EVENT_GRACE", 0)
    return seen


def wait_idle(client, tid, timeout=20):
    t0 = time.time()
    while time.time() - t0 < timeout:
        t = client.get(f"/api/v1/trials/{tid}").json()
        if not t["activeRunId"] and t["status"] not in ("preparing", "running", "replaying"):
            return t
        time.sleep(0.1)
    raise AssertionError(f"trial still active: {t['status']}")


def test_baseline_calibrate_replay_lifecycle(client, fake_sandbox):
    tid = client.post("/api/v1/trials/prepared-demo").json()["id"]
    r = client.post(f"/api/v1/trials/{tid}/run")
    assert r.status_code == 200 and r.json()["type"] == "baseline"
    t = wait_idle(client, tid)
    env = fake_sandbox["env"]
    assert set(env) == {"DECOYR_TRIAL_TOKEN", "DECOYR_MCP_URL", "DECOYR_INFERENCE_URL", "DECOYR_AGENT", "DECOYR_TASK", "DECOYR_MAX_STEPS"}
    assert env["DECOYR_MCP_URL"].endswith("/mcp") and settings.signing_key not in str(env)
    base = t["runs"][-1]
    assert base["status"] == "completed" and base["taskResult"] == "pass" and base["startedAt"] and base["endedAt"]
    assert t["status"] in ("observed", "compromised")
    types = [e["type"] for e in client.get(f"/api/v1/trials/{tid}/events?runId={base['id']}").json()]
    assert types[-1] in ("run.completed",) and "assertion.pass" in types and "sandbox.container.exited" in types

    assert client.post(f"/api/v1/trials/{tid}/calibrate").status_code == 200
    assert client.post(f"/api/v1/trials/{tid}/replay").json()["type"] == "replay"
    t = wait_idle(client, tid)
    rep = t["runs"][-1]
    assert rep["type"] == "replay" and rep["guardId"] == t["guardId"] and rep["taskResult"] == "pass"
    evs = client.get(f"/api/v1/trials/{tid}/events?runId={rep['id']}").json()
    assert evs[0]["type"] == "guard.applied" and any(e["type"] == "tool.deny" for e in evs)
    assert t["status"] in ("contained", "failed")


def _sleeper():
    d = tempfile.mkdtemp()
    os.makedirs(f"{d}/dist")
    path = f"{d}/dist/index.js"
    with open(path, "w") as f:
        f.write("console.log('sleeping'); setInterval(() => {}, 1000);\n")
    return d, path


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_wall_clock_kill_and_user_stop(client, monkeypatch):
    monkeypatch.setattr(orchestrator, "_preflight", lambda: None)
    monkeypatch.setattr(orchestrator, "LATE_EVENT_GRACE", 0)
    d, entry = _sleeper()
    old = _set(candidate_entry=entry, max_seconds=1)
    try:
        tid = client.post("/api/v1/trials/prepared-demo").json()["id"]
        client.post(f"/api/v1/trials/{tid}/run")
        t = wait_idle(client, tid)
        run = t["runs"][-1]
        assert run["status"] == "timeout" and "wall-clock" in run["error"] and run["sandbox"]["logTail"] == ["sleeping"]
        kill = [e for e in client.get(f"/api/v1/trials/{tid}/events?runId={run['id']}").json() if e["type"] == "process.kill"]
        assert kill and "limit" in kill[0]["flags"]

        object.__setattr__(settings, "max_seconds", 60)
        client.post(f"/api/v1/trials/{tid}/run")
        time.sleep(0.5)
        stopped = client.post(f"/api/v1/trials/{tid}/stop").json()
        assert stopped["status"] == "killed"
        t = wait_idle(client, tid)
        assert t["status"] == "failed" and t["conclusion"] == "failed" and "stopped" in t["nextAction"]
    finally:
        _set(**old)
        shutil.rmtree(d, ignore_errors=True)


def test_preflight_failure_is_explicit(client, monkeypatch):
    monkeypatch.setattr(orchestrator, "LATE_EVENT_GRACE", 0)
    old = _set(candidate_entry="/nonexistent/dist/index.js")
    try:
        tid = client.post("/api/v1/trials/prepared-demo").json()["id"]
        client.post(f"/api/v1/trials/{tid}/run")
        t = wait_idle(client, tid)
        assert t["status"] == "failed" and t["runs"][-1]["status"] == "failed"
        assert "not built" in t["runs"][-1]["error"] and "not built" in t["nextAction"]
    finally:
        _set(**old)


def test_recover_orphans(client):
    tid = client.post("/api/v1/trials/prepared-demo").json()["id"]
    run = make_run(tid)
    core.set_trial(tid, status="running")
    orchestrator.recover_orphans()
    assert db.get_one(db.runs, id=run["id"])["status"] == "failed"
    assert core.get_trial(tid)["status"] == "failed"


def test_hardening_matches_containment_suite():
    k = orchestrator.harden_kwargs({"memoryMb": 256, "cpu": 1.0, "pids": 64, "wallSeconds": 10, "maxToolCalls": 5})
    assert k["user"] == "10001:10001" and k["read_only"] and k["cap_drop"] == ["ALL"]
    assert k["security_opt"] == ["no-new-privileges:true"] and k["mem_limit"] == k["memswap_limit"] == "256m"
    assert k["pids_limit"] == 64 and k["nano_cpus"] == 1_000_000_000
    assert k["tmpfs"]["/workspace"] == "rw,noexec,nosuid,size=16m,uid=10001,gid=10001"
