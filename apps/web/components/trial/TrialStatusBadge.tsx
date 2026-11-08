import { Badge } from "@/components/ui/Badge";
import { CHECK_META, CONCLUSION_META, STATUS_META } from "@/lib/status";
import type { CheckResult, Conclusion, TrialStatus } from "@/lib/schemas";

const LIVE = new Set<TrialStatus>(["preparing", "running", "calibrating", "replaying"]);

export function TrialStatusBadge({ status }: { status: TrialStatus }) {
  const m = STATUS_META[status] ?? { label: status, tone: "neutral" as const, description: "" };
  return (
    <Badge tone={m.tone} dot title={m.description} className={LIVE.has(status) ? "[&>span]:animate-pulse" : undefined}>
      {m.label}
    </Badge>
  );
}

export function ConclusionBadge({ conclusion }: { conclusion: Conclusion }) {
  const m = CONCLUSION_META[conclusion] ?? { label: conclusion, tone: "neutral" as const };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function CheckBadge({ result, label }: { result: CheckResult; label: string }) {
  const m = CHECK_META[result];
  return (
    <span className="inline-flex items-center gap-1 text-[12px]">
      <span className="text-muted">{label}</span>
      <Badge tone={m.tone}>{m.label}</Badge>
    </span>
  );
}
