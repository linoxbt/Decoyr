/**
 * Decoyr shared data contracts — SOURCE OF TRUTH for apps/web and services/*.
 *
 * Public API  : served by apps/api (FastAPI) under /api/v1, JSON camelCase.
 * Internal API: served by apps/api under /internal, used only by trusted
 *               services (mcp-city, egress-proxy). See docs/contracts.md.
 */

// ---------------------------------------------------------------------------
// Status model
// ---------------------------------------------------------------------------

export type TrialStatus =
  | "draft" // created, World visible, baseline not started
  | "preparing" // sandbox being created for a run
  | "running" // baseline running
  | "observed" // baseline finished, no tested security assertion failed
  | "compromised" // baseline finished, >=1 security assertion failed
  | "calibrating" // Minimum Viable Authority derivation in progress
  | "guarded" // Guard compiled, replay not yet run
  | "replaying" // guarded replay running
  | "contained" // replay: task PASS + all security assertions PASS
  | "failed"; // infrastructure failure / guard failed this scenario

export type Conclusion =
  | "not_tested"
  | "compromised"
  | "no_finding" // "No tested security assertion failed in this run"
  | "guarded"
  | "contained"
  | "guard_failed" // replay still failed a security assertion OR broke the task
  | "failed";

export type RunType = "baseline" | "replay";
export type RunStatus = "queued" | "preparing" | "running" | "completed" | "failed" | "timeout" | "killed";
export type CheckResult = "pass" | "fail" | "pending";

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export type AgentProfile = {
  id: string;
  name: string; // "ResearchBot"
  version: string; // "0.9.2"
  purpose: string; // one line
  model: string; // model id used through Vultr Serverless Inference
  requestedCapabilities: string[]; // e.g. ["repo.list_files","secrets.get",...]
  builtin: boolean; // true for the prepared demo profile
  trialCount?: number; // only on GET /agents
  lastTestedAt?: string | null;
  latestCalibration?: string | null; // e.g. "Calibrated: Release Notes / Acme Labs v1"
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Scenario catalog (GET /api/v1/scenarios)
// ---------------------------------------------------------------------------

export type CapabilityGroup = "Repository" | "Documents" | "Messages" | "Secrets" | "Network" | "Artifact Write";

export type CapabilityInfo = {
  name: string; // "repo.read_file"
  group: CapabilityGroup;
  description: string;
  risk: string; // "Safe read." | "Honeycredential touch." ...
};

export type ScenarioPack = {
  id: string; // "indirect-injection-v1" | "resource-abuse-v1"
  name: string; // "Indirect Prompt Injection"
  description: string;
  optional: boolean;
  defaultSelected: boolean;
};

export type ScenarioCatalog = {
  worlds: { version: string; name: string; description: string }[]; // [{version:"acme-labs-v1", name:"Acme Labs v1"}]
  tasks: { id: string; worldVersion: string; goal: string }[]; // release-notes task
  packs: ScenarioPack[];
  capabilities: CapabilityInfo[];
  builtinAgents: AgentProfile[];
  limits: { wallSeconds: number; memoryMb: number; cpu: number; pids: number; maxToolCalls: number };
};

// ---------------------------------------------------------------------------
// Trials
// ---------------------------------------------------------------------------

export type Assertion = {
  id: string; // "task.release_notes_exists"
  kind: "task" | "security";
  label: string; // "release-notes.md exists"
  description: string;
};

export type AssertionResult = Assertion & {
  passed: boolean | null; // null = not evaluated
  detail: string; // human sentence
  evidenceEventIds: string[];
};

export type SandboxInfo = {
  mode: "docker" | "process";
  container?: string | null;
  network?: string | null;
  image?: string | null;
  limits: { wallSeconds: number; memoryMb: number; cpu: number; pids: number; maxToolCalls: number };
  hardening: string[]; // ["non-root uid 10001","cap-drop ALL","no-new-privileges","read-only rootfs","internal network"]
  destroyed: boolean;
  exitCode?: number | null;
};

export type ArtifactRef = { id: string; path: string; sha256: string; size: number };

export type RunSummary = {
  id: string;
  trialId: string;
  type: RunType;
  status: RunStatus;
  guardId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  taskResult: CheckResult;
  securityResult: CheckResult;
  toolCalls: number;
  modelCalls: number;
  deniedCalls: number;
  assertions: AssertionResult[];
  artifacts: ArtifactRef[];
  sandbox: SandboxInfo;
  error?: string | null;
};

export type InferenceInfo = {
  mode: "vultr" | "simulated"; // simulated only when no VULTR key is configured (dev)
  provider: string; // "Vultr Serverless Inference"
  baseUrl: string; // "https://api.vultrinference.com/v1"
  model: string;
};

export type Trial = {
  id: string; // "trl_01J..."
  shortId: string; // "7f3a"
  name: string; // "ResearchBot 0.9.2 · Release notes"
  agent: AgentProfile;
  worldVersion: string; // "acme-labs-v1"
  worldName: string; // "Acme Labs v1"
  scenarioId: string; // "indirect-injection-v1"
  scenarioPack: string[];
  seed: string; // "trial_7f3a"
  scenarioSha256: string; // hash of persisted world/scenario bytes (identical in replay)
  legitimateGoal: string; // "Create release notes for v2.4.0"
  successAssertions: Assertion[];
  securityAssertions: Assertion[];
  status: TrialStatus;
  conclusion: Conclusion;
  nextAction: string; // one sentence telling the user what to do
  runs: RunSummary[]; // ordered oldest -> newest
  baselineRunId: string | null;
  replayRunId: string | null; // latest replay
  activeRunId: string | null; // run currently preparing/running
  guardId: string | null;
  findingCount: number;
  inference: InferenceInfo;
  createdAt: string;
  updatedAt: string;
};

export type TrialListItem = Pick<
  Trial,
  "id" | "shortId" | "name" | "agent" | "worldVersion" | "worldName" | "status" | "conclusion" | "createdAt" | "updatedAt" | "baselineRunId" | "replayRunId" | "guardId" | "findingCount"
> & {
  taskResult: CheckResult; // latest run
  securityResult: CheckResult; // latest run
};

export type CreateTrialRequest = {
  name?: string;
  agent: {
    profileId?: string; // use builtin "agt_researchbot" etc.
    name: string;
    version: string;
    purpose: string;
    model?: string;
    requestedCapabilities: string[];
  };
  worldVersion: string; // "acme-labs-v1"
  taskId: string; // "release-notes-v2.4.0"
  scenarioPack: string[]; // ["indirect-injection-v1"] (+ "resource-abuse-v1")
};

// ---------------------------------------------------------------------------
// Trace (evidence)
// ---------------------------------------------------------------------------

export type Actor = "agent" | "orchestrator" | "mcp" | "guard" | "sandbox";
export type Decision = "allowed" | "denied" | "observed" | "error";

/**
 * Event types:
 *  run.started run.completed run.failed
 *  sandbox.network.created sandbox.container.created sandbox.container.exited sandbox.destroyed sandbox.log
 *  process.kill
 *  model.request model.response
 *  tool.request tool.allow tool.deny tool.result tool.error
 *  net.request net.allow net.deny net.response
 *  honeytoken.touch honeytoken.egress injection.delivered
 *  artifact.created
 *  guard.applied assertion.pass assertion.fail finding.created
 */
export type TraceEvent = {
  id: string; // "evt_..."
  trialId: string;
  runId: string;
  seq: number; // monotonically increasing per run, starts at 1
  timestamp: string; // ISO
  actor: Actor;
  type: string;
  title: string; // human verb: "Read README.md", "Guard denied secrets.get"
  summary: string; // one concise sentence
  capability?: string | null; // "secrets.get"
  target?: string | null; // "deploy-token" | "/release/README.md" | "exfil.attacker.local"
  decision?: Decision | null;
  correlationId?: string | null; // links model.response -> tool.request -> tool.allow/deny -> net.* -> tool.result
  findingId?: string | null;
  flags: string[]; // "untrusted_content" | "injection" | "honeytoken" | "adversarial" | "attack_path" | "legitimate_path" | "guard" | "limit"
  latencyMs?: number | null;
  evidence?: Record<string, unknown> | null; // sanitized args / result hash / preview; honeytoken values masked
};

// SSE (GET /api/v1/trials/{id}/stream?runId=...&after=seq)
//   event: trace   data: TraceEvent           (id: <runId>:<seq>)
//   event: status  data: { trial: Trial }      (sent on any status change)
//   event: end     data: { runId, status }     (run finished; client should refetch canonical state)
//   comment heartbeat every 15s (": ping")

// ---------------------------------------------------------------------------
// World (GET /api/v1/trials/{id}/world?inspect=true|false)
// ---------------------------------------------------------------------------

export type WorldTool = {
  name: string; // "secrets.get"
  description: string;
  inputSchema: Record<string, unknown>; // JSON schema
  group: CapabilityGroup;
  risk: string;
  requested: boolean; // in agent.requestedCapabilities
  guardStatus: "no_guard" | "allow" | "deny" | "constrained";
  guardConstraint?: string | null;
};

export type WorldAsset = {
  id: string;
  group: "repository" | "docs" | "messages" | "secrets" | "network";
  name: string; // file path / doc title / message subject / secret name / host
  description: string;
  tool: string; // MCP tool that reaches it
  access: "read" | "write" | "read-write" | "get" | "post";
  status: "normal" | "decoy" | "adversarial" | "honeytoken" | "output"; // adversarial only revealed when inspect=true or after finding
  preview?: string | null; // content preview (secret values ALWAYS masked: "acme_dpl_••••••••")
  meta?: Record<string, unknown>;
};

export type WorldView = {
  trialId: string;
  worldVersion: string;
  worldName: string;
  company: { name: string; description: string };
  seed: string;
  scenarioSha256: string;
  inspect: boolean; // whether adversarial content is revealed
  revealed: boolean; // true if inspect or a finding already exposed it
  repository: {
    name: string; // "acme/app"
    tree: { path: string; type: "file" | "dir"; status: WorldAsset["status"] }[];
    commits: { sha: string; message: string; author: string; date: string; tag?: string | null }[];
  };
  assets: WorldAsset[];
  tools: WorldTool[];
  task: { id: string; goal: string; instructions: string };
};

// ---------------------------------------------------------------------------
// Artifacts (GET /api/v1/trials/{id}/artifacts?runId=)
// ---------------------------------------------------------------------------

export type Artifact = {
  id: string;
  runId: string;
  runType: RunType;
  kind: "file";
  path: string; // "/workspace/release-notes.md"
  sha256: string;
  size: number;
  content: string; // untrusted, render as text/markdown without raw HTML
  createdAt: string;
  eventId: string | null;
};

// ---------------------------------------------------------------------------
// Findings (GET /api/v1/trials/{id}/findings)
// ---------------------------------------------------------------------------

export type FindingCategory = "prompt_injection" | "honeytoken_access" | "exfiltration" | "scope_creep" | "resource_abuse";

export type Finding = {
  id: string;
  trialId: string;
  runId: string;
  category: FindingCategory;
  title: string; // "Indirect prompt injection led to credential access"
  severity: "high" | "medium" | "low";
  impact: string;
  chain: { label: string; detail: string; eventId: string | null; capability?: string | null; target?: string | null }[];
  capabilities: string[];
  evidenceEventIds: string[];
  whyUnnecessary: string;
  guardAddressed: boolean | null; // null until Guard compiled
  guardRuleIds: string[];
  replayOutcome: "not_replayed" | "blocked" | "reproduced";
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Authority (POST /calibrate, GET /authority)
// ---------------------------------------------------------------------------

export type AuthorityClass = "required" | "constrained" | "unnecessary" | "dangerous" | "untested";

export type AuthorityCapability = {
  id: string;
  name: string; // "repo.read_file"
  requested: boolean;
  observed: boolean;
  observedCount: number;
  classification: AuthorityClass;
  constraint?: Record<string, unknown> | null; // {"path_prefix":"/release/"}
  constraintLabel?: string | null; // "/release/**"
  evidenceEventIds: string[];
  rationale: string;
  baselineDecision: "allowed" | "denied" | "not_used";
  proposedDecision: "allow" | "deny";
  findingIds: string[];
  targets: string[]; // observed targets
};

export type CalibrationIteration = {
  n: number;
  label: string; // "Static replay of baseline calls under candidate Guard"
  detail: string;
  legitAllowed: number;
  legitTotal: number;
  attackDenied: number;
  attackTotal: number;
  status: "pass" | "adjusted" | "fail";
};

export type AuthorityReport = {
  trialId: string;
  status: "not_started" | "complete" | "failed";
  baselineRunId: string | null;
  capabilities: AuthorityCapability[];
  iterations: CalibrationIteration[];
  summary: {
    requested: number;
    observed: number;
    required: number;
    constrained: number;
    unnecessary: number;
    dangerous: number;
    untested: number;
    removed: number;
    narrowed: number;
  };
  deltaText: string; // "8 requested -> 4 required; 2 narrowed; 4 removed"
  rationaleSource: "vultr" | "deterministic";
  generatedAt: string | null;
};

// ---------------------------------------------------------------------------
// Guard (GET /guard)
// ---------------------------------------------------------------------------

export type GuardPolicy = {
  version: "decoyr.guard.v1";
  agent: string;
  allow: { mcp_tools: Record<string, Record<string, unknown>>; network: { GET: string[]; POST: string[] } };
  deny: { mcp_tools: string[]; network: string[] };
  limits: { wall_seconds: number; memory_mb: number; max_tool_calls: number };
};

export type GuardRule = {
  id: string;
  capability: string;
  decision: "allow" | "deny";
  constraint: string; // "/release/**" | "all" | "acme/app"
  reason: string;
  evidenceEventIds: string[];
  enforcedAt: "mcp-middleware" | "egress-proxy" | "container-runtime";
};

export type Guard = {
  id: string;
  trialId: string;
  version: number;
  sha256: string;
  policy: GuardPolicy;
  rules: GuardRule[];
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Replay comparison (GET /replay)
// ---------------------------------------------------------------------------

export type ReplayRow = {
  metric: string; // "Legitimate task" | "Artifact" | "repo.read_file" | "secrets.get" | "Unauthorized egress" | "Security outcome"
  baseline: string; // "PASS" | "USED" | "POST attempted" | "COMPROMISED"
  replay: string; // "PASS" | "BLOCKED" | "CONTAINED"
  baselineTone: "success" | "danger" | "warning" | "blocked" | "neutral";
  replayTone: "success" | "danger" | "warning" | "blocked" | "neutral";
  baselineEventIds: string[];
  replayEventIds: string[];
};

export type ReplayComparison = {
  trialId: string;
  status: "not_started" | "running" | "complete";
  baselineRunId: string | null;
  replayRunId: string | null;
  guardId: string | null;
  guardSha256: string | null;
  same: { agent: string; world: string; task: string; attack: string; seed: string; scenarioSha256: string; identical: boolean };
  rows: ReplayRow[];
  verdict: "contained" | "guard_failed" | "task_broken" | "pending";
  verdictText: string; // "Contained for this tested scope"
  recoveredAfterDenial: boolean;
  divergence: { baselineSeq: number | null; replaySeq: number | null; description: string };
  timeline: { baseline: TraceEvent[]; replay: TraceEvent[] }; // significant events only (tool.*, net.*, honeytoken.*, artifact.created)
  artifacts: {
    baseline: Artifact | null;
    replay: Artifact | null;
    expectedCommits: { ref: string; subject: string; inBaseline: boolean; inReplay: boolean }[];
  };
};

// ---------------------------------------------------------------------------
// Passport (GET /passport)
// ---------------------------------------------------------------------------

export type Passport = {
  id: string;
  trialId: string;
  label: string; // "Calibrated: Release Notes / Acme Labs v1"  (or "Not calibrated" if replay not contained)
  status: "calibrated" | "not_calibrated" | "incomplete";
  missingPhases: string[]; // e.g. ["baseline","calibration","replay"]
  generatedAt: string;
  identity: { agent: string; version: string; purpose: string; model: string; trialId: string; trialTime: string; artifactSha256: string | null };
  coverage: { worldVersion: string; scenarioId: string; scenarioPack: string[]; seed: string; scenarioSha256: string; toolsTested: string[]; capabilitiesTested: string[] };
  usefulBehavior: { assertions: AssertionResult[]; artifacts: ArtifactRef[] };
  observedAuthority: { capability: string; count: number; baselineDecision: string }[];
  adversarialFindings: { id: string; title: string; category: FindingCategory; replayOutcome: Finding["replayOutcome"] }[];
  minimumViableAuthority: { capability: string; constraint: string | null }[];
  guard: { id: string; sha256: string; policy: GuardPolicy } | null;
  replayProof: { baselineRunId: string; replayRunId: string; baseline: { task: CheckResult; security: CheckResult }; replay: { task: CheckResult; security: CheckResult }; sameSeed: boolean } | null;
  evidence: { eventCount: number; baselineEvents: number; replayEvents: number; keyEventIds: string[] };
  limitations: string[];
};

// ---------------------------------------------------------------------------
// System (GET /api/v1/system)
// ---------------------------------------------------------------------------

export type SystemInfo = {
  version: string;
  inference: InferenceInfo;
  sandbox: { mode: "docker" | "process"; dockerAvailable: boolean; candidateImage: string; isolation: string[] };
  controlPlane: { host: string; provider: string }; // provider: "Vultr Cloud Compute" when DECOYR_HOST_PROVIDER=vultr
  services: { name: string; status: "up" | "down" | "unknown"; url?: string }[];
  demoTrialId: string | null;
};
