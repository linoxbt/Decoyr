import type { Metadata } from "next";
import { DocPage, DocSection, DocTable } from "@/components/docs/Doc";

export const metadata: Metadata = { title: "About — Docs", description: "Why Decoyr exists, its principles, and the Vultr Agent Rush hackathon it was built for." };

export default function About() {
  return (
    <DocPage path="/docs/about" title="About" lead="Trust is something you calibrate, not something you grant.">
      <DocSection id="why" title="Why it exists">
        <p>Agents are moving from chat windows into repositories, ticket queues, secret stores and production networks. A list of requested scopes, a vendor questionnaire or a line in a system prompt can't answer the question that matters: what will this agent do when something it reads tells it to misbehave?</p>
        <p>Decoyr answers it empirically: a company that doesn't exist, real work, a realistic attack, full evidence, the smallest authority that still gets the job done, and a replay to prove it.</p>
      </DocSection>
      <DocSection id="principles" title="Principles">
        <DocTable
          head={["Principle", "In practice"]}
          rows={[
            ["Behavior over declarations", "Traces describe reality; permission forms describe intent."],
            ["Least privilege is derived", "Every grant traces back to evidence."],
            ["Boundaries live in code", "Policy is enforced where tools run and where traffic leaves, not in a prompt."],
            ["Prove it twice", "A policy isn't done until the attack has been replayed against it."],
            ["Claims stay scoped", "No universal scores; every result names its world, task, seed and Guard."],
            ["Nothing real at risk", "All data, credentials and hosts are synthetic."],
          ]}
        />
      </DocSection>
      <DocSection id="vultr" title="Built on Vultr">
        <p>Decoyr was built for the Vultr <strong>Agent Rush: Blast Radius Zero</strong> hackathon. Vultr Cloud Compute is designed to host the control plane and the per-run sandboxes; Vultr Serverless Inference powers the agents through a trial-scoped relay. It is MIT licensed.</p>
      </DocSection>
    </DocPage>
  );
}
