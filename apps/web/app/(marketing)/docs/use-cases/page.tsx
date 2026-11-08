import type { Metadata } from "next";
import { DocPage, DocSection, Steps } from "@/components/docs/Doc";

export const metadata: Metadata = { title: "Use cases — Docs", description: "How security, platform, agent-building and procurement teams use Decoyr." };

const CASES: { id: string; who: string; goal: string; steps: [string, string][]; outcome: string }[] = [
  { id: "security", who: "Security teams", goal: "Approve agents with evidence, not questionnaires.", steps: [["Register the agent", "Create a trial with the capabilities the agent requests."], ["Run the baseline", "Use the injection pack in Acme Labs."], ["Review findings", "Did it follow the poisoned README? What did it touch?"], ["Require the Guard", "Accept the derived policy for production."]], outcome: "A decision backed by a trace, an enforceable Guard, and a Passport that states its limits." },
  { id: "platform", who: "Platform & IT", goal: "Grant the minimum, per task and version.", steps: [["Calibrate per task", "Run each agent on the task it will actually do."], ["Grant the constraints", "Use the constrained capabilities (/release/**, acme/app) as the grant."], ["Keep network default-deny", "Unless the task proved it needs a host."], ["Recalibrate on change", "New version, model or prompt means a new trial."]], outcome: "Grants that shrink from everything requested to what the work used: 8 → 4 in the prepared demo." },
  { id: "builders", who: "Agent builders", goal: "Find the injection your agent falls for, first.", steps: [["Point Decoyr at your build", "Agent profile, model and system prompt."], ["Watch the live trace", "Look for untrusted content turning into action."], ["Fix and replay", "Same seed, so the comparison is fair."], ["Ship with a Passport", "And a recommended Guard."]], outcome: "Reproducible regressions and a security story you can show customers." },
  { id: "procurement", who: "Risk & procurement", goal: "Compare agents on equal terms.", steps: [["Same world for everyone", "Same task, pack and seed for each candidate."], ["Compare side by side", "Task results, findings and minimum authority."], ["Read the limitations", "Not just the label."], ["Contract on the Guard", "Not on the marketing."]], outcome: "Like-for-like evidence with scoped claims and no opaque scores." },
];

export default function UseCases() {
  return (
    <DocPage path="/docs/use-cases" title="Use cases" lead="Different teams, one question: what should this agent be allowed to do?">
      {CASES.map((c) => (
        <DocSection key={c.id} id={c.id} title={c.who}>
          <p><strong>{c.goal}</strong></p>
          <Steps items={c.steps} />
          <p><strong>Outcome:</strong> {c.outcome}</p>
        </DocSection>
      ))}
    </DocPage>
  );
}
