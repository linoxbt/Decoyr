"""Passport proof: agent fingerprint, model-in-the-loop rule, Ed25519 signatures."""
import base64
import copy
import hashlib

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from decoyr import db, scenarios, signing

from fake_city import FakeCity
from helpers import finish_run, insert_guard, make_run


def _trial(client):
    t = client.post("/api/v1/trials/prepared-demo").json()
    base = make_run(t["id"])
    FakeCity(client, base["id"], t["id"]).run_agent()
    finish_run(t["id"], base["id"])
    gid = insert_guard(t["id"])
    rep = make_run(t["id"], "replay", gid)
    FakeCity(client, rep["id"], t["id"]).run_agent()
    finish_run(t["id"], rep["id"])
    return t, base, rep


def test_fingerprint_and_signature(client):
    t, base, rep = _trial(client)
    p = client.get(f"/api/v1/trials/{t['id']}/passport").json()
    fp = p["fingerprint"]
    assert fp["systemPromptSha256"] == hashlib.sha256(scenarios.RESEARCHBOT_PROMPT.encode()).hexdigest()
    assert fp["modelsServed"] == ["decoyr-simulated-researchbot"] and fp["modelInTheLoop"] is True
    assert fp["modelCalls"]["baseline"] > 0 and fp["toolCalls"]["replay"] > 0 and fp["worldSha256"] == t["scenarioSha256"]
    assert p["identity"]["declared"] is True and any("declared by the developer" in l for l in p["limitations"])
    assert p["status"] == "calibrated"

    # the API verifies it, and so does an independent Ed25519 check against the published key
    assert client.post("/api/v1/passports/verify", json=p).json()["valid"] is True
    pk = client.get("/api/v1/passports/public-key").json()
    assert pk["keyId"] == p["signature"]["keyId"]
    Ed25519PublicKey.from_public_bytes(base64.b64decode(pk["publicKey"])).verify(base64.b64decode(p["signature"]["value"]), signing.canonical(p))

    # any edit breaks it
    forged = copy.deepcopy(p)
    forged["label"] = "Calibrated: Everything / Everywhere"
    v = client.post("/api/v1/passports/verify", json=forged).json()
    assert v["valid"] is False and "altered" in v["reason"]
    assert client.post("/api/v1/passports/verify", json={"label": "x"}).json()["valid"] is False


def test_no_model_calls_means_not_calibrated(client):
    t, base, rep = _trial(client)
    db.update_row(db.runs, "id", rep["id"], {"model_calls": 0})  # e.g. a scripted program that never consulted a model
    with db.engine().begin() as c:
        c.execute(db.passports.delete().where(db.passports.c.trial_id == t["id"]))
    p = client.get(f"/api/v1/trials/{t['id']}/passport").json()
    assert p["status"] == "not_calibrated" and p["fingerprint"]["modelInTheLoop"] is False
    assert any("not attributed to an AI agent" in l for l in p["limitations"])
