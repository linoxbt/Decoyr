import { config } from "./config.js";
import { serviceToken } from "./tokens.js";
const svc = () => serviceToken(config.signingKey);
async function cpFetch(path, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("X-Decoyr-Service", svc());
    if (init.body && !headers.has("content-type"))
        headers.set("content-type", "application/json");
    return fetch(config.controlPlaneUrl + path, { ...init, headers, signal: AbortSignal.timeout(init.timeoutMs ?? config.internalTimeoutMs) });
}
const worldCache = new Map();
const inflight = new Map();
const WORLD_TTL_MS = 60 * 60 * 1000;
export async function getWorld(runId) {
    const hit = worldCache.get(runId);
    if (hit && Date.now() - hit.at < WORLD_TTL_MS)
        return hit.world;
    const pending = inflight.get(runId);
    if (pending)
        return pending;
    const p = (async () => {
        const res = await cpFetch(`/internal/runs/${encodeURIComponent(runId)}/world`);
        if (!res.ok)
            throw new Error(`world fetch failed: HTTP ${res.status}`);
        const world = (await res.json());
        worldCache.set(runId, { world, at: Date.now() });
        // evict stale entries
        for (const [k, v] of worldCache)
            if (Date.now() - v.at > WORLD_TTL_MS)
                worldCache.delete(k);
        return world;
    })();
    inflight.set(runId, p);
    try {
        return await p;
    }
    finally {
        inflight.delete(runId);
    }
}
export async function evaluatePolicy(body) {
    try {
        const res = await cpFetch("/internal/policy/evaluate", { method: "POST", body: JSON.stringify(body) });
        if (!res.ok)
            return { decision: "denied", reason: `policy service error (HTTP ${res.status}); failing closed`, ruleId: "policy.unavailable" };
        return (await res.json());
    }
    catch (err) {
        return { decision: "denied", reason: `policy service unreachable; failing closed`, ruleId: "policy.unavailable" };
    }
}
export async function postEvent(ev) {
    try {
        const res = await cpFetch("/internal/events", { method: "POST", body: JSON.stringify(ev) });
        if (!res.ok)
            console.error(`[mcp-city] event ingest failed HTTP ${res.status} (${ev.type})`);
    }
    catch (err) {
        console.error(`[mcp-city] event ingest error (${ev.type}): ${err.message}`);
    }
}
export async function postArtifact(a) {
    const res = await cpFetch("/internal/artifacts", { method: "POST", body: JSON.stringify(a) });
    if (!res.ok)
        throw new Error(`artifact upload failed: HTTP ${res.status}`);
    return (await res.json());
}
/** Relay an OpenAI-compatible chat request to the control plane. */
export async function relayInference(trialToken, body) {
    const res = await cpFetch("/internal/inference/chat", {
        method: "POST",
        body,
        headers: { "X-Decoyr-Trial-Token": trialToken, "content-type": "application/json" },
        timeoutMs: config.inferenceTimeoutMs,
    });
    return { status: res.status, body: await res.text(), contentType: res.headers.get("content-type") ?? "application/json" };
}
export async function egress(req) {
    const res = await fetch(config.egressUrl + "/egress", {
        method: "POST",
        headers: { "content-type": "application/json", "X-Decoyr-Service": svc() },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(config.internalTimeoutMs),
    });
    if (!res.ok)
        throw new Error(`egress proxy error: HTTP ${res.status}`);
    return (await res.json());
}
