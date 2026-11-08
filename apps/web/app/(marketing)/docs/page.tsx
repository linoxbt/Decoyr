import Link from "next/link";
import type { Metadata } from "next";
import { CodeFrame, CtaBand, DefList, Eyebrow, PageHero } from "@/components/marketing/Section";
import { GUARD_JSON } from "@/components/marketing/Previews";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Run Decoyr locally, configure it, deploy it to Vultr, and reference the Guard policy format, the public API, trace event types and the containment suite.",
};

const TOC = [
  ["quickstart", "Quickstart"],
  ["configuration", "Configuration"],
  ["deploy", "Deploy to Vultr"],
  ["guard", "Guard reference"],
  ["api", "API reference"],
  ["events", "Trace events"],
  ["containment", "Containment tests"],
];

const QUICKSTART = `# 1. Control plane (Python 3.12+)
cd apps/api
uv venv .venv && uv pip install -r requirements-dev.txt
.venv/bin/uvicorn decoyr.main:app --port 8000

# 2. Sandbox services (Node 22)
cd services/mcp-city     && npm ci && npm run dev    # :7100
cd services/egress-proxy && npm ci && npm run dev    # :7200
cd services/candidate-agent && npm ci && npm run build

# 3. Web console
cd apps/web && npm ci && npm run dev                 # :3000

# 4. Tests
cd apps/api && .venv/bin/python -m pytest -q`;

const DEPLOY = `cd infra/docker
cp .env.example .env        # set signing key, Postgres password, DOCKER_GID, Vultr key
docker compose --profile build build
docker compose up -d

# or provision a Vultr VM end to end
bash infra/vultr/provision.sh   # see infra/vultr/README.md
bash infra/vultr/deploy.sh      # push code + selected .env keys, rebuild, restart`;

const API: [string, string, string][] = [
  ["GET", "/api/v1/health", "Liveness"],
  ["GET", "/api/v1/system", "Inference mode, sandbox, services"],
  ["GET", "/api/v1/scenarios", "Worlds, tasks, packs, capabilities, limits"],
  ["GET", "/api/v1/agents", "Agent profiles with trial stats"],
  ["POST", "/api/v1/trials", "Create a draft trial"],
  ["POST", "/api/v1/trials/prepared-demo", "Fresh trial with the builtin ResearchBot"],
  ["GET", "/api/v1/trials/{id}", "Trial with runs and next action"],
  ["GET", "/api/v1/trials/{id}/world", "World view (?inspect=true reveals adversarial content)"],
  ["POST", "/api/v1/trials/{id}/run", "Start the baseline (409 if a run is active)"],
  ["POST", "/api/v1/trials/{id}/stop", "Stop the active run"],
  ["GET", "/api/v1/trials/{id}/events", "Trace events (?runId=&after=)"],
  ["GET", "/api/v1/trials/{id}/stream", "SSE: trace, status, end; resumable via Last-Event-ID"],
  ["GET", "/api/v1/trials/{id}/findings", "Findings with causal chains"],
  ["POST", "/api/v1/trials/{id}/calibrate", "Derive authority and compile a Guard"],
  ["GET", "/api/v1/trials/{id}/guard", "Compiled Guard (404 until calibrated)"],
  ["POST", "/api/v1/trials/{id}/replay", "Start the guarded replay (409 without a Guard)"],
  ["GET", "/api/v1/trials/{id}/replay", "Baseline vs replay comparison"],
  ["GET", "/api/v1/trials/{id}/passport", "Agent Passport"],
];

const EVENTS: [string, string][] = [
  ["run.*", "run.started · run.completed · run.failed"],
  ["sandbox.*", "network.created · container.created · container.exited · destroyed · log"],
  ["model.*", "model.request · model.response (tool choices, simulated flag)"],
  ["tool.*", "tool.request · tool.allow · tool.deny · tool.result · tool.error"],
  ["net.*", "net.request · net.allow · net.deny · net.response"],
  ["signals", "honeytoken.touch · honeytoken.egress · injection.delivered · process.kill"],
  ["outcomes", "artifact.created · guard.applied · assertion.pass · assertion.fail · finding.created"],
];

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="scroll-mt-20 text-[22px] font-semibold tracking-[-0.015em]">{children}</h2>;
}

