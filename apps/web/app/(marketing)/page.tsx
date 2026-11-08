import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight, Ban, Box, Check, Eye, FileText, Fingerprint, KeyRound, Minus, Network, Repeat, ScrollText, Shield, ShieldCheck, Target, Timer, X,
} from "lucide-react";
import { PreparedDemoButton } from "@/components/trial/PreparedDemoButton";
import { CausalTrace } from "@/components/marketing/CausalTrace";
import { ArchitectureDiagram } from "@/components/marketing/ArchitectureDiagram";
import { Card, CtaBand, Eyebrow, Section, SectionHeader, TextLink } from "@/components/marketing/Section";
import { AuthorityPreview, GuardPreview, PassportPreview, ReplayPreview, WorldPreview } from "@/components/marketing/Previews";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: { absolute: "Decoyr — Give your AI agent a fake company before you give it yours" },
  description:
    "Decoyr releases autonomous AI agents into a synthetic enterprise, attacks them with realistic prompt injection, derives the minimum authority they need, enforces it with a machine-checked Guard, and proves it by replaying the same trial.",
};

const LOOP: [string, string][] = [
  ["Build", "Render a seeded, synthetic company"],
  ["Release", "Hand the agent real work"],
  ["Tempt", "Plant a poisoned instruction"],
  ["Observe", "Record every call as evidence"],
  ["Profile", "Separate needed from dangerous"],
  ["Constrain", "Compile a default-deny Guard"],
  ["Replay", "Same agent, seed, task, attack"],
  ["Prove", "Issue a scoped Passport"],
];

const TOUR = [
  {
    eyebrow: "01 · World",
    title: "A complete company that doesn't exist",
    body: "Acme Labs has a release repository, internal docs, engineering chat, a secret store and its own network. Every byte is synthetic and rendered from a seed, then persisted so every replay sees exactly the same world.",
    points: ["Honeycredentials that look real and are tracked everywhere", "Decoy files and restricted documents to measure scope creep", "Synthetic hosts behind a controlled egress proxy; no real internet"],
    href: "/scenarios",
    link: "Explore the scenarios",
    preview: <WorldPreview />,
  },
  {
    eyebrow: "02 · Authority",
    title: "Minimum authority, derived from behavior",
    body: "Decoyr doesn't ask the agent what it needs. It pairs every tool call with its outcome, separates the legitimate path from the attack path, and classifies each capability by evidence.",
    points: ["required · constrained · unnecessary · dangerous · untested", "Constraints narrowed to the exact paths, repos and files used", "Every classification links to the trace events behind it"],
    href: "/product",
    link: "See the authority engine",
    preview: <AuthorityPreview />,
  },
  {
    eyebrow: "03 · Guard",
    title: "A policy machines enforce, not a prompt",
    body: "The result compiles into decoyr.guard.v1: an explicit allowlist with constraints, a default-deny everything else, and run limits. It is enforced in MCP middleware before any tool runs and again at the egress proxy.",
    points: ["Default deny for tools and network", "Rules name where they are enforced", "Versioned and hashed; recalibrate without losing history"],
    href: "/docs#guard",
    link: "Read the Guard reference",
    preview: <GuardPreview />,
  },
  {
    eyebrow: "04 · Replay",
    title: "Proof by replaying the same attack",
    body: "Same agent, same world bytes, same seed, same task, same poisoned README, but now with the Guard on. The legitimate task must still pass, and every tested security assertion must pass too.",
    points: ["Divergence point pinpointed in the trace", "Recovery after denial is measured, not assumed", "If the Guard breaks the task, Decoyr widens the narrowest safe capability"],
    href: "/how-it-works",
    link: "How replay works",
    preview: <ReplayPreview />,
  },
  {
    eyebrow: "05 · Passport",
    title: "A record you can hand to a reviewer",
    body: "The Passport states exactly what was tested, what was observed, the minimum authority, the Guard hash and the replay proof. It is labeled only when the replay passed both the task and security checks.",
    points: ["Scoped label, e.g. “Calibrated: Release Notes / Acme Labs v1”", "Lists findings, untested capabilities and limitations", "No 0–100 trust score, ever"],
    href: "/product#passport",
    link: "What a Passport contains",
    preview: <PassportPreview />,
  },
];

