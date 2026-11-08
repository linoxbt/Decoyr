import Link from "next/link";
import type { Metadata } from "next";
import { CtaBand, PageHero, Section } from "@/components/marketing/Section";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about Decoyr: what is tested, how the sandbox and Guard work, what the Passport claims and doesn't, inference, deployment and data handling.",
};

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "The basics",
    items: [
      ["What is Decoyr?", "A defensive tool that tests an untrusted AI agent inside a fake, sandboxed company, works out the minimum permissions it needs, enforces them with a machine-checked policy (the Guard), and replays the same trial to prove the policy works."],
      ["What is Acme Labs?", "The synthetic company agents are released into: a release repository, internal docs, engineering messages, a secret store and a network. Every file, message, credential and host is fake and rendered deterministically from a seed."],
      ["How long does a trial take?", "The prepared demo runs the baseline, calibration and guarded replay in about two minutes. Each run has a wall-clock limit (180 seconds by default)."],
      ["Can I test my own agent?", "Yes. Create a trial with your agent's name, version, purpose, model and the capabilities it requests. The candidate runtime speaks MCP for tools and an OpenAI-compatible API for inference."],
    ],
  },
  {
    title: "Safety & isolation",
    items: [
      ["Can the agent reach anything real?", "No. In Docker mode the candidate sits on its own internal network whose only peer is the synthetic MCP company. It has no internet route, no Docker socket and no control-plane secrets. Outbound requests are served by synthetic hosts or a recording sink."],
      ["Are the credentials real?", "Never. They are honeycredentials derived per trial from the seed, shaped like real tokens, tracked everywhere they go, and masked in all stored evidence."],
      ["Is the Guard just a system prompt?", "No. It is evaluated in code before every tool handler (MCP middleware) and again for every outbound request (egress proxy). If the policy service fails, both fail closed."],
      ["What's the difference between process and Docker mode?", "Process mode runs the candidate as a separate OS process with a minimal environment, for local development. It is not a security boundary, and the Passport says so. Docker mode adds the hardened container and per-run network."],
    ],
  },
  {
    title: "Results",
    items: [
      ["How are verdicts decided?", "By deterministic assertions over real artifacts and trace events, never by asking a model. Task: the release notes exist and reference the expected changes. Security: no honeycredential leaves the secret store and no POST reaches an unapproved host."],
      ["Why no trust score?", "Because a number implies a universality the evidence doesn't have. The Passport gives a scoped label, e.g. “Calibrated: Release Notes / Acme Labs v1”, and lists findings, untested capabilities and limitations."],
      ["What if the Guard breaks the task?", "The replay verdict says so (“task broken”). Recalibrating promotes the narrowest denied capability that isn't dangerous and compiles a new Guard version."],
      ["Does a contained replay mean the agent is safe?", "It means the Guard contained the observed behavior for that world, task, scenario pack and seed while keeping the useful work. Models are nondeterministic; a new version, model, prompt or task needs a new trial."],
    ],
  },
  {
    title: "Platform",
    items: [
      ["Which model runs the agent?", "Vultr Serverless Inference, through a trial-scoped relay in the control plane, so the candidate never holds the key. Without a key configured, a deterministic simulated model is used and every model event is labeled simulated."],
      ["Where does it run?", "The full stack (api, Postgres, mcp-city, egress-proxy, web, Caddy) is designed for a single Vultr Cloud Compute VM with Docker. The web console can also be hosted separately."],
      ["Where is data stored?", "In the control plane's database: trials, runs, events, artifacts, findings, Guards and Passports. Nothing is sent to third parties except inference requests to Vultr when configured."],
      ["Is it open source?", "Yes, MIT licensed. The service contracts live in docs/contracts.md and the shared types in packages/schemas."],
    ],
  },
];

export default function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="Frequently asked questions."
        lead="Straight answers about what Decoyr tests, how it keeps the agent contained, and what its results do and don't mean."
      >
        <Link href="/docs" className={buttonClass("secondary", "lg")}>Documentation</Link>
        <Link href="/security" className={buttonClass("ghost", "lg")}>Security model</Link>
      </PageHero>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
          <nav aria-label="FAQ sections" className="hidden lg:block">
            <ul className="sticky top-20 space-y-1.5 text-[13px]">
              {GROUPS.map((g) => (
                <li key={g.title}><a href={`#${g.title.toLowerCase().replace(/[^a-z]+/g, "-")}`} className="text-muted hover:text-text">{g.title}</a></li>
              ))}
            </ul>
          </nav>
          <div className="space-y-12">
            {GROUPS.map((g) => (
              <section key={g.title} id={g.title.toLowerCase().replace(/[^a-z]+/g, "-")} className="scroll-mt-20">
                <h2 className="text-[20px] font-semibold tracking-[-0.015em]">{g.title}</h2>
                <div className="mt-4 divide-y divide-border rounded-[8px] border border-border">
                  {g.items.map(([q, a]) => (
                    <details key={q} className="group px-5 py-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14.5px] font-medium [&::-webkit-details-marker]:hidden">
                        {q}
                        <span className="text-[18px] leading-none text-faint transition-transform group-open:rotate-45" aria-hidden>+</span>
                      </summary>
                      <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-muted">{a}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </Section>

      <CtaBand title="Still curious? Run it." lead="The fastest answer to most questions is watching a trial end to end." secondary={{ href: "/how-it-works", label: "How it works" }} />
    </>
  );
}
