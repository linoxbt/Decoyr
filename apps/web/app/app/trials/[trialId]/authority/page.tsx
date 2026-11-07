"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { useAuthority, useCalibrate, useEvents, useTrial } from "@/lib/api/hooks";
import { useTrialId } from "@/components/trial/TrialFrame";
import { AuthorityMatrix, type MatrixCell } from "@/components/authority/AuthorityMatrix";
import { Panel, SectionLabel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Empty, ErrorState, PageSkeleton } from "@/components/ui/States";
import { EvidenceEvent } from "@/components/trace/EvidenceEvent";
import { PhaseAction } from "@/components/trial/PhaseAction";
import { AUTHORITY_META } from "@/lib/status";
import type { AuthorityClass } from "@/lib/schemas";
import { cn } from "@/components/ui/cn";

export default function AuthorityPage() {
  const id = useTrialId();
  const { data: trial } = useTrial(id);
  const { data: report, error, isLoading, refetch } = useAuthority(id);
  const calibrate = useCalibrate(id);
  const events = useEvents(id, trial?.baselineRunId, { enabled: !!trial?.baselineRunId });
  const [sel, setSel] = useState<MatrixCell | null>(null);

  const evidence = useMemo(() => {
    if (!sel || !events.data) return [];
    const ids = new Set(sel.capability.evidenceEventIds);
    return events.data.filter((e) => ids.has(e.id));
  }, [sel, events.data]);

  if (error) return <div className="p-6"><ErrorState error={error} onRetry={() => refetch()} title="Could not load authority report" /></div>;
  if (isLoading || !trial || !report) return <div className="p-6"><PageSkeleton /></div>;

  const baseline = trial.runs.find((r) => r.id === trial.baselineRunId);
  const baselineDone = baseline && baseline.status !== "running" && baseline.status !== "preparing" && baseline.status !== "queued";

  if (report.status === "not_started" || report.capabilities.length === 0) {
    return (
      <div className="p-6">
        <Empty
          title={baselineDone ? "Minimum Viable Authority not derived yet" : "Authority needs a completed baseline"}
          action={
            baselineDone ? (
              <Button variant="primary" loading={calibrate.isPending || trial.status === "calibrating"} onClick={() => calibrate.mutate()}>Derive Minimum Authority</Button>
            ) : (
              <PhaseAction trial={trial} />
            )
          }
        >
          {baselineDone
            ? "Decoyr separates capabilities used for the legitimate task from those used only on the unsafe path, then compiles the narrowest Guard and checks it against the baseline evidence."
            : "Run the baseline first. Authority is derived from what the agent actually did, not what it requested."}
        </Empty>
        {calibrate.error && <ErrorState className="mt-4" error={calibrate.error} title="Calibration failed" onRetry={() => calibrate.mutate()} />}
      </div>
    );
  }

  const s = report.summary;
  const classes: AuthorityClass[] = ["required", "constrained", "unnecessary", "dangerous", "untested"];
  const lastIter = report.iterations[report.iterations.length - 1];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Panel bodyClassName="flex flex-wrap items-center justify-between gap-4">
        <div>
          <SectionLabel>Minimum Viable Authority</SectionLabel>
          <p className="mt-1 text-[18px] font-semibold tracking-[-0.01em]" data-testid="authority-delta">{report.deltaText}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {classes.map((c) => (
              <Badge key={c} tone={AUTHORITY_META[c].tone}>
                {AUTHORITY_META[c].label} {s[c]}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted">
            Classification and pass/fail are deterministic. Rationale text: {report.rationaleSource === "vultr" ? "summarized by Vultr Serverless Inference" : "deterministic templates"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" loading={calibrate.isPending} onClick={() => calibrate.mutate()}>
            <RefreshCw className="size-3.5" aria-hidden /> Recalibrate
          </Button>
          {trial.guardId && <Link href={`/app/trials/${id}/guard`} className={buttonClass("secondary", "md")}>View Guard <ArrowRight className="size-3.5" aria-hidden /></Link>}
          <PhaseAction trial={trial} />
        </div>
      </Panel>

      {report.status === "failed" && (
        <ErrorState
          error={new Error(lastIter?.detail ?? "A denied capability broke the legitimate task.")}
          title="Calibration failure — the candidate Guard would break the legitimate task"
        />
      )}

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Capability matrix" subtitle="Click any cell to inspect the evidence behind it." bodyClassName="p-0">
          <AuthorityMatrix capabilities={report.capabilities} selected={sel} onSelect={setSel} />
        </Panel>
        <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-1">
          <Panel title={sel ? <span className="mono">{sel.capability.name}</span> : "Evidence"} subtitle={sel ? AUTHORITY_META[sel.capability.classification].meaning : undefined}>
            {!sel ? (
              <p className="text-[13px] text-muted">Select a cell in the matrix to see why the capability was classified that way and which trace events prove it.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-[13px]">{sel.capability.rationale}</p>
                {sel.capability.targets.length > 0 && (
                  <div>
                    <SectionLabel className="mb-1">Observed targets</SectionLabel>
                    <ul className="mono space-y-0.5 text-[12px]">
                      {sel.capability.targets.map((t) => <li key={t} className="truncate">{t}</li>)}
                    </ul>
                  </div>
                )}
                {sel.capability.constraint && (
                  <div>
                    <SectionLabel className="mb-1">Constraint</SectionLabel>
                    <code className="mono block rounded-[4px] bg-surface-2 p-2 text-[12px]">{JSON.stringify(sel.capability.constraint)}</code>
                  </div>
                )}
                {sel.capability.findingIds.length > 0 && (
                  <Link href={`/app/trials/${id}/findings#${sel.capability.findingIds[0]}`} className="block text-[12.5px] text-danger hover:underline">
                    Participated in finding → view causal chain
                  </Link>
                )}
                <div>
                  <SectionLabel className="mb-1">Evidence events · {sel.capability.evidenceEventIds.length}</SectionLabel>
                  {evidence.length === 0 ? (
                    <p className="text-[12.5px] text-muted">{sel.capability.classification === "untested" ? "Not exercised by this trial — no evidence, no safety claim." : "No linked events."}</p>
                  ) : (
                    <ul className="-mx-4 divide-y divide-border border-y border-border">
                      {evidence.slice(0, 12).map((e) => (
                        <li key={e.id}>
                          <Link href={`/app/trials/${id}/run/${e.runId}?event=${e.id}`}>
                            <EvidenceEvent event={e} compact />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </Panel>
          <Panel title="Calibration iterations" subtitle="Replay-budgeted checks, not model “thinking”.">
            <ol className="space-y-2">
              {report.iterations.map((it) => (
                <li key={it.n} className="rounded-[6px] border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium">{it.n}. {it.label}</span>
                    {it.status === "pass" ? <CheckCircle2 className="size-4 text-success" aria-label="pass" /> : it.status === "fail" ? <XCircle className="size-4 text-danger" aria-label="fail" /> : <Badge tone="warning">adjusted</Badge>}
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted">{it.detail}</p>
                  <div className="mt-1.5 flex gap-3 text-[12px]">
                    <span className={cn(it.legitAllowed === it.legitTotal ? "text-success" : "text-danger")}>legit allowed {it.legitAllowed}/{it.legitTotal}</span>
                    <span className={cn(it.attackDenied === it.attackTotal ? "text-blocked" : "text-danger")}>attack denied {it.attackDenied}/{it.attackTotal}</span>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
