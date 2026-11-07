import Link from "next/link";
import { ArrowDown, ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { CapabilityChip } from "@/components/authority/CapabilityChip";
import { SectionLabel } from "@/components/ui/Panel";
import type { Finding } from "@/lib/schemas";

const CATEGORY: Record<string, string> = {
  prompt_injection: "Prompt injection",
  honeytoken_access: "Honeycredential access",
  exfiltration: "Exfiltration",
  scope_creep: "Scope creep",
  resource_abuse: "Resource abuse",
};

export function FindingCard({ finding, trialId }: { finding: Finding; trialId: string }) {
  const runHref = (eventId: string | null) => `/app/trials/${trialId}/run/${finding.runId}${eventId ? `?event=${eventId}` : ""}`;
  return (
    <article className="rounded-[8px] border border-border bg-surface print-block" id={finding.id}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="danger">{CATEGORY[finding.category] ?? finding.category}</Badge>
            <span className="text-[11.5px] text-faint uppercase tracking-wide">severity {finding.severity}</span>
          </div>
          <h3 className="mt-1 text-[15px] font-semibold">{finding.title}</h3>
        </div>
        <div className="flex flex-col items-end gap-1">
          {finding.replayOutcome === "blocked" ? (
            <Badge tone="success"><ShieldCheck className="size-3" aria-hidden /> Blocked in replay</Badge>
          ) : finding.replayOutcome === "reproduced" ? (
            <Badge tone="danger"><ShieldX className="size-3" aria-hidden /> Reproduced in replay</Badge>
          ) : finding.guardAddressed ? (
            <Badge tone="blocked">Addressed by Guard · replay pending</Badge>
          ) : finding.guardAddressed === false ? (
            <Badge tone="warning">Not addressed by Guard</Badge>
          ) : (
            <Badge>Guard not compiled</Badge>
          )}
        </div>
      </header>
      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <SectionLabel className="mb-2">Causal chain</SectionLabel>
          <ol className="space-y-0">
            {finding.chain.map((step, i) => (
              <li key={i}>
                <div className="rounded-[6px] border border-border bg-surface-2/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium">{step.label}</span>
                    {step.eventId && (
                      <Link href={runHref(step.eventId)} className="text-[11.5px] text-info underline-offset-2 hover:underline">
                        evidence
                      </Link>
                    )}
                  </div>
                  {(step.capability || step.target) && (
                    <div className="mono mt-0.5 text-[12px] text-muted">
                      {step.capability}
                      {step.target ? `("${step.target}")` : ""}
                    </div>
                  )}
                  {step.detail && <div className="mt-0.5 text-[12px] text-muted">{step.detail}</div>}
                </div>
                {i < finding.chain.length - 1 && (
                  <div className="flex justify-center py-0.5 text-faint">
                    <ArrowDown className="size-3.5" aria-hidden />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-4 text-[13px]">
          <div>
            <SectionLabel className="mb-1">Impact</SectionLabel>
            <p>{finding.impact}</p>
          </div>
          <div>
            <SectionLabel className="mb-1">Why it was unnecessary for the legitimate goal</SectionLabel>
            <p>{finding.whyUnnecessary}</p>
          </div>
          <div>
            <SectionLabel className="mb-1">Capabilities involved</SectionLabel>
            <div className="flex flex-wrap gap-1">
              {finding.capabilities.map((c) => (
                <CapabilityChip key={c} name={c} classification="dangerous" />
              ))}
            </div>
          </div>
          {finding.guardRuleIds.length > 0 && (
            <div>
              <SectionLabel className="mb-1">Guard rules</SectionLabel>
              <div className="flex flex-wrap gap-1">
                {finding.guardRuleIds.map((r) => (
                  <Link key={r} href={`/app/trials/${trialId}/guard#${r}`} className="mono rounded-[4px] border border-blocked/30 bg-blocked-bg px-1.5 text-[11.5px] text-blocked">
                    {r}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="text-[12px] text-muted">{finding.evidenceEventIds.length} evidence events</div>
        </div>
      </div>
    </article>
  );
}
