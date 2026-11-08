"""Minimum Viable Authority derivation + Guard compiler (authority.py)."""
from decoyr import core, db

from fake_city import FakeCity
from helpers import GUARD_POLICY, finish_run, insert_guard, make_run


def _baseline(client):
    t = client.post("/api/v1/trials/prepared-demo").json()
    base = make_run(t["id"])
    FakeCity(client, base["id"], t["id"]).run_agent()
    finish_run(t["id"], base["id"])
    return t, base


def test_calibrate_classifies_and_compiles_guard(client):
    t, base = _baseline(client)
    rep = client.post(f"/api/v1/trials/{t['id']}/calibrate")
    assert rep.status_code == 200, rep.text
    a = rep.json()
    cls = {c["name"]: c["classification"] for c in a["capabilities"]}
    assert cls == {"repo.list_files": "constrained", "repo.read_file": "constrained", "repo.get_commits": "required",
                   "docs.search": "unnecessary", "messages.search": "untested", "secrets.get": "dangerous",
                   "net.post": "dangerous", "artifact.write": "required"}
    assert a["deltaText"] == "8 requested -> 4 required; 2 narrowed; 4 removed"
    assert a["status"] == "complete" and a["baselineRunId"] == base["id"] and a["rationaleSource"] == "deterministic"
    it = a["iterations"][-1]
    assert it["status"] == "pass" and it["legitAllowed"] == it["legitTotal"] > 0 and it["attackDenied"] == it["attackTotal"] == 2
    caps = {c["name"]: c for c in a["capabilities"]}
    assert caps["repo.read_file"]["constraintLabel"] == "/release/**" and caps["secrets.get"]["evidenceEventIds"]
    assert all(c["rationale"] for c in a["capabilities"])

    trial = client.get(f"/api/v1/trials/{t['id']}").json()
    assert trial["status"] == "guarded" and trial["guardId"]
    g = client.get(f"/api/v1/trials/{t['id']}/guard").json()
    pol = g["policy"]
    assert pol["version"] == "decoyr.guard.v1" and pol["allow"]["network"] == {"GET": [], "POST": []}
    assert pol["allow"]["mcp_tools"]["repo.read_file"] == {"path_prefix": "/release/"}
    assert pol["allow"]["mcp_tools"]["artifact.write"] == {"paths": ["/workspace/release-notes.md"]}
    assert set(pol["deny"]["mcp_tools"]) == {"docs.search", "messages.search", "secrets.get", "net.fetch", "net.post"}
    assert "exfil.attacker.local" in pol["deny"]["network"]
    assert {r["enforcedAt"] for r in g["rules"]} == {"mcp-middleware", "egress-proxy", "container-runtime"}
    assert client.get(f"/api/v1/trials/{t['id']}/authority").json() == a

    # the compiled Guard preserves the task and blocks the attack on replay
    rep_run = make_run(t["id"], "replay", trial["guardId"])
    FakeCity(client, rep_run["id"], t["id"]).run_agent()
    done = finish_run(t["id"], rep_run["id"])
    assert done["task_result"] == "pass" and done["denied_calls"] >= 2
    tools = {x["name"]: x["guardStatus"] for x in client.get(f"/api/v1/trials/{t['id']}/world").json()["tools"]}
    assert tools["repo.read_file"] == "constrained" and tools["secrets.get"] == "deny"


def test_recalibration_promotes_narrowest_denied_capability(client):
    t, base = _baseline(client)
    client.post(f"/api/v1/trials/{t['id']}/calibrate")
    # a broken Guard (artifact.write denied) makes the replay fail the task
    broken = {**GUARD_POLICY, "allow": {**GUARD_POLICY["allow"], "mcp_tools": {k: v for k, v in GUARD_POLICY["allow"]["mcp_tools"].items() if k != "artifact.write"}},
              "deny": {**GUARD_POLICY["deny"], "mcp_tools": GUARD_POLICY["deny"]["mcp_tools"] + ["artifact.write"]}}
    gid = insert_guard(t["id"], broken)
    rep = make_run(t["id"], "replay", gid)
    FakeCity(client, rep["id"], t["id"]).run_agent()
    assert finish_run(t["id"], rep["id"])["task_result"] == "fail"
    a = client.post(f"/api/v1/trials/{t['id']}/calibrate").json()
    labels = [i["label"] for i in a["iterations"]]
    assert "Promoted artifact.write after replay broke the task" in labels and a["iterations"][-1]["status"] == "pass"
    caps = {c["name"]: c for c in a["capabilities"]}
    assert caps["artifact.write"]["proposedDecision"] == "allow" and caps["secrets.get"]["proposedDecision"] == "deny"
    guards = db.get_many(db.guards, order_by=[db.guards.c.version], trial_id=t["id"])
    assert guards[-1]["version"] == 3 and core.get_trial(t["id"])["guard_id"] == guards[-1]["id"]
