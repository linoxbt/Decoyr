import type { Metadata } from "next";
import { DocCards, DocPage, DocSection, DocTable } from "@/components/docs/Doc";

export const metadata: Metadata = { title: "Product overview — Docs", description: "The parts of Decoyr and how they fit together, plus the screens of the trials console." };

export default function ProductOverview() {
  return (
    <DocPage path="/docs/product" title="Product overview" lead="Decoyr is one system: a synthetic world, a sandbox, an evidence trail, an authority engine, a policy compiler, a replay harness and a Passport. Each part feeds the next.">
      <DocSection id="modules" title="Components">
        <DocTable
          head={["Component", "What it does"]}
          rows={[
            ["World engine", "Seeded, deterministic rendering of a synthetic company, persisted and hashed before the first run."],
            ["Sandboxed candidate", "Your agent runs as a separate process or hardened container and reaches the world only through MCP tools and an inference relay."],
            ["Evidence trace", "An append-only, correlated record of every model call, tool call, decision, egress attempt and artifact, streamed live."],
            ["Deterministic assertions", "Task and security assertions over real artifacts and events. The model never grades itself."],
            ["Authority engine", "Classifies every capability and derives the narrowest constraints the legitimate path used."],
            ["Guard compiler", "Emits a versioned, hashed decoyr.guard.v1 policy enforced in MCP middleware and at the egress proxy."],
            ["Replay & comparison", "Re-runs the identical trial under the Guard and compares the runs metric by metric."],
            ["Passport", "A scoped, evidence-backed record of what was demonstrated about this agent version."],
          ]}
        />
      </DocSection>

      <DocSection id="console" title="The trials console">
        <DocTable
          head={["Screen", "Use it to"]}
          rows={[
            ["Trials", "See every trial with its status, conclusion, task and security results."],
            ["New trial", "Register an agent profile, pick the capabilities it requests and the scenario packs."],
            ["World", "Inspect the synthetic company; reveal adversarial content when you choose to."],
            ["Live run", "Watch the run unfold, with an inspector for arguments, decisions and results."],
            ["Findings", "Follow causal chains from untrusted content to the failed assertion."],
            ["Authority", "Review the capability matrix, rationale, evidence and calibration iterations."],
            ["Guard", "Read the compiled policy and its rules."],
            ["Replay", "Compare baseline and guarded replay side by side."],
            ["Passport", "Hand a printable, scoped record to a reviewer."],
            ["Agents / Settings", "Browse agent profiles and their trials; check system status and reset the demo."],
          ]}
        />
      </DocSection>

      <DocSection id="more" title="Go deeper">
        <DocCards items={[
          { href: "/docs/authority", title: "Authority & Guard", body: "Capability classes and the policy format." },
          { href: "/docs/replay", title: "Replay & Passport", body: "Verdicts, divergence and what a Passport contains." },
        ]} />
      </DocSection>
    </DocPage>
  );
}
