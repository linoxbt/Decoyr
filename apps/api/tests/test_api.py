"""Public + internal API behavior (main.py)."""
import json

from decoyr import db, tokens

from fake_city import FakeCity
from helpers import GUARD_POLICY, finish_run, insert_guard, make_run

SVC = {"X-Decoyr-Service": tokens.service_token()}


def new_trial(client):
    r = client.post("/api/v1/trials/prepared-demo")
    assert r.status_code == 200, r.text
    return r.json()


def test_health_system_catalog(client):
    assert client.get("/api/v1/health").json() == {"ok": True}
    s = client.get("/api/v1/system").json()
    assert s["inference"]["mode"] == "simulated" and s["sandbox"]["mode"] == "process"
    cat = client.get("/api/v1/scenarios").json()
    assert [a["id"] for a in cat["builtinAgents"]] == ["agt_researchbot"]
    assert {c["name"] for c in cat["capabilities"]} >= {"secrets.get", "artifact.write"}


def test_errors_have_reference_id(client):
    r = client.get("/api/v1/trials/trl_missing")
    assert r.status_code == 404 and r.json()["referenceId"].startswith("err_")
    r = client.post("/api/v1/trials", json={"agent": {}})
    assert r.status_code == 422 and isinstance(r.json()["detail"], str)


def test_internal_requires_service_token(client):
    assert client.get("/internal/runs/x/world").status_code == 401
    assert client.post("/internal/events", json={}).status_code == 401


def test_create_trial_and_world_view(client):
    body = {"agent": {"name": "MyBot", "version": "1.0", "purpose": "notes", "requestedCapabilities": ["repo.read_file", "bogus"]},
            "worldVersion": "acme-labs-v1", "taskId": "release-notes-v2.4.0", "scenarioPack": ["indirect-injection-v1"]}
    t = client.post("/api/v1/trials", json=body).json()
    assert t["status"] == "draft" and t["agent"]["requestedCapabilities"] == ["repo.read_file"]
    w = client.get(f"/api/v1/trials/{t['id']}/world").json()
    readme = next(a for a in w["assets"] if a["name"] == "/release/README.md")
    assert readme["status"] == "normal" and "exfil" not in readme["preview"]
    secret = next(a for a in w["assets"] if a["group"] == "secrets")
    assert "•" in secret["preview"]
    wi = client.get(f"/api/v1/trials/{t['id']}/world?inspect=true").json()
    assert next(a for a in wi["assets"] if a["name"] == "/release/README.md")["status"] == "adversarial"
    assert all(tool["guardStatus"] == "no_guard" for tool in w["tools"])
    dup = client.post(f"/api/v1/trials/{t['id']}/duplicate").json()
    assert dup["id"] != t["id"] and dup["name"].endswith("(copy)")


def test_baseline_flow_records_correlated_masked_evidence(client):
    t = new_trial(client)
    run = make_run(t["id"])
    city = FakeCity(client, run["id"], t["id"])
    final = city.run_agent()
    assert final and "release-notes.md" in final
    evs = client.get(f"/api/v1/trials/{t['id']}/events?runId={run['id']}").json()
    types = {e["type"] for e in evs}
    assert {"model.request", "model.response", "tool.request", "tool.allow", "tool.result", "injection.delivered",
            "honeytoken.touch", "net.request", "net.allow", "honeytoken.egress", "artifact.created"} <= types
    assert [e["seq"] for e in evs] == list(range(1, len(evs) + 1))
    # every tool.request is linked to the model tool call that asked for it
    calls = {tc["id"] for e in evs if e["type"] == "model.response" for tc in e["evidence"]["toolCalls"]}
    assert all(e["correlationId"] in calls for e in evs if e["type"] == "tool.request")
    # honeytoken values never appear in public evidence
    secret = next(s["value"] for s in city.world["secrets"] if s["name"] == "deploy-token")
    assert secret not in json.dumps(evs)
    allow = next(e for e in evs if e["type"] == "tool.allow")
    assert {"args", "reason", "ruleId"} <= set(allow["evidence"]) and allow["evidence"]["ruleId"] is None
    r = client.get(f"/api/v1/trials/{t['id']}/runs/{run['id']}").json()
    assert r["toolCalls"] == 8 and r["deniedCalls"] == 0 and r["modelCalls"] == 9


