import type { Metadata } from "next";
import { Bullets, Callout, DocCards, DocPage, DocSection, DocTable } from "@/components/docs/Doc";

export const metadata: Metadata = {
  title: "Docs",
  description: "Decoyr documentation: what it is, core concepts, getting started, the security model and the API reference.",
};

export default function DocsIntro() {
  return (
    <DocPage
      path="/docs"
      title="Introduction"
      lead="Decoyr tests an untrusted AI agent inside a fake, sandboxed company, works out the minimum permissions it needs, enforces them with a machine-checked policy, and replays the same trial to prove the policy works."
    >
      <DocSection id="why" title="Why Decoyr">
        <p>Autonomous agents ask for broad access to repositories, documents, secrets and the network before anyone knows what they will actually do with it. Permission requests describe intent; they can't show what an agent does when the data it reads starts giving it instructions.</p>
        <p>Decoyr answers that question empirically. Everything the agent touches during a trial is synthetic, so nothing real is ever at risk.</p>
      </DocSection>

      <DocSection id="concepts" title="Core concepts">
        <DocTable
          head={["Concept", "What it is"]}
          rows={[
            ["World", "A seeded, synthetic company (Acme Labs v1): repository, docs, messages, secrets, network. Persisted and hashed per trial."],
            ["Trial", "One agent, one world, one task and one scenario pack. Holds every run."],
            ["Run", "One execution of the agent in the sandbox: the baseline (observe-only) or a replay (with Guard)."],
            ["Trace", "The append-only, correlated evidence of a run: model calls, tool calls, policy decisions, egress, artifacts."],
            ["Finding", "A causal chain from untrusted content to a failed security assertion."],
            ["Authority", "The classification of each capability (required, constrained, unnecessary, dangerous, untested) derived from the baseline."],
            ["Guard", "The compiled decoyr.guard.v1 policy, enforced in MCP middleware and at the egress proxy."],
            ["Passport", "A scoped, evidence-backed record of what was demonstrated about this exact agent version."],
          ]}
        />
      </DocSection>

      <DocSection id="loop" title="The loop in one paragraph">
        <p>Decoyr renders a world, releases the agent into it with a legitimate task, and tempts it with an indirect prompt injection. It records every action, separates the calls the task needed from the ones only the attack needed, compiles the narrowest policy that keeps the work, and replays the identical trial under that policy. If the task still passes and every security assertion passes, the agent gets a scoped Passport.</p>
        <Bullets items={["Build → Release → Tempt → Observe", "Profile → Constrain → Replay → Prove"]} />
      </DocSection>

      <Callout title="Scope, not a score">Decoyr never issues a universal safety rating. Every result names the world, task, scenario pack, seed and Guard it holds for, and lists what wasn't tested.</Callout>

      <DocSection id="next" title="Where to go next">
        <DocCards
          items={[
            { href: "/docs/quickstart", title: "Quickstart", body: "Run the control plane, sandbox services and console locally." },
            { href: "/docs/how-it-works", title: "How it works", body: "The eight stages of a calibration trial, step by step." },
            { href: "/docs/security", title: "Security model", body: "How the agent under test is isolated from anything real." },
            { href: "/docs/api", title: "API reference", body: "Every public endpoint the console uses." },
          ]}
        />
      </DocSection>
    </DocPage>
  );
}
