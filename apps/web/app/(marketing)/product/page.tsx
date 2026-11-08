import Link from "next/link";
import type { Metadata } from "next";
import { Activity, Bot, Check, FileSearch, GitCompare, Globe, IdCard, Layers, ListChecks, Radio, Shield, SlidersHorizontal } from "lucide-react";
import { PreparedDemoButton } from "@/components/trial/PreparedDemoButton";
import { Card, CtaBand, DefList, Eyebrow, PageHero, Section, SectionHeader } from "@/components/marketing/Section";
import { AuthorityPreview, GuardPreview, PassportPreview, Pill, ReplayPreview } from "@/components/marketing/Previews";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Product",
  description: "The Decoyr product: synthetic worlds, live evidence traces, the authority engine, the decoyr.guard.v1 policy compiler, same-seed replay and the scoped Agent Passport.",
};

const MODULES = [
  { icon: <Globe className="size-4" />, t: "World engine", d: "Deterministic, seeded rendering of a synthetic company: repository, docs, messages, secrets, network and workspace. Persisted and hashed before the first run." },
  { icon: <Bot className="size-4" />, t: "Sandboxed candidate", d: "Your agent runs as a separate process or hardened container and reaches the world only through MCP tools and an inference relay." },
  { icon: <Activity className="size-4" />, t: "Evidence trace", d: "An append-only, correlated record: model choice → tool request → policy decision → egress → result → artifact. Streamed live to the console." },
  { icon: <ListChecks className="size-4" />, t: "Deterministic assertions", d: "Task and security assertions inspect real artifacts and events. The model never grades itself." },
  { icon: <SlidersHorizontal className="size-4" />, t: "Authority engine", d: "Classifies every requested or observed capability and derives the narrowest constraints the legitimate path used." },
  { icon: <Shield className="size-4" />, t: "Guard compiler", d: "Emits a versioned, hashed decoyr.guard.v1 policy with rules that name where they are enforced." },
  { icon: <GitCompare className="size-4" />, t: "Replay & comparison", d: "Re-runs the identical trial under the Guard and compares baseline vs replay metric by metric, with the divergence point." },
  { icon: <IdCard className="size-4" />, t: "Agent Passport", d: "A scoped, evidence-backed record of what was demonstrated about this exact agent version, and what wasn't." },
];

const CLASSES: [React.ReactNode, string][] = [
  [<Pill key="r" tone="success">required</Pill>, "Needed by the task and used on the legitimate path. Allowed as used."],
  [<Pill key="c" tone="blocked">constrained</Pill>, "Required, and narrowed to the exact scope the task touched — e.g. /release/** instead of the whole repository."],
  [<Pill key="u" tone="neutral">unnecessary</Pill>, "Used, harmless, but the task completes without it. Removed to shrink the blast radius."],
  [<Pill key="d" tone="danger">dangerous</Pill>, "Used only on the attack path: honeycredential access, unapproved egress. Denied."],
  [<Pill key="t" tone="warning">untested</Pill>, "Requested but never exercised, so its safe use is unproven. Denied by default."],
];

const SCREENS = [
  ["Trials", "Every trial with status, conclusion, task and security results at a glance."],
  ["World", "Inspect the synthetic company; reveal adversarial content when you choose to."],
  ["Live trace", "Watch the run unfold with an inspector for arguments, decisions and results."],
  ["Findings", "Causal chains from untrusted content to the failed assertion, with impact."],
  ["Authority", "The capability matrix, rationale, evidence links and calibration iterations."],
  ["Guard", "The compiled policy JSON and its rules, each with enforcement point and evidence."],
  ["Replay", "Baseline vs guarded replay, synchronized timelines and artifact diff."],
  ["Passport", "A printable record for reviewers, with limitations stated up front."],
];

