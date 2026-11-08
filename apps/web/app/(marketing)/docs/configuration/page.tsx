import type { Metadata } from "next";
import { CodeFrame } from "@/components/marketing/Section";
import { Callout, Code, DocPage, DocSection, DocTable } from "@/components/docs/Doc";

export const metadata: Metadata = { title: "Configuration — Docs", description: "Environment variables for the Decoyr control plane, sandbox services and web console." };

export default function Configuration() {
  return (
    <DocPage path="/docs/configuration" title="Configuration" lead="Everything is configured through environment variables. Secrets stay in the control plane; the candidate agent never receives them.">
      <DocSection id="control-plane" title="Control plane">
        <DocTable
          head={["Variable", "Meaning"]}
          mono={[0]}
          rows={[
            ["VULTR_SERVERLESS_INFERENCE_API_KEY", "Vultr inference key. Unset → deterministic simulated model, labeled in every model event."],
            ["VULTR_INFERENCE_BASE_URL", "Defaults to https://api.vultrinference.com/v1."],
            ["DECOYR_MODEL", "Live model id. Defaults to the first chat model the provider lists."],
            ["DECOYR_INTERNAL_SIGNING_KEY", "HMAC key for trial tokens and the service token. Shared with mcp-city and egress-proxy."],
            ["DATABASE_URL", "PostgreSQL in deployment (postgres:// URLs are normalized); SQLite locally."],
            ["DECOYR_SANDBOX", "docker (isolation) or process (development)."],
            ["DECOYR_CANDIDATE_IMAGE", "Candidate image in docker mode (default decoyr/candidate-agent:latest)."],
            ["DECOYR_MCP_CONTAINER", "mcp-city container attached to each per-run network (default decoyr-mcp-city)."],
            ["DECOYR_SANDBOX_MCP_URL", "URL the candidate uses for mcp-city (docker: http://mcp-city:7100)."],
            ["DECOYR_ADMIN_TOKEN", "Operator token for POST /demo/reset (X-Decoyr-Admin header). Keep it in the control plane only."],
            ["DECOYR_PUBLIC_URL", "Console origin, allowed by CORS (needed when the trace stream goes direct)."],
            ["DECOYR_HOST_PROVIDER", "vultr or local; shown on the system status."],
            ["DECOYR_API_KEYS", "Comma-separated keys; when set, mutating routes require X-Decoyr-Key."],
            ["DECOYR_CANDIDATE_IMAGES", "Extra agent runtime images trials may select (operator allowlist)."],
            ["DECOYR_DAILY_MODEL_CALLS / _IP_ACTIONS_PER_10MIN / _IP_RUNS_PER_10MIN", "Abuse limits: global daily inference budget and per-client action/run caps."],
            ["DECOYR_REASONING_EFFORT / DECOYR_MAX_TOKENS", "Live-model reasoning effort and the per-reply token cap."],
            ["DECOYR_MAX_CONCURRENT_RUNS", "Runs executed at once; others queue (default 3)."],
          ]}
        />
      </DocSection>

      <DocSection id="limits" title="Run limits">
        <DocTable
          head={["Variable", "Default", "Enforced by"]}
          mono={[0]}
          rows={[
            ["TRIAL_MAX_SECONDS", "180", "Wall-clock kill (orchestrator)"],
            ["TRIAL_MEMORY_MB", "512", "Container memory + swap"],
            ["TRIAL_CPU_QUOTA", "1.0", "Container CPU quota"],
            ["TRIAL_MAX_PIDS", "128", "Container PID limit"],
            ["TRIAL_MAX_TOOL_CALLS", "40", "MCP middleware tool-call budget"],
            ["TRIAL_MAX_STEPS", "16", "Candidate agent loop steps"],
            ["TRIAL_DRILL_SECONDS", "8", "Resource-abuse drill wall clock"],
            ["TRIAL_RATE_PER_HOUR", "60", "Trial creation rate limit"],
          ]}
        />
      </DocSection>

      <DocSection id="demo-reset" title="Resetting the demo">
        <p>Resetting removes the prepared-demo trials and creates a fresh one. It is an operator action: the token lives only in the control plane's environment (<Code>DECOYR_ADMIN_TOKEN</Code>) and is never entered in, or sent by, the web console.</p>
        <CodeFrame title="terminal">{`curl -X POST https://<your-api-host>/api/v1/demo/reset \\
  -H "X-Decoyr-Admin: $DECOYR_ADMIN_TOKEN"`}</CodeFrame>
        <p>Demo reset is disabled unless an admin token is configured.</p>
      </DocSection>

      <DocSection id="web" title="Web console">
        <DocTable
          head={["Variable", "Meaning"]}
          mono={[0]}
          rows={[
            ["DECOYR_API_URL", "Where /api/v1/* is proxied (build time)."],
            ["NEXT_PUBLIC_DECOYR_STREAM_BASE", "Optional origin for the SSE trace stream, to bypass proxy buffering."],
            ["NEXT_PUBLIC_SITE_URL", "Canonical site URL for metadata and the sitemap."],
          ]}
        />
        <Callout tone="warning" title="Never in the sandbox">The candidate environment contains only <Code>DECOYR_TRIAL_TOKEN</Code>, the MCP and inference URLs, the agent profile, the task and the step limit.</Callout>
      </DocSection>
    </DocPage>
  );
}
