"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, Box, CheckCircle2, Circle, FileText, Loader2, ShieldAlert, Timer, Wrench, Ban, Radio, WifiOff, Repeat } from "lucide-react";
import { useArtifacts, useEvents, useTrial } from "@/lib/api/hooks";
import { useTrialStream, type StreamState } from "@/lib/sse/useTrialStream";
import { TraceList } from "./TraceList";
import { EventInspector } from "./EventInspector";
import { AssertionList } from "@/components/trial/AssertionList";
import { ArtifactViewer } from "@/components/trial/ArtifactViewer";
import { SectionLabel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Empty, ErrorState, PageSkeleton } from "@/components/ui/States";
import { PhaseAction } from "@/components/trial/PhaseAction";
import { CheckBadge } from "@/components/trial/TrialStatusBadge";
import { TRACE_FILTERS, duration, isUnsafe, matchesFilter, type TraceFilter } from "@/lib/formatting";
import { useMediaQuery, useNow } from "@/lib/hooks/useMediaQuery";
import { buttonClass } from "@/components/ui/Button";
import type { Artifact, RunSummary, TraceEvent } from "@/lib/schemas";
import { cn } from "@/components/ui/cn";

const LIVE_RUN = new Set(["queued", "preparing", "running"]);

export function LiveRun() {
  const { trialId, runId: runParam } = useParams<{ trialId: string; runId: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const { data: trial } = useTrial(trialId);
  const runId = runParam === "latest" ? (trial?.activeRunId ?? trial?.runs[trial.runs.length - 1]?.id ?? null) : runParam;

  useEffect(() => {
    if (runParam === "latest" && runId) router.replace(`/app/trials/${trialId}/run/${runId}`);
  }, [runParam, runId, router, trialId]);

  const run = trial?.runs.find((r) => r.id === runId) ?? null;
  const live = !!run && LIVE_RUN.has(run.status);
  const history = useEvents(trialId, runId, { enabled: !!runId });
  const { events, state } = useTrialStream(trialId, runId, { live, initial: history.data });
  const artifacts = useArtifacts(trialId, runId);

  const [filter, setFilter] = useState<TraceFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(search.get("event"));
  const [artifactOpen, setArtifactOpen] = useState<Artifact | null>(null);
  const xl = useMediaQuery("(min-width: 1280px)", true);

  useEffect(() => {
    const e = search.get("event");
    if (e) setSelectedId(e);
  }, [search]);

  const filtered = useMemo(() => events.filter((e) => matchesFilter(e, filter)), [events, filter]);
  const selected = events.find((e) => e.id === selectedId) ?? null;
  const unsafe = events.some(isUnsafe);
  const last = events[events.length - 1];
  const pendingModel = live && last?.type === "model.request";

  if (!trial) return <div className="p-6"><PageSkeleton /></div>;
  if (!runId) {
    return (
      <div className="p-6">
        <Empty title="No run yet" action={<PhaseAction trial={trial} />}>
          The live trace appears here once the baseline starts. Review the World first, then Start Trial.
        </Empty>
      </div>
    );
  }
  if (!run) {
    return <div className="p-6"><Empty title="Run not found">This run does not belong to this trial.</Empty></div>;
  }

  const inspector = <EventInspector event={selected} all={events} onSelect={(e) => setSelectedId(e.id)} onClose={xl ? undefined : () => setSelectedId(null)} />;

  return (
    <div className="flex h-[calc(100vh-88px)] min-h-[560px] flex-col">
      {/* sticky local header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2 md:px-6">
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <span className="font-semibold">{run.type === "replay" ? "Guarded replay" : "Baseline run"}</span>
          <RunStatusPill run={run} />
          <Elapsed run={run} />
          <StreamPill state={live ? state : "ended"} />
          {run.type === "replay" && run.guardId && <Badge tone="blocked">Guard applied</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {run.type === "replay" && (
            <Link href={`/app/trials/${trialId}/replay`} className={buttonClass("secondary", "sm")}>
              <Repeat className="size-3.5" aria-hidden /> Replay comparison
            </Link>
          )}
        </div>
      </div>
      {unsafe && run.type === "baseline" && (
        <div role="status" className="flex items-center gap-2 border-b border-danger/30 bg-danger-bg px-4 py-1.5 text-[12.5px] text-danger md:px-6">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          Unsafe path observed - trial continues inside the synthetic environment.
          {!live && trial.findingCount > 0 && (
            <Link href={`/app/trials/${trialId}/findings`} className="ml-auto font-medium underline-offset-2 hover:underline">View findings</Link>
          )}
        </div>
      )}
      <RunOutcomeBanner run={run} lastEvent={last} onSelect={(e) => setSelectedId(e.id)} />

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[264px_minmax(0,1fr)_380px]">
        {/* LEFT */}
        <aside className="hidden min-h-0 overflow-y-auto border-r border-border bg-surface p-4 md:block scroll-thin" aria-label="Goal and run state">
          <SectionLabel className="mb-1.5">Legitimate goal</SectionLabel>
          <p className="mb-3 text-[13px] font-medium">{trial.legitimateGoal}</p>
          <SectionLabel className="mb-1.5">Task status</SectionLabel>
          <AssertionList defs={trial.successAssertions} results={run.assertions} compact />
          <SectionLabel className="mb-1.5 mt-4">Security status</SectionLabel>
          <AssertionList defs={trial.securityAssertions} results={run.assertions} compact />

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat icon={Wrench} label="Tool calls" value={String(countTools(events) || run.toolCalls)} />
            <Stat icon={Ban} label="Denied" value={String(countDenied(events) || run.deniedCalls)} tone={countDenied(events) || run.deniedCalls ? "blocked" : undefined} />
            <Stat icon={Radio} label="Model calls" value={String(events.filter((e) => e.type === "model.request").length || run.modelCalls)} />
            <Stat icon={Timer} label="Limit" value={`${run.sandbox.limits.wallSeconds}s`} />
          </div>

          <SectionLabel className="mb-1.5 mt-4">Sandbox</SectionLabel>
          <SandboxState run={run} events={events} />

          <SectionLabel className="mb-1.5 mt-4">Artifacts</SectionLabel>
          {(artifacts.data ?? []).length === 0 ? (
            <p className="text-[12.5px] text-muted">{live ? "No artifact written yet." : "No artifact was written in this run."}</p>
          ) : (
            <ul className="space-y-1">
              {artifacts.data!.map((a) => (
                <li key={a.id}>
                  <button onClick={() => setArtifactOpen(a)} className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[12.5px] hover:bg-surface-2">
                    <FileText className="size-3.5 text-success" aria-hidden />
                    <span className="mono truncate">{a.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* CENTER */}
        <section className="flex min-h-0 flex-col bg-surface" aria-label="Trace">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-3 py-1.5 scroll-thin" role="toolbar" aria-label="Trace filters">
            {TRACE_FILTERS.map((f) => {
              const n = f.id === "all" ? events.length : events.filter((e) => matchesFilter(e, f.id)).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={cn("rounded-[4px] px-2 py-1 text-[12px] whitespace-nowrap", filter === f.id ? "bg-text text-white" : "text-muted hover:bg-surface-2 hover:text-text")}
                >
                  {f.label} <span className={cn("tabular-nums", filter === f.id ? "text-white/70" : "text-faint")}>{n}</span>
                </button>
              );
            })}
          </div>
          {history.error ? (
            <div className="p-4"><ErrorState error={history.error} onRetry={() => history.refetch()} title="Could not load trace history" /></div>
          ) : events.length === 0 && live ? (
            <PreparingChecklist events={events} run={run} />
          ) : (
            <TraceList events={filtered} selectedId={selectedId} onSelect={(e) => setSelectedId(e.id)} pendingModel={pendingModel && filter === "all"} live={live} />
          )}
          {/* mobile goal summary */}
          <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[12px] md:hidden">
            <CheckBadge label="Task" result={run.taskResult} />
            <CheckBadge label="Security" result={run.securityResult} />
            <span className="text-muted">{countTools(events)} tools</span>
          </div>
        </section>

        {/* RIGHT */}
        {xl && <aside className="min-h-0 overflow-hidden border-l border-border bg-surface" aria-label="Event inspector">{inspector}</aside>}
      </div>

      {!xl && (
        <Dialog.Root open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/15" />
            <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-hidden rounded-t-[8px] border-t border-border bg-surface md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0">
              <Dialog.Title className="sr-only">Event inspector</Dialog.Title>
              <Dialog.Description className="sr-only">Details of the selected trace event</Dialog.Description>
              <div className="h-[75vh] md:h-full">{inspector}</div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      <Dialog.Root open={!!artifactOpen} onOpenChange={(o) => !o && setArtifactOpen(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(760px,94vw)] -translate-x-1/2 -translate-y-1/2 rounded-[8px] border border-border bg-surface p-3">
            <Dialog.Title className="mb-2 text-[14px] font-semibold">Artifact</Dialog.Title>
            <Dialog.Description className="sr-only">Artifact produced by the candidate</Dialog.Description>
            {artifactOpen && <ArtifactViewer artifact={artifactOpen} maxHeight={520} />}
            <div className="mt-2 flex justify-end">
              <Dialog.Close className={buttonClass("secondary", "sm")}>Close</Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="sr-only" aria-live="polite">
        {run.status === "completed" ? `Run completed. Task ${run.taskResult}. Security ${run.securityResult}.` : run.status}
        {unsafe ? " Unsafe path observed." : ""}
      </div>
    </div>
  );
}

function countTools(events: TraceEvent[]) {
  return events.filter((e) => e.type === "tool.request").length;
}
function countDenied(events: TraceEvent[]) {
  return events.filter((e) => e.decision === "denied").length;
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Wrench; label: string; value: string; tone?: "blocked" }) {
  return (
    <div className="rounded-[6px] border border-border px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[11px] text-muted">
        <Icon className="size-3" aria-hidden /> {label}
      </div>
      <div className={cn("text-[15px] font-semibold tabular-nums", tone === "blocked" && "text-blocked")}>{value}</div>
    </div>
  );
}

function RunStatusPill({ run }: { run: RunSummary }) {
  const map: Record<string, { label: string; tone: "info" | "success" | "danger" | "warning" | "neutral" }> = {
    queued: { label: "QUEUED", tone: "neutral" },
    preparing: { label: "PREPARING", tone: "info" },
    running: { label: "RUNNING", tone: "info" },
    completed: { label: "COMPLETED", tone: "neutral" },
    failed: { label: "FAILED", tone: "danger" },
    timeout: { label: "TIMEOUT", tone: "warning" },
    killed: { label: "KILLED", tone: "warning" },
  };
  const m = map[run.status] ?? { label: run.status, tone: "neutral" as const };
  return <Badge tone={m.tone} dot>{m.label}</Badge>;
}

function Elapsed({ run }: { run: RunSummary }) {
  const live = LIVE_RUN.has(run.status);
  const now = useNow(live);
  const ms = run.durationMs ?? (run.startedAt ? (live ? now : Date.now()) - new Date(run.startedAt).getTime() : null);
  return (
    <span className="mono flex items-center gap-1 text-[12.5px] tabular-nums text-muted">
      <Timer className="size-3.5" aria-hidden /> {duration(ms != null ? Math.max(0, ms) : null)}
    </span>
  );
}

function StreamPill({ state }: { state: StreamState }) {
  if (state === "live") return <span className="flex items-center gap-1 text-[12px] text-success"><span className="size-1.5 animate-pulse rounded-full bg-success" /> Live</span>;
  if (state === "reconnecting" || state === "connecting")
    return (
      <span className="flex items-center gap-1 text-[12px] text-warning">
        <WifiOff className="size-3.5" aria-hidden /> {state === "connecting" ? "Connecting" : "Reconnecting — events kept, run continues"}
      </span>
    );
  if (state === "ended") return <span className="text-[12px] text-muted">Ended</span>;
  return null;
}

function SandboxState({ run, events }: { run: RunSummary; events: TraceEvent[] }) {
  const s = run.sandbox;
  return (
    <div className="space-y-1.5 text-[12.5px]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-muted"><Box className="size-3.5" aria-hidden /> Mode</span>
        <span className="mono">{s.mode}</span>
      </div>
      {s.container && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">Container</span>
          <span className="mono truncate" title={s.container}>{s.container}</span>
        </div>
      )}
      {s.network && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">Network</span>
          <span className="mono truncate" title={s.network}>{s.network}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-muted">Limits</span>
        <span className="mono">{s.limits.memoryMb}MB · {s.limits.cpu}cpu · {s.limits.pids}pids</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted">State</span>
        <span>
          {s.destroyed ? <Badge tone="neutral">destroyed</Badge> : LIVE_RUN.has(run.status) ? <Badge tone="info" dot>running</Badge> : events.some((e) => e.type === "sandbox.destroyed") ? <Badge>destroyed</Badge> : <Badge>stopped</Badge>}
        </span>
      </div>
      {s.hardening.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-[11.5px] text-muted">
          {s.hardening.map((h) => (
            <li key={h} className="flex items-center gap-1"><CheckCircle2 className="size-3 text-success" aria-hidden /> {h}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PreparingChecklist({ events, run }: { events: TraceEvent[]; run: RunSummary }) {
  const has = (t: string) => events.some((e) => e.type === t);
  const steps = [
    { label: "World rendered from persisted scenario bytes", done: run.status !== "queued" },
    { label: "Per-run isolated network", done: has("sandbox.network.created") || run.status === "running" },
    { label: "Synthetic services attached (MCP city, egress proxy)", done: has("sandbox.container.created") || run.status === "running" },
    { label: "Candidate container started", done: has("run.started") || run.status === "running" },
  ];
  return (
    <div className="p-6" aria-busy="true">
      <SectionLabel className="mb-2">Preparing sandbox</SectionLabel>
      <ul className="space-y-2">
        {steps.map((s, i) => {
          const active = !s.done && steps.slice(0, i).every((x) => x.done);
          return (
            <li key={s.label} className="flex items-center gap-2 text-[13px]">
              {s.done ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : active ? <Loader2 className="size-4 animate-spin text-info" aria-hidden /> : <Circle className="size-4 text-faint" aria-hidden />}
              <span className={s.done ? "" : "text-muted"}>{s.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RunOutcomeBanner({ run, lastEvent, onSelect }: { run: RunSummary; lastEvent?: TraceEvent; onSelect: (e: TraceEvent) => void }) {
  if (run.status === "timeout")
    return (
      <div role="status" className="flex items-center gap-2 border-b border-warning/30 bg-warning-bg px-4 py-1.5 text-[12.5px] text-warning md:px-6">
        <Timer className="size-3.5" aria-hidden /> The run hit its {run.sandbox.limits.wallSeconds}s wall-clock limit and the sandbox was stopped. Evidence up to the limit is preserved.
        {lastEvent && <button onClick={() => onSelect(lastEvent)} className="ml-auto font-medium underline-offset-2 hover:underline">Last event</button>}
      </div>
    );
  if (run.status === "killed" || run.status === "failed")
    return (
      <div role="status" className="flex items-center gap-2 border-b border-danger/30 bg-danger-bg px-4 py-1.5 text-[12.5px] text-danger md:px-6">
        <ShieldAlert className="size-3.5" aria-hidden />
        {run.status === "killed" ? "The sandbox was killed (containment event). The control plane remains healthy and usable." : `The run failed: ${run.error ?? "sandbox error"}. The control plane remains usable; evidence is preserved.`}
        {lastEvent && <button onClick={() => onSelect(lastEvent)} className="ml-auto font-medium underline-offset-2 hover:underline">Last event</button>}
      </div>
    );
  return null;
}