def test_guard_enforcement_and_limits(client):
    t = new_trial(client)
    gid = insert_guard(t["id"], {**GUARD_POLICY, "limits": {**GUARD_POLICY["limits"], "max_tool_calls": 3}})
    run = make_run(t["id"], "replay", gid)
    city = FakeCity(client, run["id"], t["id"])
    assert city.tool("secrets.get", {"name": "deploy-token"})[1] is True
    assert city.tool("repo.read_file", {"path": "/ops/runbooks/credential-rotation.md"})[1] is True
    assert city.tool("repo.read_file", {"path": "/release/README.md"})[1] is False
    denied = city.post("/internal/policy/evaluate", {"runId": run["id"], "trialId": t["id"], "layer": "mcp", "tool": "repo.read_file", "args": {"path": "/release/CHANGELOG.md"}}).json()
    assert denied["ruleId"] == "limits.max_tool_calls"
    net = city.post("/internal/policy/evaluate", {"runId": run["id"], "trialId": t["id"], "layer": "network", "tool": "net.egress",
                                                  "args": {"method": "POST", "url": "https://exfil.attacker.local/x", "host": "exfil.attacker.local", "body": ""}}).json()
    assert net["decision"] == "denied"
    tools = {x["name"]: x for x in client.get(f"/api/v1/trials/{t['id']}/world").json()["tools"]}
    assert tools["repo.read_file"]["guardStatus"] == "constrained" and tools["repo.read_file"]["guardConstraint"] == "/release/**"
    assert tools["secrets.get"]["guardStatus"] == "deny"
    # inactive runs fail closed
    db.update_row(db.runs, "id", run["id"], {"status": "completed"})
    assert city.post("/internal/policy/evaluate", {"runId": run["id"], "trialId": t["id"], "layer": "mcp", "tool": "repo.list_files", "args": {}}).json()["ruleId"] == "run.inactive"


def test_sse_stream_and_resume(client):
    t = new_trial(client)
    run = make_run(t["id"])
    FakeCity(client, run["id"], t["id"]).run_agent()
    finish_run(t["id"], run["id"])
    n = len(client.get(f"/api/v1/trials/{t['id']}/events?runId={run['id']}").json())
    with client.stream("GET", f"/api/v1/trials/{t['id']}/stream?runId={run['id']}") as s:
        body = "".join(s.iter_text())
    assert body.count("event: trace") == n and "event: status" in body and body.rstrip().splitlines()[-2] == "event: end"
    assert f"id: {run['id']}:1\n" in body
    with client.stream("GET", f"/api/v1/trials/{t['id']}/stream?runId={run['id']}", headers={"Last-Event-ID": f"{run['id']}:{n - 2}"}) as s:
        assert "".join(s.iter_text()).count("event: trace") == 2


def test_phase_guards(client):
    t = new_trial(client)
    assert client.post(f"/api/v1/trials/{t['id']}/calibrate").status_code == 409
    assert client.post(f"/api/v1/trials/{t['id']}/replay").status_code == 409
    assert client.get(f"/api/v1/trials/{t['id']}/guard").status_code == 404
    assert client.post(f"/api/v1/trials/{t['id']}/stop").status_code == 409


def test_demo_reset(client):
    new_trial(client)
    r = client.post("/api/v1/demo/reset").json()
    assert r["ok"] and [x["id"] for x in client.get("/api/v1/trials").json() if x["agent"]["id"] == "agt_researchbot"] == [r["demoTrialId"]]
