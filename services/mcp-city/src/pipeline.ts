import { createHash } from "node:crypto";
import { schemas, targetOf, type ToolName } from "./tools.js";
import * as W from "./world.js";
import type { EventIn, PolicyDecision } from "./controlPlane.js";
import type { TrialClaims } from "./tokens.js";

export type Deps = {
  getWorld: (runId: string) => Promise<W.WorldSnapshot>;
  evaluatePolicy: (b: { runId: string; trialId: string; layer: "mcp" | "network"; tool: string; args: Record<string, unknown> }) => Promise<PolicyDecision>;
  postEvent: (e: EventIn) => Promise<void>;
  postArtifact: (a: { runId: string; trialId: string; path: string; content: string; correlationId?: string | null }) => Promise<{ id: string; sha256: string }>;
  egress: (r: { runId: string; trialId: string; method: "GET" | "POST"; url: string; body?: string; correlationId?: string | null }) => Promise<{ status: number; host: string; body: string }>;
};

export type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const ok = (value: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const fail = (text: string): ToolResult => ({ content: [{ type: "text", text }], isError: true });

/** Per-run workspace (artifact.write outputs). */
export const workspaces = new Map<string, Map<string, string>>();

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Replace any secret value from the world with a masked form (evidence must never carry honeytoken values). */
export function maskSecrets(world: W.WorldSnapshot, text: string): string {
  let out = text;
  for (const s of world.secrets ?? []) {
    if (s.value && s.value.length >= 6) out = out.split(s.value).join(s.value.slice(0, 9) + "••••••••");
  }
  return out;
}

function kb(n: number) {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

export async function executeTool(deps: Deps, claims: TrialClaims, tool: ToolName, rawArgs: unknown): Promise<ToolResult> {
  const runId = claims.run_id;
  const trialId = claims.trial_id;
  const started = Date.now();

  // 1. world
  let world: W.WorldSnapshot;
  try {
    world = await deps.getWorld(runId);
  } catch (err) {
    return fail(`world unavailable for this run: ${(err as Error).message}`);
  }

  // 2. strict schema validation
  const parsed = schemas[tool].safeParse(rawArgs ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message, code: i.code }));
    await deps.postEvent({
      runId,
      trialId,
      actor: "mcp",
      type: "tool.error",
      title: `Rejected ${tool} call`,
      summary: "Rejected invalid arguments",
      capability: tool,
      decision: "error",
      flags: [],
      evidence: { issues },
    });
    return fail(`Invalid arguments for ${tool}: ${issues.map((i) => `${i.path || "(root)"}: ${i.message}`).join("; ")}`);
  }
  const args = parsed.data as Record<string, unknown>;

  // 3. Guard decision BEFORE handler
  const decision = await deps.evaluatePolicy({ runId, trialId, layer: "mcp", tool, args });
  const correlationId = decision.correlationId ?? null;
  const target = decision.target ?? targetOf(tool, args);
  if (decision.decision !== "allowed") {
    return fail(`DECOYR_GUARD_DENIED: ${decision.reason}`);
  }

  // 4. handler
  let value: unknown;
  let summary = "";
  let title = "";
  const flags: string[] = [];
  let isError = false;
  try {
    switch (tool) {
      case "repo.list_files": {
        const r = W.listFiles(world, args.path as string | undefined, (args.recursive as boolean | undefined) ?? true);
        value = r;
        title = `Listed files in ${r.path}`;
        summary = `Returned ${r.files.length} files under ${r.path} in ${r.repo}.`;
        flags.push("untrusted_content");
        break;
      }
      case "repo.read_file": {
        const r = W.readFile(world, args.path as string);
        value = { path: r.path, content: r.content };
        title = `Read ${r.path.split("/").pop()}`;
        summary = `Returned ${r.path} (${kb(Buffer.byteLength(r.content))}).`;
        flags.push("untrusted_content");
        if (r.poisoned) flags.push("injection");
        break;
      }
      case "repo.get_commits": {
        const r = W.getCommits(world, args as never);
        value = r;
        title = `Fetched commits ${r.range}`;
        summary = `Returned ${r.commits.length} commits for ${r.repo} ${r.range}.`;
        flags.push("untrusted_content");
        break;
      }
      case "docs.search": {
        const r = W.searchDocs(world, args.query as string, args.limit as number | undefined);
        value = { results: r.results };
        title = `Searched docs for “${args.query}”`;
        summary = `Returned ${r.results.length} internal docs matching “${args.query}”.`;
        flags.push("untrusted_content");
        if (r.poisoned) flags.push("injection");
        break;
      }
      case "messages.search": {
        const r = W.searchMessages(world, args.query as string, args.limit as number | undefined);
        value = { results: r.results };
        title = `Searched messages for “${args.query}”`;
        summary = `Returned ${r.results.length} internal messages matching “${args.query}”.`;
        flags.push("untrusted_content");
        if (r.poisoned) flags.push("injection");
        break;
      }
      case "secrets.get": {
        const r = W.getSecret(world, args.name as string);
        value = r;
        const secret = world.secrets.find((s) => s.name === r.name);
        title = `Returned secret ${r.name}`;
        summary = secret?.honeytoken
          ? `Secret store returned ${r.name} (a synthetic honeycredential).`
          : `Secret store returned ${r.name}.`;
        if (secret?.honeytoken) flags.push("honeytoken");
        break;
      }
      case "net.fetch":
      case "net.post": {
        const method = tool === "net.fetch" ? "GET" : "POST";
        const r = await deps.egress({ runId, trialId, method, url: args.url as string, body: args.body as string | undefined, correlationId });
        value = r;
        if (r.status === 403 && r.body.startsWith("DECOYR_EGRESS_DENIED")) isError = true;
        title = `${method} ${r.host}`;
        summary = `Controlled egress answered ${r.status} for ${method} ${r.host}.`;
        flags.push("untrusted_content");
        const host = world.network.hosts.find((h) => h.host === r.host);
        if (host?.kind === "adversarial") flags.push("adversarial");
        break;
      }
      case "artifact.write": {
        const path = W.workspacePath(world, args.path as string);
        const content = args.content as string;
        let ws = workspaces.get(runId);
        if (!ws) workspaces.set(runId, (ws = new Map()));
        ws.set(path, content);
        const up = await deps.postArtifact({ runId, trialId, path, content, correlationId });
        const digest = up?.sha256 ?? sha256(content);
        value = { path, bytes: Buffer.byteLength(content), sha256: digest };
        title = `Wrote ${path.split("/").pop()}`;
        summary = `Wrote ${path} (${kb(Buffer.byteLength(content))}) to the workspace.`;
        break;
      }
    }
  } catch (err) {
    const message = (err as Error).message;
    await deps.postEvent({
      runId,
      trialId,
      actor: "mcp",
      type: "tool.error",
      title: `${tool} failed`,
      summary: message,
      capability: tool,
      target,
      decision: "error",
      correlationId,
      latencyMs: Date.now() - started,
      flags: [],
      evidence: null,
    });
    return fail(`${tool} error: ${message}`);
  }

  const text = JSON.stringify(value, null, 2);
  const masked = maskSecrets(world, text);
  // 5. telemetry
  await deps.postEvent({
    runId,
    trialId,
    actor: "mcp",
    type: "tool.result",
    title,
    summary,
    capability: tool,
    target,
    decision: "observed",
    correlationId,
    latencyMs: Date.now() - started,
    flags,
    evidence: { resultSha256: sha256(text), bytes: Buffer.byteLength(text), preview: masked.slice(0, 400) },
  });
  return isError ? fail(text) : ok(value);
}
