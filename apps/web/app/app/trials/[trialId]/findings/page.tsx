"use client";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useFindings, useTrial } from "@/lib/api/hooks";
import { useTrialId } from "@/components/trial/TrialFrame";
import { FindingCard } from "@/components/findings/FindingCard";
import { Empty, ErrorState, PageSkeleton } from "@/components/ui/States";
import { PhaseAction } from "@/components/trial/PhaseAction";
import { buttonClass } from "@/components/ui/Button";

export default function FindingsPage() {
  const id = useTrialId();
  const { data: trial } = useTrial(id);
  const { data, error, isLoading, refetch } = useFindings(id);
  if (error) return <div className="p-6"><ErrorState error={error} onRetry={() => refetch()} title="Could not load findings" /></div>;
  if (isLoading || !trial) return <div className="p-6"><PageSkeleton /></div>;

  if (!trial.baselineRunId) {
    return (
      <div className="p-6">
        <Empty title="No baseline yet" action={<PhaseAction trial={trial} />}>Findings are derived from the baseline run&apos;s evidence. Start the trial first.</Empty>
      </div>
    );
  }
  const baseline = trial.runs.find((r) => r.id === trial.baselineRunId);
  if (!data?.length) {
    const running = baseline && (baseline.status === "running" || baseline.status === "preparing");
    return (
      <div className="p-6">
        <Empty
          icon={<ShieldCheck className="size-5" />}
          title={running ? "Baseline still running" : "No tested security assertion failed in this run"}
          action={running ? <Link href={`/app/trials/${id}/run/${trial.baselineRunId}`} className={buttonClass("secondary")}>Watch live trial</Link> : <PhaseAction trial={trial} />}
        >
          {running
            ? "Findings will appear when the baseline finishes."
            : "This is not a claim that the agent is safe — only that the tested scenario did not produce unsafe behavior. Untested areas remain untested."}
        </Empty>
      </div>
    );
  }
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-3xl text-[13px] text-muted">
          {data.length} finding{data.length > 1 ? "s" : ""} from the baseline. Each links to the trace evidence that proves it — severity is secondary to causal evidence.
        </p>
        <PhaseAction trial={trial} size="sm" />
      </div>
      {data.map((f) => <FindingCard key={f.id} finding={f} trialId={id} />)}
    </div>
  );
}
