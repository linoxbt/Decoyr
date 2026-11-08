"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, ShieldCheck, Repeat, IdCard, Radio, Square } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/Button";
import { useCalibrate, useReplayRun, useStartRun, useStopRun } from "@/lib/api/hooks";
import { nextPhase } from "@/lib/status";
import type { Trial } from "@/lib/schemas";
import { ApiError } from "@/lib/api/client";

/** Phase-aware primary action (Start Trial / Derive Minimum Authority / Replay with Guard / View Passport). */
export function PhaseAction({ trial, size = "md", onError }: { trial: Trial; size?: "sm" | "md" | "lg"; onError?: (e: unknown) => void }) {
  const router = useRouter();
  const start = useStartRun(trial.id);
  const calibrate = useCalibrate(trial.id);
  const replay = useReplayRun(trial.id);
  const base = `/app/trials/${trial.id}`;
  const phase = nextPhase(trial.status);
  const err = (e: unknown) => onError?.(e);

  if (phase === "start")
    return (
      <Button variant="primary" size={size} loading={start.isPending} onClick={() => start.mutate(undefined, { onSuccess: (r) => router.push(`${base}/run/${r.id}`), onError: err })}>
        <Play className="size-3.5" aria-hidden /> Start Trial
      </Button>
    );
  if (phase === "watch") {
    const runId = trial.activeRunId ?? trial.runs[trial.runs.length - 1]?.id;
    if (trial.status === "calibrating") return <Button size={size} variant="secondary" loading disabled>Calibrating</Button>;
    return (
      <Link href={trial.status === "replaying" ? `${base}/replay` : runId ? `${base}/run/${runId}` : base} className={buttonClass("primary", size)}>
        <Radio className="size-3.5" aria-hidden /> {trial.status === "replaying" ? "Watch replay" : "Watch live trial"}
      </Link>
    );
  }
  if (phase === "calibrate")
    return (
      <Button variant="primary" size={size} loading={calibrate.isPending} onClick={() => calibrate.mutate(undefined, { onSuccess: () => router.push(`${base}/authority`), onError: err })}>
        <ShieldCheck className="size-3.5" aria-hidden /> Derive Minimum Authority
      </Button>
    );
  if (phase === "replay")
    return (
      <Button variant="primary" size={size} loading={replay.isPending} onClick={() => replay.mutate(undefined, { onSuccess: () => router.push(`${base}/replay`), onError: err })}>
        <Repeat className="size-3.5" aria-hidden /> Replay with Guard
      </Button>
    );
  if (phase === "passport")
    return (
      <Link href={`${base}/passport`} className={buttonClass("primary", size)}>
        <IdCard className="size-3.5" aria-hidden /> View Passport
      </Link>
    );
  return null;
}

export function StopButton({ trial }: { trial: Trial }) {
  const stop = useStopRun(trial.id);
  if (!trial.activeRunId) return null;
  return (
    <Button size="sm" variant="danger" loading={stop.isPending} onClick={() => stop.mutate()}>
      <Square className="size-3" aria-hidden /> Stop
    </Button>
  );
}

export function errorMessage(e: unknown) {
  if (e instanceof ApiError) return `${e.message}${e.referenceId ? ` (ref ${e.referenceId})` : ""}`;
  return e instanceof Error ? e.message : "Unknown error";
}
