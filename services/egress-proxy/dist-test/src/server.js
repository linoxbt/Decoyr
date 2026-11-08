import { createServer } from "node:http";
import { z } from "zod";
import { config } from "./config.js";
import { resolveSynthetic, parseUrl } from "./synthetic.js";
import { serviceToken, verifyServiceToken } from "./tokens.js";
const svc = () => serviceToken(config.signingKey);
async function cp(path, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("X-Decoyr-Service", svc());
    headers.set("content-type", "application/json");
    return fetch(config.controlPlaneUrl + path, { ...init, headers, signal: AbortSignal.timeout(config.internalTimeoutMs) });
}
const hostCache = new Map();
export const defaultDeps = {
    async getHosts(runId) {
        const hit = hostCache.get(runId);
        if (hit && Date.now() - hit.at < 3_600_000)
            return hit.hosts;
        const res = await cp(`/internal/runs/${encodeURIComponent(runId)}/world`);
        if (!res.ok)
            throw new Error(`world fetch failed: HTTP ${res.status}`);
        const world = (await res.json());
        const hosts = world.network?.hosts ?? [];
        hostCache.set(runId, { hosts, at: Date.now() });
        return hosts;
    },
    async evaluate(body) {
        try {
            const res = await cp("/internal/policy/evaluate", { method: "POST", body: JSON.stringify(body) });
            if (!res.ok)
                return { decision: "denied", reason: `policy service error (HTTP ${res.status}); failing closed` };
            return (await res.json());
        }
        catch {
            return { decision: "denied", reason: "policy service unreachable; failing closed" };
        }
    },
    async postEvent(e) {
        try {
            await cp("/internal/events", { method: "POST", body: JSON.stringify(e) });
        }
        catch (err) {
            console.error(`[egress-proxy] event ingest error: ${err.message}`);
        }
    },
};
export const egressRequest = z
    .object({
    runId: z.string().min(1),
    trialId: z.string().min(1),
    method: z.enum(["GET", "POST"]),
    url: z.string().max(2048),
    body: z.string().max(20000).optional(),
    correlationId: z.string().nullable().optional(),
})
    .strict();
export async function handleEgress(deps, input) {
    const parsed = parseUrl(input.url);
    const host = parsed?.host ?? "";
    const decision = await deps.evaluate({
        runId: input.runId,
        trialId: input.trialId,
        layer: "network",
        tool: "net.egress",
        args: { method: input.method, url: input.url, host, body: input.body ?? "" },
    });
    if (decision.decision !== "allowed") {
        return { status: 403, host, body: `DECOYR_EGRESS_DENIED: ${decision.reason}` };
    }
    let result;
    try {
        result = resolveSynthetic(await deps.getHosts(input.runId), input.method, input.url);
    }
    catch (err) {
        result = { status: 503, host, body: `SYNTHETIC_NETWORK_UNAVAILABLE: ${err.message}` };
    }
    await deps.postEvent({
        runId: input.runId,
        trialId: input.trialId,
        actor: "sandbox",
        type: "net.response",
        title: `${result.host || host} answered ${result.status}`,
        summary: `Synthetic ${result.host || host} answered ${result.status} to ${input.method} (no real network I/O).`,
        capability: "net." + input.method.toLowerCase(),
        target: result.host || host,
        decision: "observed",
        correlationId: input.correlationId ?? null,
        flags: [],
        evidence: { status: result.status, bytes: Buffer.byteLength(result.body) },
    });
    return result;
}
function sendJson(res, status, body) {
    const text = JSON.stringify(body);
    res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(text) });
    res.end(text);
}
async function readBody(req, limit = 256 * 1024) {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
        size += c.length;
        if (size > limit)
            throw Object.assign(new Error("body too large"), { status: 413 });
        chunks.push(c);
    }
    return Buffer.concat(chunks).toString("utf8");
}
export function createApp(deps = defaultDeps) {
    return createServer(async (req, res) => {
        const url = new URL(req.url ?? "/", "http://egress-proxy");
        try {
            if (url.pathname === "/healthz")
                return sendJson(res, 200, { ok: true, service: "egress-proxy" });
            if (url.pathname !== "/egress" || req.method !== "POST")
                return sendJson(res, 404, { error: "not found" });
            const presented = req.headers["x-decoyr-service"];
            if (!verifyServiceToken(config.signingKey, Array.isArray(presented) ? presented[0] : presented)) {
                return sendJson(res, 401, { error: "unauthorized" });
            }
            let json;
            try {
                json = JSON.parse(await readBody(req));
            }
            catch (err) {
                return sendJson(res, err.status ?? 400, { error: "invalid JSON body" });
            }
            const parsed = egressRequest.safeParse(json);
            if (!parsed.success)
                return sendJson(res, 400, { error: "invalid request", issues: parsed.error.issues });
            return sendJson(res, 200, await handleEgress(deps, parsed.data));
        }
        catch (err) {
            console.error(`[egress-proxy] ${err.message}`);
            if (!res.headersSent)
                sendJson(res, 500, { error: err.message });
        }
    });
}
