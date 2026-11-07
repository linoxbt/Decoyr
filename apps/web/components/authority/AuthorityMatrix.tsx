"use client";
import { Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { CapabilityChip } from "./CapabilityChip";
import { AUTHORITY_META } from "@/lib/status";
import type { AuthorityCapability } from "@/lib/schemas";
import { cn } from "@/components/ui/cn";

export type MatrixCell = { capability: AuthorityCapability; column: "requested" | "observed" | "classification" | "baseline" | "proposed" };

const ORDER = { required: 0, constrained: 1, dangerous: 2, unnecessary: 3, untested: 4 } as const;

export function AuthorityMatrix({ capabilities, selected, onSelect }: { capabilities: AuthorityCapability[]; selected?: MatrixCell | null; onSelect?: (c: MatrixCell) => void }) {
  const rows = [...capabilities].sort((a, b) => ORDER[a.classification] - ORDER[b.classification] || a.name.localeCompare(b.name));
  const cell = (c: AuthorityCapability, column: MatrixCell["column"], content: React.ReactNode, label: string) => {
    const isSel = selected?.capability.id === c.id && selected.column === column;
    return (
      <td className="p-0">
        <button
          onClick={() => onSelect?.({ capability: c, column })}
          className={cn("flex h-full min-h-[40px] w-full items-center px-3 py-2 text-left hover:bg-surface-2", isSel && "bg-surface-2 ring-1 ring-inset ring-text/50")}
          aria-label={`${c.name} ${label}`}
        >
          {content}
        </button>
      </td>
    );
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-[13px]">
        <thead className="border-b border-border text-[11.5px] uppercase tracking-[0.05em] text-faint">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Capability</th>
            <th scope="col" className="px-3 py-2 font-semibold">Requested</th>
            <th scope="col" className="px-3 py-2 font-semibold">Observed</th>
            <th scope="col" className="px-3 py-2 font-semibold">Required</th>
            <th scope="col" className="px-3 py-2 font-semibold">Baseline</th>
            <th scope="col" className="px-3 py-2 font-semibold">Proposed Guard</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const m = AUTHORITY_META[c.classification];
            return (
              <tr key={c.id} className="border-b border-border last:border-0" data-testid={`cap-${c.name}`}>
                <th scope="row" className="px-3 py-2 font-normal">
                  <span className="mono text-[12.5px]">{c.name}</span>
                </th>
                {cell(c, "requested", c.requested ? <Check className="size-4" aria-label="requested" /> : <Minus className="size-4 text-faint" aria-label="not requested" />, "requested")}
                {cell(
                  c,
                  "observed",
                  c.observed ? (
                    <span className="flex items-center gap-1.5"><Check className="size-4" aria-hidden /><span className="text-[12px] text-muted tabular-nums">×{c.observedCount}</span></span>
                  ) : (
                    <span className="text-[12px] text-muted">{c.classification === "untested" ? "Not exercised by this trial" : "not used"}</span>
                  ),
                  "observed",
                )}
                {cell(
                  c,
                  "classification",
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={m.tone}>{c.classification === "required" && <Check className="size-3" aria-hidden />}{m.label}</Badge>
                    {c.constraintLabel && <span className="mono rounded-[3px] border border-info/30 bg-info-bg px-1 text-[11px] text-info">{c.constraintLabel}</span>}
                    {c.classification === "dangerous" && c.findingIds.length > 0 && <span className="text-[11px] text-danger">{c.findingIds.length} finding</span>}
                  </span>,
                  "classification",
                )}
                {cell(
                  c,
                  "baseline",
                  <span className={cn("text-[12px] font-medium uppercase tracking-wide", c.baselineDecision === "allowed" ? (c.classification === "dangerous" ? "text-danger" : "text-text") : c.baselineDecision === "denied" ? "text-blocked" : "text-faint")}>
                    {c.baselineDecision === "not_used" ? "—" : c.classification === "dangerous" && c.baselineDecision === "allowed" ? "used" : c.baselineDecision}
                  </span>,
                  "baseline decision",
                )}
                {cell(
                  c,
                  "proposed",
                  <CapabilityChip name={c.proposedDecision === "allow" ? "allow" : "deny"} classification={undefined} constraint={c.proposedDecision === "allow" ? c.constraintLabel ?? "any" : null} className={c.proposedDecision === "allow" ? "border-success/30 [&>span:first-child]:bg-success-bg [&>span:first-child]:text-success" : "border-blocked/30 [&>span:first-child]:bg-blocked-bg [&>span:first-child]:text-blocked"} />,
                  "proposed guard",
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
