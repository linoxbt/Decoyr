import { config } from "./config.js";
import { serviceToken } from "./tokens.js";
import type { WorldSnapshot } from "./world.js";

const svc = () => serviceToken(config.signingKey);

async function cpFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-Decoyr-Service", svc());
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(config.controlPlaneUrl + path, { ...init, headers, signal: AbortSignal.timeout(init.timeoutMs ?? config.internalTimeoutMs) });
}

const worldCache = new Map<string, { world: WorldSnapshot; at: number }>();
const inflight = new Map<string, Promise<WorldSnapshot>>();
const WORLD_TTL_MS = 60 * 60 * 1000;

export async function getWorld(runId: string): Promise<WorldSnapshot> {
  const hit = worldCache.get(runId);
  if (hit && Date.now() - hit.at < WORLD_TTL_MS) return hit.world;
  const pending = inflight.get(runId);
  if (pending) return pending;
  const p = (async () => {
    const res = await cpFetch(`/internal/runs/${encodeURIComponent(runId)}/world`);
    if (!res.ok) throw new Error(`world fetch failed: HTTP ${res.status}`);
    const world = (await res.json()) as WorldSnapshot;
    worldCache.set(runId, { world, at: Date.now() });
    // evict stale entries
    for (const [k, v] of worldCache) if (Date.now() - v.at > WORLD_TTL_MS) worldCache.delete(k);
    return world;
  })();
  inflight.set(runId, p);
  try {
    return await p;
  } finally {
    inflight.delete(runId);
  }
}

export type PolicyDecision = {
  decision: "allowed" | "denied";
  reason: string;
  ruleId?: string | null;
  capability?: string | null;
  target?: string | null;
  correlationId?: string | null;
  enforced?: boolean;
  eventId?: string | null;
};

export async function evaluatePolicy(body: {
  runId: string;
  trialId: string;
  layer: "mcp" | "network";
  tool: string;
  args: Record<string, unknown>;
}): Promise<PolicyDecision> {
  try {
    const res = await cpFetch("/internal/policy/evaluate", { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) return { decision: "denied", reason: `policy service error (HTTP ${res.status}); failing closed`, ruleId: "policy.unavailable" };
    return (await res.json()) as PolicyDecision;
  } catch (err) {
    return { decision: "denied", reason: `policy service unreachable; failing closed`, ruleId: "policy.unavailable" };
  }
}

export type EventIn = {
  runId: string;
  trialId: string;
  actor: "agent" | "orchestrator" | "mcp" | "guard" | "sandbox";
  type: string;
  title?: string;
  summary: string;
  capability?: string | null;
  target?: string | null;
  decision?: "allowed" | "denied" | "observed" | "error" | null;
  correlationId?: string | null;
  flags?: string[];
  latencyMs?: number | null;
  evidence?: Record<string, unknown> | null;
};

export async function postEvent(ev: EventIn): Promise<void> {
  try {
    const res = await cpFetch("/internal/events", { method: "POST", body: JSON.stringify(ev) });
    if (!res.ok) console.error(`[mcp-city] event ingest failed HTTP ${res.status} (${ev.type})`);
  } catch (err) {
    console.error(`[mcp-city] event ingest error (${ev.type}): ${(err as Error).message}`);
  }
}

export async function postArtifact(a: { runId: string; trialId: string; path: string; content: string; correlationId?: string | null }) {
  const res = await cpFetch("/internal/artifacts", { method: "POST", body: JSON.stringify(a) });
  if (!res.ok) throw new Error(`artifact upload failed: HTTP ${res.status}`);
  return (await res.json()) as { id: string; sha256: string };
}

/** Relay an OpenAI-compatible chat request to the control plane. */
export async function relayInference(trialToken: string, body: string): Promise<{ status: number; body: string; contentType: string }> {
  const res = await cpFetch("/internal/inference/chat", {
    method: "POST",
    body,
    headers: { "X-Decoyr-Trial-Token": trialToken, "content-type": "application/json" },
    timeoutMs: config.inferenceTimeoutMs,
  });
  return { status: res.status, body: await res.text(), contentType: res.headers.get("content-type") ?? "application/json" };
}

export async function egress(req: { runId: string; trialId: string; method: "GET" | "POST"; url: string; body?: string; correlationId?: string | null }) {
  const res = await fetch(config.egressUrl + "/egress", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Decoyr-Service": svc() },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(config.internalTimeoutMs),
  });
  if (!res.ok) throw new Error(`egress proxy error: HTTP ${res.status}`);
  return (await res.json()) as { status: number; host: string; body: string };
}