export default function DocsPage() {
  return (
    <>
      <PageHero
        eyebrow="Documentation"
        title="Run it, configure it, deploy it, extend it."
        lead="Everything needed to stand up Decoyr and understand its contracts. The repository's docs/contracts.md and packages/schemas are the source of truth."
      >
        <Link href="#quickstart" className={buttonClass("primary", "lg")}>Quickstart</Link>
        <Link href="#api" className={buttonClass("secondary", "lg")}>API reference</Link>
      </PageHero>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:px-6 lg:grid-cols-[200px_1fr]">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-20">
            <Eyebrow>On this page</Eyebrow>
            <ul className="mt-3 space-y-1.5 border-l border-border text-[13px]">
              {TOC.map(([id, l]) => (
                <li key={id}><a href={`#${id}`} className="-ml-px block border-l border-transparent pl-3 text-muted hover:border-text hover:text-text">{l}</a></li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="min-w-0 space-y-14">
          <section>
            <H2 id="quickstart">Quickstart</H2>
            <p className="mt-2 text-[14.5px] text-muted">Local development uses the process sandbox and SQLite. Without a Vultr key, a deterministic simulated model is used and labeled as such.</p>
            <CodeFrame title="terminal" className="mt-4">{QUICKSTART}</CodeFrame>
            <p className="mt-3 text-[13.5px] text-muted">Open <span className="mono">http://localhost:3000</span> and click <span className="font-medium text-text">Test an agent</span>. The prepared demo runs the full loop.</p>
          </section>

          <section>
            <H2 id="configuration">Configuration</H2>
            <p className="mt-2 text-[14.5px] text-muted">The control plane reads environment variables. Secrets stay in the control plane; the candidate never receives them.</p>
            <div className="mt-4">
              <DefList
                labelWidth="290px"
                rows={[
                  [<span key="1" className="mono">VULTR_SERVERLESS_INFERENCE_API_KEY</span>, "Vultr inference key. Unset → simulated model."],
                  [<span key="2" className="mono">DECOYR_MODEL</span>, "Live model id; defaults to the first chat model listed."],
                  [<span key="3" className="mono">DECOYR_INTERNAL_SIGNING_KEY</span>, "HMAC key for trial tokens and the service token."],
                  [<span key="4" className="mono">DECOYR_SANDBOX</span>, "docker (isolation) or process (development)."],
                  [<span key="5" className="mono">DECOYR_CANDIDATE_IMAGE</span>, "Candidate image for docker mode."],
                  [<span key="6" className="mono">DATABASE_URL</span>, "PostgreSQL in deployment; SQLite locally."],
                  [<span key="7" className="mono">DOCKER_GID</span>, "Docker socket group for the non-root api container."],
                  [<span key="8" className="mono">TRIAL_MAX_SECONDS · _MEMORY_MB · _CPU_QUOTA · _MAX_PIDS · _MAX_TOOL_CALLS</span>, "Per-run limits (defaults 180 s, 512 MB, 1 CPU, 128 PIDs, 40 calls)."],
                ]}
              />
            </div>
          </section>

          <section>
            <H2 id="deploy">Deploy to Vultr</H2>
            <p className="mt-2 text-[14.5px] text-muted">One Vultr Cloud Compute VM runs the whole stack behind Caddy. Only the api container gets the Docker socket; candidates never do.</p>
            <CodeFrame title="terminal" className="mt-4">{DEPLOY}</CodeFrame>
          </section>

          <section>
            <H2 id="guard">Guard reference</H2>
            <p className="mt-2 text-[14.5px] text-muted">A Guard is a JSON policy in the <span className="mono">decoyr.guard.v1</span> format. Anything not explicitly allowed is denied.</p>
            <div className="mt-4 grid gap-6 xl:grid-cols-[1.1fr_1fr]">
              <CodeFrame title="guard.json">{GUARD_JSON}</CodeFrame>
              <DefList
                labelWidth="120px"
                rows={[
                  [<span key="a" className="mono">path_prefix</span>, "Path must start with the prefix; /release/ also matches /release."],
                  [<span key="b" className="mono">paths</span>, "Path must be one of the listed paths exactly."],
                  [<span key="c" className="mono">path_glob</span>, "Path must match the glob."],
                  [<span key="d" className="mono">repo</span>, "Repository must equal the value."],
                  [<span key="e" className="mono">hosts</span>, "Host must be in the list (net.fetch)."],
                  [<span key="f" className="mono">names</span>, "Secret name must be in the list."],
                  [<span key="g" className="mono">network</span>, "Per-method host allowlist evaluated at the egress proxy."],
                  [<span key="h" className="mono">limits</span>, "Wall clock, memory and tool-call budget per run."],
                ]}
              />
            </div>
          </section>

          <section>
            <H2 id="api">API reference</H2>
            <p className="mt-2 text-[14.5px] text-muted">JSON, camelCase. Errors are <span className="mono">{"{ detail, referenceId }"}</span>. Internal routes under <span className="mono">/internal</span> require the service token and are used only by the sandbox services.</p>
            <div className="scroll-thin mt-4 overflow-x-auto rounded-[8px] border border-border">
              <table className="w-full min-w-[600px] text-[13px]">
                <tbody>
                  {API.map(([m, p, d]) => (
                    <tr key={m + p} className="border-b border-border last:border-0">
                      <td className="w-16 px-4 py-2"><span className={m === "POST" ? "mono text-[11.5px] font-semibold text-blocked" : "mono text-[11.5px] font-semibold text-success"}>{m}</span></td>
                      <td className="mono px-2 py-2">{p}</td>
                      <td className="px-4 py-2 text-muted">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <H2 id="events">Trace events</H2>
            <p className="mt-2 text-[14.5px] text-muted">Every event has a per-run sequence number, an actor (agent, orchestrator, mcp, guard, sandbox), an optional decision and correlation ID, flags and sanitized evidence.</p>
            <div className="mt-4"><DefList labelWidth="110px" rows={EVENTS.map(([k, v]) => [<span key={k} className="mono">{k}</span>, v])} /></div>
          </section>

          <section>
            <H2 id="containment">Containment tests</H2>
            <p className="mt-2 text-[14.5px] text-muted">Prove the sandbox boundary on your Docker host. The script uses the orchestrator's exact hardening flags.</p>
            <CodeFrame title="terminal" className="mt-4">{`docker build -t decoyr/candidate-agent:latest services/candidate-agent
bash tests/containment/run.sh`}</CodeFrame>
          </section>
        </div>
      </div>

      <CtaBand title="Prefer to see it first?" lead="The prepared demo runs the whole loop against the bundled world." secondary={{ href: "/security", label: "Security model" }} />
    </>
  );
}