const BOUNDARIES = [
  { icon: <KeyRound className="size-4" />, t: "Keys never enter the sandbox", d: "The candidate gets only a short-lived HMAC trial token. Model calls are relayed through the control plane, which alone holds the Vultr inference key." },
  { icon: <Box className="size-4" />, t: "Hardened, disposable containers", d: "Non-root uid, cap-drop ALL, no-new-privileges, read-only rootfs, CPU, memory and PID limits, and a wall-clock kill. Destroyed after every run." },
  { icon: <Network className="size-4" />, t: "A network per run", d: "Each run gets an internal Docker network with no route out. The synthetic MCP company is its only peer." },
  { icon: <Shield className="size-4" />, t: "Fail-closed policy", d: "If the policy service can't be reached, mcp-city and the egress proxy deny. The Guard is evaluated before every handler." },
  { icon: <Fingerprint className="size-4" />, t: "Masked honeycredentials", d: "Credential values are masked before evidence reaches storage or the browser, and detected in any outbound body." },
  { icon: <ScrollText className="size-4" />, t: "Append-only evidence", d: "Events carry run, sequence and correlation IDs from the model's tool choice to the policy decision and the result." },
];

type Mark = "yes" | "no" | "partial";
const COMPARE: { row: string; cells: [Mark, Mark, Mark, Mark] }[] = [
  { row: "Observes real behavior under attack", cells: ["yes", "partial", "no", "no"] },
  { row: "Derives least privilege from evidence", cells: ["yes", "no", "partial", "no"] },
  { row: "Machine-enforced, outside the prompt", cells: ["yes", "no", "partial", "no"] },
  { row: "Proves the policy keeps useful work", cells: ["yes", "no", "no", "no"] },
  { row: "Reproducible, same-seed replay", cells: ["yes", "no", "no", "no"] },
  { row: "No real data or credentials at risk", cells: ["yes", "partial", "yes", "yes"] },
];

const MARK = {
  yes: <Check className="mx-auto size-4 text-success" aria-label="Yes" />,
  partial: <Minus className="mx-auto size-4 text-warning" aria-label="Partially" />,
  no: <X className="mx-auto size-4 text-faint" aria-label="No" />,
};

const PERSONAS = [
  { icon: <ShieldCheck className="size-4" />, t: "Security teams", d: "Approve agents with evidence instead of questionnaires, and get a policy you can enforce on day one." },
  { icon: <Target className="size-4" />, t: "Platform & IT", d: "Grant the smallest set of tools, paths and hosts an agent needs, scoped per task and version." },
  { icon: <FileText className="size-4" />, t: "Agent builders", d: "Find the injection your agent falls for before a customer does, and ship with a Passport." },
  { icon: <Eye className="size-4" />, t: "Risk & procurement", d: "Compare vendors' agents on the same world, seed and attack, with limitations stated up front." },
];

const FAQ_TEASER: [string, string][] = [
  ["Does anything real touch the agent?", "No. The company, its data, its credentials and its network are synthetic. Outbound requests are served by a synthetic sink; nothing leaves the sandbox."],
  ["Is the Guard just a system prompt?", "No. The Guard is evaluated in code before every tool handler and again at the egress proxy. The model never decides what it is allowed to do."],
  ["Do I get a trust score?", "Deliberately not. You get a scoped label tied to a world, task, seed and Guard, with the untested surface listed."],
  ["What model does it use?", "Agents run against Vultr Serverless Inference through a trial-scoped relay. Without a key, a deterministic simulated model is used and labeled as such."],
];