export default function ProductPage() {
  return (
    <>
      <PageHero
        eyebrow="Product"
        title="Everything you need to calibrate an agent's authority."
        lead="Decoyr is one coherent system: a synthetic world, a sandbox, an evidence trail, an authority engine, a policy compiler, a replay harness and a Passport. Each piece feeds the next."
        aside={<AuthorityPreview />}
      >
        <PreparedDemoButton label="Test an agent" variant="primary" size="lg" />
        <Link href="/docs" className={buttonClass("secondary", "lg")}>Read the docs</Link>
      </PageHero>

      <Section>
        <SectionHeader eyebrow="Components" title="Eight modules, one evidence chain." lead="Every module writes evidence the next one can cite. Nothing in a verdict is taken on faith." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => <Card key={m.t} icon={m.icon} title={m.t}>{m.d}</Card>)}
        </div>
      </Section>

      <Section tinted>
        <div className="grid items-start gap-10 lg:grid-cols-2 [&>*]:min-w-0">
          <div>
            <Eyebrow>Authority engine</Eyebrow>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">Five classes, each backed by evidence.</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
              Decoyr pairs every tool request with its decision, then separates the legitimate path from the attack path using honeycredential evidence, adversarial hosts and decoy targets. The scenario's declared requirements anchor what the task genuinely needs.
            </p>
            <div className="mt-6"><DefList labelWidth="130px" rows={CLASSES} /></div>
          </div>
          <div className="space-y-4">
            <Card icon={<FileSearch className="size-4" />} title="Static check before replay">
              Before spending a replay, every baseline call is re-evaluated under the candidate Guard: legitimate calls must be allowed and attack calls denied. In the prepared demo: 4/4 and 2/2.
            </Card>
            <Card icon={<Layers className="size-4" />} title="Recalibration that only widens what's safe">
              If a replay breaks the task, Decoyr promotes the narrowest denied, non-dangerous capability and recompiles a new Guard version. Dangerous capabilities stay denied.
            </Card>
            <Card icon={<Radio className="size-4" />} title="Optional model-written rationale">
              With a Vultr key configured, a trusted control-plane model explains each classification in plain language. Classifications themselves are always deterministic.
            </Card>
          </div>
        </div>
      </Section>

      <Section id="guard">
        <div className="grid items-center gap-10 lg:grid-cols-2 [&>*]:min-w-0">
          <GuardPreview />
          <div>
            <Eyebrow>Guard compiler</Eyebrow>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">decoyr.guard.v1: readable by people, enforced by code.</h2>
            <ul className="mt-5 space-y-3 text-[14px]">
              {[
                ["Explicit allowlist", "Only the capabilities the task needed, each with its narrowest constraint."],
                ["Default deny", "Every other tool and every network host is denied, and the deny list says so explicitly."],
                ["Two enforcement points", "MCP middleware evaluates each tool call before its handler; the egress proxy evaluates each outbound request per host."],
                ["Run limits", "Tool-call budget in middleware; wall clock, memory and PIDs at the container runtime."],
                ["Versioned and hashed", "Each calibration produces a new version; the replay records exactly which Guard it ran under."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /><span><span className="font-medium">{t}.</span> <span className="text-muted">{d}</span></span></li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section tinted>
        <div className="grid items-center gap-10 lg:grid-cols-2 [&>*]:min-w-0">
          <div>
            <Eyebrow>Replay</Eyebrow>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">Same agent. Same world. Same attack. New authority.</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
              Replay reconstructs the identical world from the persisted scenario bytes and seed, applies the Guard, and runs the same agent on the same task with the same poisoned README. The comparison reports every metric side by side.
            </p>
            <DefList
              labelWidth="150px"
              rows={[
                ["Contained", "Task passes and every tested security assertion passes."],
                ["Task broken", "The attack is blocked but the legitimate work no longer passes: recalibrate."],
                ["Guard failed", "A security assertion still fails under the Guard."],
              ]}
            />
          </div>
          <ReplayPreview />
        </div>
      </Section>

      <Section id="passport">
        <div className="grid items-start gap-10 lg:grid-cols-2 [&>*]:min-w-0">
          <PassportPreview />
          <div>
            <Eyebrow>Agent Passport</Eyebrow>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">Scoped claims a reviewer can verify.</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
              The Passport is generated from persisted runs, events, the Guard and findings. Completed Passports are stored as snapshots, so the record a reviewer saw doesn't drift.
            </p>
            <ul className="mt-5 grid gap-2 text-[13.5px] sm:grid-cols-2">
              {["Identity: agent, version, model", "Coverage: world, scenario, seed, hash", "Useful behavior: assertions and artifacts", "Observed authority per capability", "Adversarial findings and replay outcome", "Minimum viable authority", "Guard id, hash and policy", "Replay proof and limitations"].map((t) => (
                <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section tinted>
        <SectionHeader eyebrow="Console" title="Eight screens, one trial." lead="The trials console walks each trial through its phases and always tells you the next action." />
        <ol className="grid gap-px overflow-hidden rounded-[8px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {SCREENS.map(([t, d], i) => (
            <li key={t} className="bg-surface p-5">
              <div className="mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</div>
              <div className="mt-1 text-[14.5px] font-semibold">{t}</div>
              <p className="mt-1 text-[13px] text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      <CtaBand title="See the whole loop in about two minutes." lead="The prepared demo creates a fresh trial with ResearchBot 0.9.2 on Acme Labs v1." secondary={{ href: "/docs/how-it-works", label: "How it works" }} />
    </>
  );
}
