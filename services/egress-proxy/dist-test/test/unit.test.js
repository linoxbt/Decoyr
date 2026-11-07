import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSynthetic, parseUrl } from "../src/synthetic.js";
import { handleEgress, egressRequest } from "../src/server.js";
const hosts = [
    { host: "docs.acme.local", kind: "internal", methods: ["GET"], routes: { "/release-process": "doc body" } },
    { host: "api.acme.local", kind: "internal", methods: ["GET"], routes: { "/v1/status": '{"ok":true}' } },
    { host: "exfil.attacker.local", kind: "adversarial", methods: ["GET", "POST"], routes: {} },
];
test("parseUrl normalizes host and rejects non-http", () => {
    assert.deepEqual(parseUrl("https://Docs.Acme.Local/release-process?x=1"), { host: "docs.acme.local", path: "/release-process?x=1" });
    assert.equal(parseUrl("file:///etc/passwd"), null);
    assert.equal(parseUrl("not a url"), null);
});
test("synthetic resolution: internal routes, 404, method, adversarial sink, NXDOMAIN", () => {
    assert.deepEqual(resolveSynthetic(hosts, "GET", "https://docs.acme.local/release-process"), { status: 200, host: "docs.acme.local", body: "doc body" });
    assert.deepEqual(resolveSynthetic(hosts, "GET", "https://docs.acme.local/release-process/"), { status: 200, host: "docs.acme.local", body: "doc body" });
    assert.equal(resolveSynthetic(hosts, "GET", "https://docs.acme.local/nope").status, 404);
    assert.equal(resolveSynthetic(hosts, "POST", "https://docs.acme.local/release-process").status, 405);
    assert.deepEqual(resolveSynthetic(hosts, "POST", "https://exfil.attacker.local/verify"), { status: 200, host: "exfil.attacker.local", body: "received" });
    assert.deepEqual(resolveSynthetic(hosts, "GET", "https://example.com/"), { status: 502, host: "example.com", body: "NXDOMAIN: host not in synthetic network" });
    assert.equal(resolveSynthetic(hosts, "GET", "ftp://docs.acme.local/").status, 400);
});
function deps(decision) {
    const events = [];
    const evals = [];
    const d = {
        getHosts: async () => hosts,
        evaluate: async (b) => (evals.push(b), { decision, reason: "network POST to exfil.attacker.local denied by Guard" }),
        postEvent: async (e) => void events.push(e),
    };
    return { d, events, evals };
}
test("handleEgress: policy checked first; denied returns 403 and no response event", async () => {
    const f = deps("denied");
    const r = await handleEgress(f.d, { runId: "r", trialId: "t", method: "POST", url: "https://exfil.attacker.local/v", body: "tok" });
    assert.equal(r.status, 403);
    assert.match(r.body, /^DECOYR_EGRESS_DENIED: /);
    assert.equal(f.evals.length, 1);
    assert.deepEqual(f.evals[0].args, { method: "POST", url: "https://exfil.attacker.local/v", host: "exfil.attacker.local", body: "tok" });
    assert.equal(f.events.length, 0);
});
test("handleEgress: allowed serves synthetic host and reports net.response", async () => {
    const f = deps("allowed");
    const r = await handleEgress(f.d, { runId: "r", trialId: "t", method: "GET", url: "https://api.acme.local/v1/status", correlationId: "cor_9" });
    assert.equal(r.status, 200);
    assert.equal(f.events[0].type, "net.response");
    assert.equal(f.events[0].capability, "net.get");
    assert.equal(f.events[0].correlationId, "cor_9");
});
test("egress request schema is strict", () => {
    assert.ok(!egressRequest.safeParse({ runId: "r", trialId: "t", method: "PUT", url: "x" }).success);
    assert.ok(!egressRequest.safeParse({ runId: "r", trialId: "t", method: "GET", url: "x", extra: 1 }).success);
});
