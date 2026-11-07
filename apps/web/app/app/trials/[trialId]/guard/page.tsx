"use client";
import { useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { useGuard, useTrial } from "@/lib/api/hooks";
import { useTrialId } from "@/components/trial/TrialFrame";
import { Panel, SectionLabel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { CopyButton, downloadJson } from "@/components/ui/CopyButton";
import { JsonBlock } from "@/components/ui/JsonBlock";
import { Empty, ErrorState, PageSkeleton } from "@/components/ui/States";
import { GuardRuleRow } from "@/components/guard/GuardRule";
import { PhaseAction } from "@/components/trial/PhaseAction";
import { ApiError } from "@/lib/api/client";
import { dateTime, shortHash } from "@/lib/formatting";
import { cn } from "@/components/ui/cn";

export default function GuardPage() {
  const id = useTrialId();
  const { data: trial } = useTrial(id);
  const { data: guard, error, isLoading, refetch } = useGuard(id);
  const [view, setView] = useState<"human" | "json">("human");

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="p-6">
        <Empty icon={<ShieldCheck className="size-5" />} title="No Guard compiled yet" action={trial ? <PhaseAction trial={trial} /> : undefined}>
          The Guard is compiled from the Minimum Viable Authority derived from baseline evidence. Run the baseline, then Derive Minimum Authority.
        </Empty>
      </div>
    );
  }
  if (error) return <div className="p-6"><ErrorState error={error} onRetry={() => refetch()} title="Could not load Guard" /></div>;
  if (isLoading || !guard || !trial) return <div className="p-6"><PageSkeleton /></div>;

  const json = JSON.stringify(guard.policy, null, 2);
  const allow = guard.rules.filter((r) => r.decision === "allow").length;
  const deny = guard.rules.length - allow;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Panel bodyClassName="flex flex-wrap items-center justify-between gap-4">
        <div>
          <SectionLabel>Decoyr Guard · v{guard.version}</SectionLabel>
          <p className="mt-1 text-[15px] font-semibold">
            {allow} allow · {deny} deny · enforced by machine, not by prompt
          </p>
          <div className="mt-1 flex flex-wrap gap-x-4 text-[12px] text-muted">
            <span title={guard.sha256}>sha256 <span className="mono text-text">{shortHash(guard.sha256, 16)}</span></span>
            <span>id <span className="mono text-text">{guard.id}</span></span>
            <span>compiled {dateTime(guard.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={json} label="Copy JSON" size="md" />
          <Button onClick={() => downloadJson(`decoyr-guard-${guard.id}.json`, guard.policy)}>
            <Download className="size-3.5" aria-hidden /> Download Guard
          </Button>
          <PhaseAction trial={trial} />
        </div>
      </Panel>

      <div className="grid gap-3 text-[12.5px] md:grid-cols-3">
        {[
          { t: "MCP middleware", d: "Tool calls are evaluated against the Guard before any handler runs. Denied calls return an error to the agent." },
          { t: "Egress proxy", d: "Network GET/POST is checked per domain. The synthetic network never reaches the real internet." },
          { t: "Container runtime", d: `Wall clock ${guard.policy.limits.wall_seconds}s · ${guard.policy.limits.memory_mb} MB · ${guard.policy.limits.max_tool_calls} tool calls.` },
        ].map((x) => (
          <div key={x.t} className="rounded-[6px] border border-border bg-surface px-3 py-2">
            <div className="font-semibold">{x.t}</div>
            <div className="text-muted">{x.d}</div>
          </div>
        ))}
      </div>

      <Panel
        title="Policy"
        subtitle="Both views are generated from the same policy object."
        actions={
          <div className="flex rounded-[6px] border border-border text-[12.5px]" role="tablist" aria-label="Guard view">
            {(["human", "json"] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn("px-3 py-1", view === v ? "bg-text text-white" : "text-muted hover:text-text")}>
                {v === "human" ? "Human view" : "Policy JSON"}
              </button>
            ))}
          </div>
        }
        bodyClassName={view === "human" ? "p-0" : "p-4"}
      >
        {view === "human" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-border text-[11.5px] uppercase tracking-[0.05em] text-faint">
                <tr>
                  <th className="px-3 py-2 font-semibold">Rule</th>
                  <th className="px-3 py-2 font-semibold">Decision</th>
                  <th className="px-3 py-2 font-semibold">Constraint</th>
                  <th className="px-3 py-2 font-semibold">Reason</th>
                  <th className="px-3 py-2 font-semibold">Enforced at</th>
                  <th className="px-3 py-2 text-right font-semibold">Evidence</th>
                </tr>
              </thead>
              <tbody>{guard.rules.map((r) => <GuardRuleRow key={r.id} rule={r} />)}</tbody>
            </table>
          </div>
        ) : (
          <JsonBlock value={json} />
        )}
      </Panel>
    </div>
  );
}
