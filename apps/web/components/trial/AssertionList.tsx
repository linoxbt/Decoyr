import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import type { Assertion, AssertionResult } from "@/lib/schemas";
import { cn } from "@/components/ui/cn";

export function AssertionList({ defs, results, compact }: { defs: Assertion[]; results?: AssertionResult[]; compact?: boolean }) {
  return (
    <ul className="space-y-1.5">
      {defs.map((d) => {
        const r = results?.find((x) => x.id === d.id);
        const passed = r?.passed;
        const Icon = passed === true ? CheckCircle2 : passed === false ? XCircle : CircleDashed;
        return (
          <li key={d.id} className="flex items-start gap-2 text-[13px]">
            <Icon className={cn("mt-0.5 size-4 shrink-0", passed === true ? "text-success" : passed === false ? "text-danger" : "text-faint")} aria-label={passed === true ? "passed" : passed === false ? "failed" : "not evaluated"} />
            <span className="min-w-0">
              <span className={cn(passed === false && "text-danger")}>{d.label}</span>
              {!compact && r?.detail && <span className="block text-[12px] text-muted">{r.detail}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
