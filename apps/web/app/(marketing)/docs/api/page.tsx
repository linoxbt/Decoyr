import type { Metadata } from "next";
import { CodeFrame } from "@/components/marketing/Section";
import { Code, DocPage, DocSection, DocTable } from "@/components/docs/Doc";

export const metadata: Metadata = { title: "API — Docs", description: "The Decoyr public API under /api/v1: trials, runs, events, the SSE stream, authority, Guard, replay and Passport." };

const M = ({ m }: { m: "GET" | "POST" }) => <span className={m === "POST" ? "font-semibold text-blocked" : "font-semibold text-success"}>{m}</span>;

export default function Api() {
  return (
    <DocPage path="/docs/api" title="API" lead="JSON over HTTPS, camelCase, under /api/v1. Shapes are defined in packages/schemas; docs/contracts.md is the source of truth.">
      <DocSection id="conventions" title="Conventions">
        <p>Errors return <Code>{"{ detail, referenceId }"}</Code> with an appropriate status. Conflicts (for example starting a run while one is active) return 409. Trial creation is rate limited (429).</p>
      </DocSection>

      <DocSection id="system" title="System and catalog">
        <DocTable head={["Method", "Path", "Returns"]} mono={[0, 1]} rows={[
          [<M key="1" m="GET" />, "/health", "{ ok: true }"],
          [<M key="2" m="GET" />, "/system", "Inference mode, sandbox, services, demo trial"],
          [<M key="3" m="GET" />, "/scenarios", "Worlds, tasks, packs, capabilities, builtin agents, limits"],
          [<M key="4" m="GET" />, "/agents", "Agent profiles with trial stats"],
          [<M key="5" m="GET" />, "/agents/{id}", "Agent, its trials, latest Passport"],
          [<M key="6" m="GET" />, "/models", "Chat models with tool calling an agent can use"],
        ]} />
      </DocSection>

      <DocSection id="trials" title="Trials and runs">
        <DocTable head={["Method", "Path", "Returns"]} mono={[0, 1]} rows={[
          [<M key="1" m="GET" />, "/trials?q=&status=&sort=", "Trial list"],
          [<M key="2" m="POST" />, "/trials", "New draft trial (CreateTrialRequest)"],
          [<M key="3" m="POST" />, "/trials/prepared-demo", "New draft trial with the builtin ResearchBot"],
          [<M key="4" m="GET" />, "/trials/{id}", "Trial with runs and next action"],
          [<M key="5" m="POST" />, "/trials/{id}/duplicate", "Copy of the trial"],
          [<M key="6" m="GET" />, "/trials/{id}/world?inspect=", "World view (inspect reveals adversarial content)"],
          [<M key="7" m="POST" />, "/trials/{id}/run", "Starts the baseline (409 if a run is active)"],
          [<M key="8" m="POST" />, "/trials/{id}/stop", "Stops the active run"],
          [<M key="9" m="GET" />, "/trials/{id}/runs/{runId}", "Run summary"],
          [<M key="10" m="GET" />, "/trials/{id}/events?runId=&after=", "Trace events"],
          [<M key="11" m="GET" />, "/trials/{id}/artifacts?runId=", "Artifacts"],
          [<M key="12" m="GET" />, "/trials/{id}/findings", "Findings"],
        ]} />
      </DocSection>

      <DocSection id="calibration" title="Calibration, replay and proof">
        <DocTable head={["Method", "Path", "Returns"]} mono={[0, 1]} rows={[
          [<M key="1" m="POST" />, "/trials/{id}/calibrate", "Authority report; compiles a Guard (409 without a completed baseline)"],
          [<M key="2" m="GET" />, "/trials/{id}/authority", "Authority report"],
          [<M key="3" m="GET" />, "/trials/{id}/guard", "Guard (404 until calibrated)"],
          [<M key="4" m="POST" />, "/trials/{id}/replay", "Starts the guarded replay (409 without a Guard)"],
          [<M key="5" m="GET" />, "/trials/{id}/replay", "Replay comparison"],
          [<M key="6" m="GET" />, "/trials/{id}/passport", "Passport, with agent fingerprint and Ed25519 signature"],
          [<M key="8" m="GET" />, "/passports/public-key", "Public key that signs this deployment's Passports"],
          [<M key="9" m="POST" />, "/passports/verify", "Verify a Passport document's signature"],
          [<M key="7" m="POST" />, "/demo/reset", "Resets demo trials (header X-Decoyr-Admin)"],
        ]} />
      </DocSection>

      <DocSection id="stream" title="Live trace stream (SSE)">
        <p><Code>GET /api/v1/trials/{"{id}"}/stream?runId=&after=</Code> streams server-sent events. Each trace event has id <Code>{"<runId>:<seq>"}</Code>; reconnect with <Code>Last-Event-ID</Code> or <Code>after</Code> to resume without gaps.</p>
        <CodeFrame title="event stream">{`event: trace
id: run_01…:12
data: { "seq": 12, "type": "honeytoken.touch", "capability": "secrets.get", … }

event: status
data: { "trial": { "status": "compromised", … } }

event: end
data: { "runId": "run_01…", "status": "completed" }

: ping        (heartbeat every 15 s)`}</CodeFrame>
      </DocSection>

      <DocSection id="internal" title="Internal endpoints">
        <p>Routes under <Code>/internal</Code> (world snapshot, policy evaluation, event and artifact ingest, inference relay) require the HMAC service token and are used only by mcp-city and the egress proxy. They aren't part of the public API.</p>
      </DocSection>
    </DocPage>
  );
}
