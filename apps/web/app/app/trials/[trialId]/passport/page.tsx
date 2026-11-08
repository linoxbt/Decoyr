"use client";
import Link from "next/link";
import { Download, Printer, CircleAlert } from "lucide-react";
import { usePassport, useTrial } from "@/lib/api/hooks";
import { useTrialId } from "@/components/trial/TrialFrame";
import { Panel, KV, SectionLabel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { downloadJson } from "@/components/ui/CopyButton";
import { Empty, ErrorState, PageSkeleton } from "@/components/ui/States";
import { AssertionList } from "@/components/trial/AssertionList";
import { CapabilityChip } from "@/components/authority/CapabilityChip";
import { JsonBlock } from "@/components/ui/JsonBlock";
import { PhaseAction } from "@/components/trial/PhaseAction";
import { PassportProof } from "@/components/trial/PassportProof";
import { CHECK_META } from "@/lib/status";
import { dateTime, shortHash } from "@/lib/formatting";
import type { CheckResult } from "@/lib/schemas";

const PHASE_LABEL: Record<string, string> = { baseline: "Baseline run", calibration: "Minimum Viable Authority + Guard", replay: "Guarded replay" };

function Check({ r }: { r: CheckResult }) {
  return <Badge tone={CHECK_META[r].tone}>{CHECK_META[r].label}</Badge>;
}

export default function PassportPage() {
  const id = useTrialId();
  const { data: trial } = useTrial(id);
  const { data: p, error, isLoading, refetch } = usePassport(id);

  if (error) return <div className="p-6"><ErrorState error={error} onRetry={() => refetch()} title="Could not load Passport" /></div>;
  if (isLoading || !p || !trial) return <div className="p-6"><PageSkeleton /></div>;

  if (p.status === "incomplete") {
    return (
      <div className="p-6">
        <Empty title="Passport not available yet" action={<PhaseAction trial={trial} />}>
          A Passport records only what was demonstrated. Missing phases:
          <ul className="mt-2 space-y-0.5 text-left">
            {p.missingPhases.map((m) => (
              <li key={m} className="flex items-center gap-1.5"><CircleAlert className="size-3.5 text-warning" aria-hidden /> {PHASE_LABEL[m] ?? m}</li>
            ))}
          </ul>
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="rounded-[8px] border border-border bg-surface print-block">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <SectionLabel>Decoyr Passport</SectionLabel>
            <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.01em]">
              {p.identity.agent} <span className="mono text-[15px] font-normal text-muted">{p.identity.version}</span>
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">{p.identity.purpose}</p>
            <div className="mt-2">
              <Badge tone={p.status === "calibrated" ? "success" : "danger"} className="text-[12.5px]" title="Scoped label — empirical, scope- and version-bound. Not a universal safety rating.">
                {p.label}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2 no-print">
            <Button onClick={() => downloadJson(`decoyr-passport-${p.trialId}.json`, p)}>
              <Download className="size-3.5" aria-hidden /> Export JSON
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="size-3.5" aria-hidden /> Print
            </Button>
          </div>
        </div>
        <dl className="grid gap-x-8 px-5 py-3 md:grid-cols-2">
          <KV k="Trial" mono>{p.identity.trialId}</KV>
          <KV k="Trial time">{dateTime(p.identity.trialTime)}</KV>
          <KV k="Model" mono>{p.identity.model}</KV>
          <KV k="Generated">{dateTime(p.generatedAt)}</KV>
          <KV k="World / scenario" mono>{p.coverage.worldVersion} · {p.coverage.scenarioId}</KV>
          <KV k="Guard hash" mono>{p.guard ? shortHash(p.guard.sha256, 20) : "—"}</KV>
          <KV k="Artifact hash" mono>{shortHash(p.identity.artifactSha256, 20)}</KV>
          <KV k="Seed" mono>{p.coverage.seed}</KV>
        </dl>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="What was tested">
          <dl>
            <KV k="Scenario packs" mono>{p.coverage.scenarioPack.join(", ")}</KV>
            <KV k="Scenario sha256" mono><span title={p.coverage.scenarioSha256}>{shortHash(p.coverage.scenarioSha256, 20)}</span></KV>
          </dl>
          <SectionLabel className="mb-1 mt-2">Tools exercised</SectionLabel>
          <div className="flex flex-wrap gap-1">{p.coverage.toolsTested.map((t) => <CapabilityChip key={t} name={t} />)}</div>
        </Panel>
        <Panel title="What the agent accomplished">
          <AssertionList defs={p.usefulBehavior.assertions.filter((a) => a.kind === "task")} results={p.usefulBehavior.assertions} />
          {p.usefulBehavior.artifacts.map((a) => (
            <div key={a.id} className="mt-2 text-[12.5px]"><span className="mono">{a.path}</span> <span className="mono text-muted">sha256 {shortHash(a.sha256, 12)}</span></div>
          ))}
        </Panel>
        <Panel title="What went wrong (baseline)">
          {p.adversarialFindings.length === 0 ? (
            <p className="text-[13px] text-muted">No tested security assertion failed in this run.</p>
          ) : (
            <ul className="space-y-2">
              {p.adversarialFindings.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-2 text-[13px]">
                  <Link href={`/app/trials/${id}/findings#${f.id}`} className="hover:underline">{f.title}</Link>
                  <Badge tone={f.replayOutcome === "blocked" ? "success" : f.replayOutcome === "reproduced" ? "danger" : "neutral"}>
                    {f.replayOutcome === "blocked" ? "blocked in replay" : f.replayOutcome === "reproduced" ? "reproduced" : "not replayed"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <SectionLabel className="mb-1 mt-3">Observed authority</SectionLabel>
          <ul className="space-y-0.5 text-[12.5px]">
            {p.observedAuthority.map((o) => (
              <li key={o.capability} className="flex justify-between gap-2">
                <span className="mono">{o.capability}</span>
                <span className="text-muted">×{o.count} · {o.baselineDecision}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Minimum Viable Authority">
          <ul className="space-y-1">
            {p.minimumViableAuthority.map((m) => (
              <li key={m.capability}><CapabilityChip name={m.capability} classification={m.constraint ? "constrained" : "required"} constraint={m.constraint} /></li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-muted">Everything else is denied by the Guard.</p>
        </Panel>
        <Panel title="Replay proof" className="md:col-span-2">
          {p.replayProof ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-[13px]">
                <thead className="border-b border-border text-[11.5px] uppercase tracking-[0.05em] text-faint">
                  <tr><th className="py-1.5 text-left font-semibold">Run</th><th className="py-1.5 text-left font-semibold">ID</th><th className="py-1.5 font-semibold">Task</th><th className="py-1.5 font-semibold">Security</th></tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border"><td className="py-1.5">Baseline</td><td className="mono py-1.5 text-[12px] text-muted">{p.replayProof.baselineRunId}</td><td className="text-center"><Check r={p.replayProof.baseline.task} /></td><td className="text-center"><Check r={p.replayProof.baseline.security} /></td></tr>
                  <tr><td className="py-1.5">Guarded replay</td><td className="mono py-1.5 text-[12px] text-muted">{p.replayProof.replayRunId}</td><td className="text-center"><Check r={p.replayProof.replay.task} /></td><td className="text-center"><Check r={p.replayProof.replay.security} /></td></tr>
                </tbody>
              </table>
              <p className="mt-2 text-[12px] text-muted">{p.replayProof.sameSeed ? "Same seed and byte-identical scenario content in both runs." : "Warning: replay seed differs from baseline."}</p>
            </div>
          ) : (
            <p className="text-[13px] text-muted">No replay recorded.</p>
          )}
        </Panel>
        <Panel title="Evidence">
          <dl>
            <KV k="Total events">{p.evidence.eventCount}</KV>
            <KV k="Baseline events">{p.evidence.baselineEvents}</KV>
            <KV k="Replay events">{p.evidence.replayEvents}</KV>
            <KV k="Key events">{p.evidence.keyEventIds.length}</KV>
          </dl>
        </Panel>
        <PassportProof p={p} />
        <Panel title="Limitations" id="limitations">
          <ul className="list-disc space-y-1 pl-4 text-[13px]">
            {p.limitations.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </Panel>
      </div>

      {p.guard && (
        <Panel title="Guard policy" subtitle={<span className="mono">{p.guard.id} · {shortHash(p.guard.sha256, 20)}</span>}>
          <JsonBlock value={p.guard.policy} maxHeight={320} />
        </Panel>
      )}
      <p className="text-center text-[11.5px] text-faint">This Passport is empirical evidence for the tested scope, world version and agent version only. It is not a universal safety rating.</p>
    </div>
  );
}
