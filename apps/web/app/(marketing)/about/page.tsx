import Link from "next/link";
import type { Metadata } from "next";
import { Cloud, Cpu, Server } from "lucide-react";
import { Card, CtaBand, Eyebrow, PageHero, Section, SectionHeader } from "@/components/marketing/Section";
import { buttonClass } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "About",
  description: "Why Decoyr exists, the principles behind it, and how it was built for the Vultr Agent Rush — Blast Radius Zero hackathon.",
};

const PRINCIPLES: [string, string][] = [
  ["Behavior over declarations", "What an agent does under pressure is the only reliable signal of what it needs. Permission forms describe intent; traces describe reality."],
  ["Least privilege is derived, not guessed", "Authority should shrink to what the work used, with every grant traceable to evidence."],
  ["Boundaries live in code", "A system prompt is a request. Policy must be enforced where tools run and where traffic leaves."],
  ["Prove it twice", "A policy isn't done until the same attack has been replayed against it and the useful work still succeeds."],
  ["Claims stay scoped", "No universal scores. Every result names its world, task, seed and Guard, and lists what wasn't tested."],
  ["Nothing real at risk", "Testing an untrusted agent must never put real data, credentials or networks in reach."],
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Trust is something you calibrate, not something you grant."
        lead="Decoyr started from a simple observation: organizations hand autonomous agents broad access before anyone has watched what those agents do when the data they read starts giving orders."
      >
        <Link href="/how-it-works" className={buttonClass("primary", "lg")}>How it works</Link>
        <Link href="/security" className={buttonClass("secondary", "lg")}>Security model</Link>
      </PageHero>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Why it exists</Eyebrow>
            <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">Blast radius zero, before day one.</h2>
          </div>
          <div className="space-y-4 text-[15px] leading-relaxed text-muted">
            <p>Agents are moving from chat windows into repositories, ticket queues, secret stores and production networks. The usual approval process (a list of requested scopes, a vendor questionnaire, a line in a system prompt) can't answer the question that matters: what will this agent do when something it reads tells it to misbehave?</p>
            <p>Decoyr answers it empirically. It builds a company that doesn't exist, gives the agent real work there, plants a realistic attack, and records everything. From that evidence it derives the smallest authority that still gets the job done, enforces it, and replays the trial to prove it.</p>
          </div>
        </div>
      </Section>

      <Section tinted>
        <SectionHeader eyebrow="Principles" title="Six commitments that shape every screen." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map(([t, d], i) => (
            <div key={t} className="rounded-[8px] border border-border bg-surface p-5">
              <div className="mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</div>
              <div className="mt-1 text-[14.5px] font-semibold">{t}</div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="Built on Vultr"
          title="Made for Agent Rush: Blast Radius Zero."
          lead="Decoyr was built for the Vultr hackathon on containing AI agents. Vultr is its control plane, its inference provider and its execution substrate."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Card icon={<Server className="size-4" />} title="Vultr Cloud Compute">One VM runs the control plane, database, sandbox services and web console, and hosts the per-run candidate containers.</Card>
          <Card icon={<Cpu className="size-4" />} title="Vultr Serverless Inference">Candidate agents think through a trial-scoped relay; the key never enters a sandbox. The same provider writes optional authority rationale.</Card>
          <Card icon={<Cloud className="size-4" />} title="Open and inspectable">MIT licensed, with documented service contracts and shared schemas, so the evidence chain can be audited end to end.</Card>
        </div>
      </Section>

      <CtaBand title="Give your agent a fake company first." lead="Then decide what it gets in yours." secondary={{ href: "/use-cases", label: "Use cases" }} />
    </>
  );
}
