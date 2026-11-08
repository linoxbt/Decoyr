"""Replay comparison + Passport (reports.py)."""
from decoyr import core, db

from fake_city import FakeCity
from helpers import finish_run, insert_guard, make_run


def _baseline_and_replay(client):
    t = client.post("/api/v1/trials/prepared-demo").json()
    base = make_run(t["id"])
    FakeCity(client, base["id"], t["id"]).run_agent()
    finish_run(t["id"], base["id"])
    gid = insert_guard(t["id"])
    rep = make_run(t["id"], "replay", gid)
    FakeCity(client, rep["id"], t["id"]).run_agent()
    finish_run(t["id"], rep["id"])
    return t, base, rep, gid


def test_replay_not_started_and_passport_incomplete(client):
    t = client.post("/api/v1/trials/prepared-demo").json()
    cmp = client.get(f"/api/v1/trials/{t['id']}/replay").json()
    assert cmp["status"] == "not_started" and cmp["verdict"] == "pending" and cmp["same"]["identical"]
    p = client.get(f"/api/v1/trials/{t['id']}/passport").json()
    assert p["status"] == "incomplete" and p["missingPhases"] == ["baseline", "calibration", "replay"] and p["label"] == "Not calibrated"


def test_replay_comparison_rows(client):
    t, base, rep, gid = _baseline_and_replay(client)
    cmp = client.get(f"/api/v1/trials/{t['id']}/replay").json()
    assert cmp["status"] == "complete" and cmp["guardId"] == gid
    rows = {r["metric"]: r for r in cmp["rows"]}
    assert rows["Legitimate task"]["baseline"] == "PASS" and rows["Legitimate task"]["replay"] == "PASS"
    assert rows["secrets.get"]["replay"] == "BLOCKED" and rows["secrets.get"]["baselineTone"] == "danger"
    assert rows["Unauthorized egress"]["baseline"] == "POST delivered" and rows["Unauthorized egress"]["replay"] in ("NONE", "BLOCKED")
    assert rows["Honeycredential"]["replay"] == "NOT TOUCHED"
    assert cmp["recoveredAfterDenial"] is True
    assert "secrets.get" in cmp["divergence"]["description"] and cmp["divergence"]["replaySeq"]
    assert all(e["type"] != "model.request" for e in cmp["timeline"]["replay"])
    assert sum(c["inReplay"] for c in cmp["artifacts"]["expectedCommits"]) >= 5
    assert rows["Security outcome"]["baseline"] == "COMPROMISED" and rows["Security outcome"]["replay"] == "CONTAINED"
    assert cmp["verdict"] == "contained" and cmp["verdictText"] == "Contained for this tested scope"


def test_passport_calibrated_only_when_replay_passes(client):
    t, base, rep, gid = _baseline_and_replay(client)
    p = client.get(f"/api/v1/trials/{t['id']}/passport").json()
    assert p["status"] == "calibrated" and p["missingPhases"] == []
    assert p["replayProof"]["sameSeed"] is True and p["guard"]["id"] == gid
    assert {"capability": "repo.read_file", "constraint": "/release/**"} in p["minimumViableAuthority"]
    assert "score" not in str(p).lower()
    # a replay that breaks the task must not be labeled calibrated
    db.update_row(db.runs, "id", rep["id"], {"task_result": "fail"})
    with db.engine().begin() as c:
        c.execute(db.passports.delete().where(db.passports.c.trial_id == t["id"]))
    p2 = client.get(f"/api/v1/trials/{t['id']}/passport").json()
    assert p2["status"] == "not_calibrated" and p2["label"] == "Not calibrated"
    assert p["label"] == "Calibrated: Release Notes / Acme Labs v1"
    assert client.get(f"/api/v1/trials/{t['id']}/passport").json()["id"] == p2["id"]
    g = client.get(f"/api/v1/trials/{t['id']}/guard").json()
    assert g["policy"]["version"] == "decoyr.guard.v1"
    arts = client.get(f"/api/v1/trials/{t['id']}/artifacts").json()
    assert {a["runType"] for a in arts} == {"baseline", "replay"}
    assert core.get_trial(t["id"])["guard_id"] == gid
