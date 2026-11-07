"use client";
import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, CornerDownRight, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useEvents, useReplay, useTrial } from "@/lib/api/hooks";
import { useTrialStream } from "@/lib/sse/useTrialStream";
import { useTrialId } from "@/components/trial/TrialFrame";
import { Panel, SectionLabel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Empty, ErrorState, PageSkeleton } from "@/components/ui/States";
import { DiffRow } from "@/components/replay/DiffRow";
import { EvidenceEvent } from "@/components/trace/EvidenceEvent";
import { ArtifactViewer } from "@/components/trial/ArtifactViewer";
import { PhaseAction } from "@/components/trial/PhaseAction";
import { alignTimelines, isSignificant } from "@/components/replay/align";
import { shortHash } from "@/lib/formatting";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import type { TraceEvent } from "@/lib/schemas";

export default function ReplayPage() {
  const id = useTrialId();
  const { data: trial } = useTrial(id);
  const active = trial?.status === "replaying";
  const { data: cmp, error, isLoading, refetch } = useReplay(id, active);
  const liveRunId = active ? trial?.activeRunId ?? cmp?.replayRunId ?? null : null;
  const liveHistory = useEvents(id, liveRunId, { enabled: !!liveRunId });
  const { events: liveEvents } = useTrialStream(id, liveRunId, { live: !!liveRunId, initial: liveHistory.data });

  const baselineTl = cmp?.timeline.baseline ?? [];
  const replayTl = useMemo(() => (active && liveRunId ? liveEvents.filter(isSignificant) : cmp?.timeline.replay ?? []), [active, liveRunId, liveEvents, cmp]);
  const rows = useMemo(() => alignTimelines(baselineTl.filter(isSignificant), replayTl.filter(isSignificant)), [baselineTl, replayTl]);

  if (error) return <div className="p-6"><ErrorState error={error} onRetry={() => refetch()} title="Could not load replay comparison" /></div>;
  if (isLoading || !trial || !cmp) return <div className="p-6"><PageSkeleton /></div>;

  if (cmp.status === "not_started" && !active) {
    return (
      <div className="p-6">
        <Empty title={trial.guardId ? "Guard ready — replay not run yet" : "Replay needs a Guard"} action={<PhaseAction trial={trial} />}>
          {trial.guardId
            ? "Replay reconstructs the identical World from the persisted scenario bytes and seed, applies the Guard, and runs the same agent on the same task with the same attack."
            : "Run the baseline and derive the Minimum Viable Authority first. Replay proves the Guard preserves useful work while blocking the attack."}
        </Empty>
      </div>
    );
  }

  const same = cmp.same;
  const verdict = active ? "pending" : cmp.verdict;

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Identity header */}
      <div className="rounded-[8px] border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-4 py-3 text-[15px] font-semibold tracking-[-0.01em]" data-testid="replay-header">
          {["Same agent", "Same world", "Same task", "Same attack"].map((s) => (
            <span key={s} className="flex items-center gap-2">
              <span>{s}</span>
              <span className="text-faint">/</span>
            </span>
          ))}
          <span className="text-blocked">New authority</span>
        </div>
        <div className="grid gap-x-6 gap-y-1 px-4 py-2.5 text-[12px] text-muted sm:grid-cols-2 lg:grid-cols-4">
          <span>agent <span className="text-text">{same.agent}</span></span>
          <span>world <span className="mono text-text">{same.world}</span> · seed <span className="mono text-text">{same.seed}</span></span>
          <span>task <span className="text-text">{same.task}</span></span>
          <span>attack <span className="mono text-text">{same.attack}</span></span>
          <span className="sm:col-span-2" title={same.scenarioSha256}>
            scenario sha256 <span className="mono text-text">{shortHash(same.scenarioSha256, 20)}</span>{" "}
            {same.identical ? <Badge tone="success">byte-identical</Badge> : <Badge tone="danger">differs</Badge>}
          </span>
          {cmp.guardSha256 && (
            <span className="sm:col-span-2">
              guard <Link href={`/app/trials/${id}/guard`} className="mono text-text hover:underline">{shortHash(cmp.guardSha256, 16)}</Link>
            </span>
          )}
        </div>
      </div>

      {/* Verdict */}
      {verdict === "pending" ? (
        <div role="status" className="flex items-center gap-2 rounded-[8px] border border-info/30 bg-info-bg px-4 py-3 text-[13px] text-info">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Guarded replay running — the replay timeline fills in live below.
          {liveRunId && <Link href={`/app/trials/${id}/run/${liveRunId}`} className="ml-auto font-medium hover:underline">Open live trace</Link>}
        </div>
      ) : verdict === "contained" ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-[8px] border border-success/30 bg-success-bg px-4 py-3" data-testid="replay-verdict">
          <ShieldCheck className="size-5 text-success" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-success">Contained for this tested scope.</div>
            <div className="text-[13px]">Legitimate task passed and all tested security assertions passed. {cmp.verdictText !== "Contained for this tested scope" ? cmp.verdictText : ""}</div>
          </div>
          <Link href={`/app/trials/${id}/passport#limitations`} className="text-[12.5px] font-medium text-success underline-offset-2 hover:underline">Limitations</Link>
          <PhaseAction trial={trial} />
        </div>
      ) : (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[8px] border border-danger/30 bg-danger-bg px-4 py-3" data-testid="replay-verdict">
          <AlertTriangle className="size-5 text-danger" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-danger">{verdict === "guard_failed" ? "Guard failed this scenario." : "Guard broke the legitimate task."}</div>
            <div className="text-[13px]">{cmp.verdictText} Evidence from both runs is preserved.</div>
          </div>
          <Link href={`/app/trials/${id}/authority`} className={buttonClass("secondary", "sm")}>Review authority</Link>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel title="Baseline vs Guarded replay" bodyClassName="p-0">
          <table className="w-full">
            <thead className="border-b border-border text-[11.5px] uppercase tracking-[0.05em] text-faint">
              <tr>
                <th className="px-4 py-2 text-right font-semibold">Baseline</th>
                <th className="px-4 py-2 text-center font-semibold">Metric</th>
                <th className="px-4 py-2 text-left font-semibold">Guarded Replay</th>
              </tr>
            </thead>
            <tbody>
              {cmp.rows.length ? cmp.rows.map((r) => <DiffRow key={r.metric} row={r} />) : (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-[13px] text-muted">Comparison appears when the replay finishes.</td></tr>
              )}
            </tbody>
          </table>
          {!active && cmp.status === "complete" && (
            <div className="space-y-1 border-t border-border px-4 py-3 text-[12.5px]">
              <div className="flex items-center gap-1.5">
                {cmp.recoveredAfterDenial ? <CheckCircle2 className="size-3.5 text-success" aria-hidden /> : <XCircle className="size-3.5 text-muted" aria-hidden />}
                {cmp.recoveredAfterDenial ? "Candidate recovered after the Guard denial and continued legitimate work." : "Candidate did not continue after denial."}
              </div>
              {cmp.divergence.description && (
                <div className="flex items-start gap-1.5 text-muted">
                  <CornerDownRight className="mt-0.5 size-3.5" aria-hidden /> Divergence: {cmp.divergence.description}
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Synchronized timelines" subtitle="Identical actions are muted; the divergence is emphasized." bodyClassName="p-0">
          <div className="grid grid-cols-2 border-b border-border text-[11.5px] font-semibold uppercase tracking-[0.05em] text-faint">
            <div className="px-3 py-1.5">Baseline</div>
            <div className="border-l border-border px-3 py-1.5">Guarded replay</div>
          </div>
          <div className="max-h-[440px] overflow-y-auto scroll-thin">
            {rows.length === 0 ? (
              <p className="p-4 text-[13px] text-muted">Waiting for replay events…</p>
            ) : (
              rows.map((r, i) => {
                const isDiv = (r.baseline && r.baseline.seq === cmp.divergence.baselineSeq) || (r.replay && r.replay.seq === cmp.divergence.replaySeq);
                return (
                  <div key={i} className={cn("grid grid-cols-2 border-b border-border/70 last:border-0", isDiv && "bg-warning-bg/40")}>
                    <Side e={r.baseline} muted={r.identical} emphasized={!r.identical && !!isDiv} trialId={id} />
                    <div className="border-l border-border">
                      <Side e={r.replay} muted={r.identical} emphasized={!r.identical && !!isDiv} trialId={id} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Artifact proof" subtitle="release-notes.md must still exist after Guard — and still contain the expected v2.4.0 changes.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <SectionLabel className="mb-1.5">Baseline</SectionLabel>
            {cmp.artifacts.baseline ? <ArtifactViewer artifact={cmp.artifacts.baseline} maxHeight={300} /> : <p className="text-[13px] text-muted">No artifact in baseline.</p>}
          </div>
          <div>
            <SectionLabel className="mb-1.5">Guarded replay</SectionLabel>
            {cmp.artifacts.replay ? (
              <ArtifactViewer artifact={cmp.artifacts.replay} maxHeight={300} />
            ) : active ? (
              <p className="flex items-center gap-1.5 text-[13px] text-muted"><Loader2 className="size-3.5 animate-spin" /> Waiting for the replay to write release-notes.md…</p>
            ) : (
              <p className="text-[13px] text-danger">No artifact was produced in the replay — the Guard broke the legitimate task.</p>
            )}
          </div>
        </div>
        {cmp.artifacts.expectedCommits.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="border-b border-border text-[11.5px] uppercase tracking-[0.05em] text-faint">
                <tr>
                  <th className="py-1.5 pr-3 font-semibold">Expected v2.4.0 change</th>
                  <th className="py-1.5 pr-3 font-semibold">Ref</th>
                  <th className="py-1.5 pr-3 text-center font-semibold">Baseline</th>
                  <th className="py-1.5 text-center font-semibold">Replay</th>
                </tr>
              </thead>
              <tbody>
                {cmp.artifacts.expectedCommits.map((c) => (
                  <tr key={c.ref} className="border-b border-border last:border-0">
                    <td className="py-1.5 pr-3">{c.subject}</td>
                    <td className="mono py-1.5 pr-3 text-[12px] text-muted">{c.ref}</td>
                    <td className="py-1.5 pr-3 text-center">{c.inBaseline ? <CheckCircle2 className="mx-auto size-4 text-success" aria-label="present" /> : <XCircle className="mx-auto size-4 text-faint" aria-label="missing" />}</td>
                    <td className="py-1.5 text-center">{c.inReplay ? <CheckCircle2 className="mx-auto size-4 text-success" aria-label="present" /> : <XCircle className="mx-auto size-4 text-danger" aria-label="missing" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Side({ e, muted, emphasized, trialId }: { e: TraceEvent | null; muted: boolean; emphasized: boolean; trialId: string }) {
  if (!e) return <div className="h-full min-h-[38px] bg-surface-2/40" aria-hidden />;
  return (
    <Link href={`/app/trials/${trialId}/run/${e.runId}?event=${e.id}`} className="block">
      <EvidenceEvent event={e} muted={muted} emphasized={emphasized} compact />
    </Link>
  );
}
