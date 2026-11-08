import Link from "next/link";
import type { Metadata } from "next";
import { Check, ClipboardCheck, Code2, Scale, ShieldCheck } from "lucide-react";
import { PreparedDemoButton } from "@/components/trial/PreparedDemoButton";
import { CtaBand, Eyebrow, PageHero, Section, SectionHeader } from "@/components/marketing/Section";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Use cases",
  description: "How security teams, platform and IT teams, agent builders and risk and procurement teams use Decoyr to approve autonomous AI agents with evidence and least-privilege policy.",
};

const CASES = [
  {
    icon: <ShieldCheck className="size-5" />,
    who: "Security teams",
    title: "Approve agents with evidence, not questionnaires.",
    pain: "A vendor's agent asks for repository, secrets and network access. The security review has a permission form and a promise.",
    flow: [
      "Register the agent profile with the capabilities it requests.",
      "Run the baseline in Acme Labs with the injection pack.",
      "Review findings: did it follow the poisoned README? What did it touch?",
      "Accept the derived Guard and require it in production.",
    ],
    outcome: "A decision backed by a trace, a Guard you can enforce, and a Passport that states its own limits.",
  },
  {
    icon: <ClipboardCheck className="size-5" />,
    who: "Platform & IT",
    title: "Grant the minimum, per task and version.",
    pain: "Agents get broad, standing access because nobody can say which tools, paths and hosts they really need.",
    flow: [
      "Calibrate each agent on the task it will actually perform.",
      "Use the constrained capabilities (/release/**, acme/app) as the grant.",
      "Keep the default-deny network policy unless the task proved it needs a host.",
      "Re-calibrate on every new agent version, model or prompt.",
    ],
    outcome: "Grants that shrink from “everything requested” to what the work used: 8 → 4 in the prepared demo.",
  },
  {
    icon: <Code2 className="size-5" />,
    who: "Agent builders",
    title: "Find the injection your agent falls for, first.",
    pain: "Your agent passes its evals, then a customer's README tells it to do something else.",
    flow: [
      "Point Decoyr at your agent build and system prompt.",
      "Watch the live trace for untrusted content becoming action.",
      "Fix the prompt or tool use; replay the identical trial to compare.",
      "Ship with a Passport and a recommended Guard.",
    ],
    outcome: "Reproducible regressions with the same seed, and a security story you can show customers.",
  },
  {
    icon: <Scale className="size-5" />,
    who: "Risk & procurement",
    title: "Compare agents on equal terms.",
    pain: "Every vendor claims their agent is safe, each with its own test and its own definition of safe.",
    flow: [
      "Run each candidate in the same world, with the same task, pack and seed.",
      "Compare task results, findings and minimum authority side by side.",
      "Read each Passport's limitations, not just its label.",
      "Contract on the Guard, not on the marketing.",
    ],
    outcome: "Like-for-like evidence, scoped claims, and no opaque 0–100 scores.",
  },
];

export default function UseCasesPage() {
  return (
    <>
      <PageHero
        eyebrow="Use cases"
        title="Different teams, one question: what should this agent be allowed to do?"
        lead="Decoyr answers it the same way for everyone: by watching the agent do real work in a fake company under attack, then proving the answer."
      >
        <PreparedDemoButton label="Test an agent" variant="primary" size="lg" />
        <Link href="/product" className={buttonClass("secondary", "lg")}>Product overview</Link>
      </PageHero>

      {CASES.map((c, i) => (
        <Section key={c.who} tinted={i % 2 === 1}>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <div className="inline-flex size-10 items-center justify-center rounded-[8px] border border-border bg-surface-2">{c.icon}</div>
              <Eyebrow className="mt-4">{c.who}</Eyebrow>
              <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em]">{c.title}</h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{c.pain}</p>
            </div>
            <div className="rounded-[8px] border border-border bg-surface">
              <div className="border-b border-border px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Workflow</div>
              <ol className="px-5 py-4">
                {c.flow.map((f, j) => (
                  <li key={f} className="flex gap-3 py-1.5 text-[14px]">
                    <span className="mono mt-0.5 text-[11.5px] text-faint">{String(j + 1).padStart(2, "0")}</span>
                    {f}
                  </li>
                ))}
              </ol>
              <div className="flex gap-2 border-t border-border bg-success-bg/50 px-5 py-3 text-[13.5px]">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <span><span className="font-medium">Outcome:</span> <span className="text-muted">{c.outcome}</span></span>
              </div>
            </div>
          </div>
        </Section>
      ))}

      <Section>
        <SectionHeader eyebrow="Common thread" title="What every team gets." />
        <div className="grid gap-px overflow-hidden rounded-[8px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["A trace", "Every action, decision and result, correlated."],
            ["A Guard", "Least privilege, machine-enforced, versioned."],
            ["A replay", "Proof the Guard keeps the work and stops the attack."],
            ["A Passport", "Scoped claims with limitations stated."],
          ].map(([t, d]) => (
            <div key={t} className="bg-surface p-5">
              <div className="text-[15px] font-semibold">{t}</div>
              <p className="mt-1 text-[13px] text-muted">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand title="Start with the prepared demo." lead="ResearchBot 0.9.2 meets a poisoned README in Acme Labs. See which team's question it answers for you." secondary={{ href: "/docs/faq", label: "Read the FAQ" }} />
    </>
  );
}
