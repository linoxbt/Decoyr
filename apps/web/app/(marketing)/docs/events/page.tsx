import type { Metadata } from "next";
import { CodeFrame } from "@/components/marketing/Section";
import { DocPage, DocSection, DocTable } from "@/components/docs/Doc";

export const metadata: Metadata = { title: "Trace events — Docs", description: "The Decoyr trace event model: fields, actors, decisions, flags and every event type." };

export default function Events() {
  return (
    <DocPage path="/docs/events" title="Trace events" lead="Every run produces an append-only, ordered list of events. Each one is evidence that findings, authority and verdicts can cite.">
      <DocSection id="shape" title="Event shape">
        <CodeFrame title="TraceEvent">{`{
  "id": "evt_…", "trialId": "trl_…", "runId": "run_…",
  "seq": 12,                       // per run, starts at 1
  "timestamp": "2026-11-08T07:44:58.412Z",
  "actor": "mcp",                  // agent | orchestrator | mcp | guard | sandbox
  "type": "honeytoken.touch",
  "title": "Honeycredential deploy-token returned to agent",
  "summary": "The secret store returned honeycredential deploy-token…",
  "capability": "secrets.get", "target": "deploy-token",
  "decision": "observed",          // allowed | denied | observed | error
  "correlationId": "call_…",       // links model choice → decision → egress → result
  "findingId": null,
  "flags": ["honeytoken", "attack_path"],
  "latencyMs": null,
  "evidence": { "masked": "acme_dpl_••••••••••" }
}`}</CodeFrame>
      </DocSection>

      <DocSection id="types" title="Event types">
        <DocTable head={["Family", "Types"]} mono={[0, 1]} rows={[
          ["run", "run.started · run.completed · run.failed"],
          ["sandbox", "sandbox.network.created · sandbox.container.created · sandbox.container.exited · sandbox.destroyed · sandbox.log · process.kill"],
          ["model", "model.request · model.response"],
          ["tool", "tool.request · tool.allow · tool.deny · tool.result · tool.error"],
          ["net", "net.request · net.allow · net.deny · net.response"],
          ["signals", "honeytoken.touch · honeytoken.egress · injection.delivered"],
          ["outcomes", "artifact.created · guard.applied · assertion.pass · assertion.fail · finding.created"],
        ]} />
      </DocSection>

      <DocSection id="flags" title="Flags">
        <DocTable head={["Flag", "Meaning"]} mono={[0]} rows={[
          ["untrusted_content", "The result contains repository, document or message content the agent should treat as data."],
          ["injection", "The content includes a planted instruction."],
          ["honeytoken", "A honeycredential was requested, returned or detected."],
          ["adversarial", "The target is an adversarial host."],
          ["attack_path / legitimate_path", "Classification by the security analysis."],
          ["guard", "The decision was enforced by a Guard."],
          ["limit", "A run limit was hit (tool budget, wall clock, memory)."],
          ["simulated", "The model event came from the simulated model."],
        ]} />
      </DocSection>

      <DocSection id="evidence" title="Evidence fields">
        <p>Decision events carry the sanitized arguments, the policy reason, the rule id and whether a Guard enforced it. Tool results carry a masked preview (≤ 400 characters), the result hash and its size. Honeycredential values never appear in evidence.</p>
      </DocSection>
    </DocPage>
  );
}
