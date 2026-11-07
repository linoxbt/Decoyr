"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTrial } from "@/lib/api/hooks";
import { useTrialId } from "@/components/trial/TrialFrame";
import { Panel, KV, SectionLabel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { ConclusionBadge, CheckBadge } from "@/components/trial/TrialStatusBadge";
import { AssertionList } from "@/components/trial/AssertionList";
import { CapabilityChip } from "@/components/authority/CapabilityChip";
import { PhaseAction } from "@/components/trial/PhaseAction";
import { PageSkeleton } from "@/components/ui/States";
import { dateTime, duration, shortHash } from "@/lib/formatting";

export default function TrialOverview() {
  const id = useTrialId();
  const { data: t } = useTrial(id);
  if (!t) return <div className="p-6"><PageSkeleton /></div>;
  const baseline = t.runs.find((r) => r.id === t.baselineRunId);
  const replay = t.runs.find((r) => r.id === t.replayRunId);
  const latest = replay ?? baseline;
  const base = `/app/trials/${t.id}`;

  return (
    <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-3">
      <Panel className="lg:col-span-3" bodyClassName="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <SectionLabel>Conclusion</SectionLabel>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <ConclusionBadge conclusion={t.conclusion} />
            {latest && (
              <>
                <CheckBadge label="Task" result={latest.taskResult} />
                <CheckBadge label="Security" result={latest.securityResult} />
              </>
            )}
          </div>
          <p className="mt-2 text-[14px]">
            <span className="text-muted">Next: </span>
            {t.nextAction}
          </p>
        </div>
        <PhaseAction trial={t} size="lg" />
      </Panel>

      <Panel title="Candidate">
        <dl>
          <KV k="Agent">{t.agent.name} <span className="mono text-muted">{t.agent.version}</span></KV>
          <KV k="Purpose">{t.agent.purpose}</KV>
          <KV k="Model" mono>{t.agent.model || t.inference.model}</KV>
          <KV k="Inference">
            <Badge tone={t.inference.mode === "vultr" ? "success" : "warning"}>{t.inference.mode === "vultr" ? t.inference.provider : "Simulated (no Vultr key)"}</Badge>
          </KV>
        </dl>
        <SectionLabel className="mb-1.5 mt-3">Requested authority · {t.agent.requestedCapabilities.length}</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {t.agent.requestedCapabilities.map((c) => <CapabilityChip key={c} name={c} />)}
        </div>
        <p className="mt-2 text-[12px] text-muted">The agent&apos;s hypothesis — not trusted until observed.</p>
      </Panel>

      <Panel title="World" actions={<Link href={`${base}/world`} className="text-[12px] text-info hover:underline">Open World</Link>}>
        <dl>
          <KV k="Company">{t.worldName}</KV>
          <KV k="Version" mono>{t.worldVersion}</KV>
          <KV k="Seed" mono>{t.seed}</KV>
          <KV k="Scenario hash" mono><span title={t.scenarioSha256}>{shortHash(t.scenarioSha256, 16)}</span></KV>
        </dl>
        <p className="mt-2 text-[12px] text-muted">Everything in this world is synthetic and disposable. The scenario bytes are persisted before the baseline and reused byte-for-byte in replay.</p>
      </Panel>

      <Panel title="Run history">
        {t.runs.length === 0 ? (
          <p className="text-[13px] text-muted">No runs yet. Start the baseline to observe the agent with its requested authority.</p>
        ) : (
          <ul className="divide-y divide-border">
            {t.runs.map((r) => (
              <li key={r.id} className="py-2">
                <Link href={r.type === "replay" ? `${base}/replay` : `${base}/run/${r.id}`} className="group flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-medium capitalize">{r.type === "replay" ? "Guarded replay" : "Baseline"} <span className="mono text-[11.5px] font-normal text-faint">{r.id.slice(-8)}</span></div>
                    <div className="text-[12px] text-muted">{r.status} · {duration(r.durationMs)} · {r.toolCalls} tool calls{r.deniedCalls ? ` · ${r.deniedCalls} denied` : ""}</div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <CheckBadge label="Task" result={r.taskResult} />
                    <CheckBadge label="Security" result={r.securityResult} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Legitimate goal" className="lg:col-span-1">
        <p className="mb-3 text-[14px] font-medium">{t.legitimateGoal}</p>
        <SectionLabel className="mb-1.5">Success assertions</SectionLabel>
        <AssertionList defs={t.successAssertions} results={latest?.assertions} />
      </Panel>

      <Panel title="Attack pack" className="lg:col-span-1">
        <div className="mb-3 flex flex-wrap gap-1">
          {t.scenarioPack.map((p) => <Badge key={p} tone="warning"><span className="mono">{p}</span></Badge>)}
        </div>
        <SectionLabel className="mb-1.5">Security assertions</SectionLabel>
        <AssertionList defs={t.securityAssertions} results={latest?.assertions} />
        <p className="mt-3 text-[12px] text-muted">The attack content stays hidden in the World view until a finding exposes it or you choose Inspect scenario.</p>
      </Panel>

      <Panel title="Calibration path" className="lg:col-span-1">
        <ol className="space-y-1.5 text-[13px]">
          {[
            { label: "Baseline run", done: !!baseline && baseline.status !== "running" && baseline.status !== "preparing", href: baseline ? `${base}/run/${baseline.id}` : undefined },
            { label: "Findings", done: t.findingCount > 0 || t.status === "observed", href: `${base}/findings` },
            { label: "Minimum Viable Authority", done: !!t.guardId, href: `${base}/authority` },
            { label: "Guard compiled", done: !!t.guardId, href: `${base}/guard` },
            { label: "Guarded replay", done: !!replay && replay.status === "completed", href: `${base}/replay` },
            { label: "Passport", done: t.status === "contained" || t.conclusion === "guard_failed", href: `${base}/passport` },
          ].map((s, i) => (
            <li key={s.label} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className={`flex size-5 items-center justify-center rounded-full border text-[11px] ${s.done ? "border-text bg-text text-white" : "border-border-strong text-faint"}`}>{i + 1}</span>
                <span className={s.done ? "" : "text-muted"}>{s.label}</span>
              </span>
              {s.href && <Link href={s.href} className="text-faint hover:text-text" aria-label={`Open ${s.label}`}><ArrowRight className="size-3.5" /></Link>}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[12px] text-muted">Created {dateTime(t.createdAt)}</p>
      </Panel>
    </div>
  );
}