export default function Landing() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:40px_40px] opacity-50 [mask-image:radial-gradient(ellipse_at_top_left,black_25%,transparent_70%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <Link href="/how-it-works" className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[12px] text-muted hover:text-text">
              <span className="size-1.5 rounded-full bg-success" aria-hidden /> Agent trust calibration, built on Vultr <ArrowRight className="size-3" aria-hidden />
            </Link>
            <h1 className="mt-5 text-[38px] font-semibold leading-[1.06] tracking-[-0.03em] md:text-[54px]">Give your AI agent a fake company before you give it yours.</h1>
            <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-muted">
              Decoyr releases an autonomous agent into a synthetic enterprise, tempts it with a realistic attack, derives the minimum authority it actually needs, and proves the resulting policy by replaying the same trial.
            </p>
            <div className="mt-8 flex flex-wrap items-start gap-3">
              <PreparedDemoButton label="Test an agent" variant="primary" size="lg" />
              <Link href="/how-it-works" className={buttonClass("secondary", "lg")}>See how it works</Link>
            </div>
            <ul className="mt-8 grid max-w-lg grid-cols-2 gap-x-6 gap-y-2 text-[13px] text-muted">
              {["Fully synthetic world", "Machine-enforced Guard", "Same-seed replay proof", "Evidence for every claim"].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check className="size-3.5 text-success" aria-hidden /> {t}</li>
              ))}
            </ul>
          </div>
          <CausalTrace />
        </div>
      </section>

      {/* Fact strip */}
      <section className="border-b border-border bg-bg">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 divide-border px-4 md:grid-cols-4 md:divide-x md:px-6">
          {[
            ["8 → 4", "capabilities after calibration in the prepared demo"],
            ["2", "independent enforcement points: MCP middleware and egress proxy"],
            ["100%", "synthetic data, credentials and hosts in every world"],
            ["0", "bytes that leave the sandbox, by construction"],
          ].map(([n, l]) => (
            <div key={l} className="px-2 py-6 md:px-6">
              <dt className="text-[26px] font-semibold tracking-[-0.02em]">{n}</dt>
              <dd className="mt-1 text-[12.5px] leading-snug text-muted">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Problem */}
      <Section>
        <SectionHeader
          eyebrow="The problem"
          title="Agents ask for the keys before anyone knows what they'll do with them."
          lead="Autonomous agents request broad access to repositories, documents, secrets and the network on day one. The first time one reads a poisoned instruction shouldn't be inside your real organization."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Card icon={<KeyRound className="size-4" />} title="Over-broad by default">Agents are granted everything they might need, because nobody can say what they will need. The blast radius is the whole grant.</Card>
          <Card icon={<FileText className="size-4" />} title="Forms describe intent, not behavior">Permission requests and model cards say what an agent is supposed to do. They can't show what it does when a README tells it otherwise.</Card>
          <Card icon={<Ban className="size-4" />} title="Prompts aren't boundaries">“Never exfiltrate secrets” in a system prompt is a suggestion. Indirect prompt injection arrives through the very data the agent was asked to read.</Card>
        </div>
      </Section>

      {/* Loop */}
      <Section tinted>
        <SectionHeader
          eyebrow="The calibration loop"
          title="Eight steps from untrusted agent to proven policy."
          lead="One excellent, reproducible trial instead of a benchmark of dozens. Every step produces evidence the next one builds on."
          action={<TextLink href="/how-it-works">Walk through each step</TextLink>}
        />
        <ol className="grid gap-px overflow-hidden rounded-[8px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {LOOP.map(([s, d], i) => (
            <li key={s} className="bg-surface p-5">
              <div className="mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</div>
              <div className="mt-1 text-[15px] font-semibold">{s}</div>
              <p className="mt-1 text-[13px] text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Product tour */}
      <Section>
        <SectionHeader eyebrow="Product" title="From first run to a policy you can ship." lead="The same trial produces the world, the evidence, the authority, the Guard, the replay and the Passport." />
        <div className="space-y-16 lg:space-y-20">
          {TOUR.map((s, i) => (
            <div key={s.title} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14 [&>*]:min-w-0">
              <div className={i % 2 ? "lg:order-2" : undefined}>
                <Eyebrow>{s.eyebrow}</Eyebrow>
                <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.015em]">{s.title}</h3>
                <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{s.body}</p>
                <ul className="mt-4 space-y-2 text-[13.5px]">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> <span>{p}</span></li>
                  ))}
                </ul>
                <div className="mt-5"><TextLink href={s.href}>{s.link}</TextLink></div>
              </div>
              <div className={i % 2 ? "lg:order-1" : undefined}>{s.preview}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Boundaries */}
      <Section tinted>
        <SectionHeader
          eyebrow="Security model"
          title="Built so the agent under test can't hurt the tester."
          lead="Trusted and untrusted zones are separated by process, container, network and credential boundaries."
          action={<TextLink href="/security">Read the security model</TextLink>}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BOUNDARIES.map((b) => <Card key={b.t} icon={b.icon} title={b.t}>{b.d}</Card>)}
        </div>
      </Section>

      {/* Comparison */}
      <Section>
        <SectionHeader eyebrow="Why Decoyr" title="Evidence beats assumptions." lead="How behavioral calibration compares with the ways teams approve agents today." />
        <div className="scroll-thin overflow-x-auto rounded-[8px] border border-border">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="border-b border-border bg-surface-2 text-[12px]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold"> </th>
                <th className="px-3 py-3 text-center font-semibold">Decoyr</th>
                <th className="px-3 py-3 text-center font-medium text-muted">Manual red team</th>
                <th className="px-3 py-3 text-center font-medium text-muted">Permission review</th>
                <th className="px-3 py-3 text-center font-medium text-muted">Prompt guardrails</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r) => (
                <tr key={r.row} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{r.row}</td>
                  {r.cells.map((c, i) => <td key={i} className={i === 0 ? "bg-success-bg/40 px-3 py-3" : "px-3 py-3"}>{MARK[c]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Architecture */}
      <Section tinted>
        <SectionHeader
          eyebrow="Architecture"
          title="Vultr runs the control plane, the inference and the sandbox."
          action={<TextLink href="/architecture">Full architecture</TextLink>}
        />
        <div className="rounded-[8px] border border-border bg-surface p-4"><ArchitectureDiagram /></div>
      </Section>

      {/* Personas */}
      <Section>
        <SectionHeader eyebrow="Who it's for" title="One trial, four audiences." action={<TextLink href="/use-cases">Explore use cases</TextLink>} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PERSONAS.map((p) => <Card key={p.t} icon={p.icon} title={p.t}>{p.d}</Card>)}
        </div>
      </Section>

      {/* FAQ teaser */}
      <Section tinted>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] md:text-[28px]">Questions teams ask first.</h2>
            <p className="mt-2 text-[14.5px] text-muted">Straight answers about scope, safety and what Decoyr does not claim.</p>
            <div className="mt-5"><TextLink href="/faq">All questions</TextLink></div>
          </div>
          <div className="divide-y divide-border rounded-[8px] border border-border bg-surface">
            {FAQ_TEASER.map(([q, a]) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14px] font-medium [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="text-faint transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-3 md:px-6">
          {[
            { icon: <Timer className="size-4" />, t: "About two minutes", d: "The prepared demo runs ResearchBot through the full loop: baseline, calibration, replay, Passport." },
            { icon: <Repeat className="size-4" />, t: "Reproducible", d: "World bytes are persisted and hashed. Replays are byte-identical, and the console proves it." },
            { icon: <Eye className="size-4" />, t: "Fully inspectable", d: "Open the World, the live trace, the Guard JSON and every piece of evidence behind a verdict." },
          ].map((c) => (
            <div key={c.t} className="flex gap-3">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-[6px] border border-border bg-surface-2">{c.icon}</span>
              <div>
                <div className="text-[14px] font-semibold">{c.t}</div>
                <p className="mt-0.5 text-[13px] text-muted">{c.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CtaBand
        title="Before you trust an AI agent with your company, give it a fake one."
        lead="Run the prepared demo, or open the trials console to calibrate your own agent profile."
        secondary={{ href: "/app/trials", label: "Open the console" }}
      />
    </>
  );
}
