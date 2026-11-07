"use client";
import { memo } from "react";
import { Bot, Cpu, FileText, Globe, KeyRound, Shield, ShieldAlert, Box, Wrench, AlertTriangle, CheckCircle2, Ban } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { clock, eventTone } from "@/lib/formatting";
import { toneClasses } from "@/lib/status";
import type { TraceEvent } from "@/lib/schemas";

function iconFor(e: TraceEvent) {
  if (e.decision === "denied") return Ban;
  if (e.type.startsWith("honeytoken")) return KeyRound;
  if (e.type.startsWith("model.")) return Bot;
  if (e.type.startsWith("net.")) return Globe;
  if (e.type.startsWith("artifact")) return FileText;
  if (e.type.startsWith("assertion.pass")) return CheckCircle2;
  if (e.type.startsWith("assertion.fail") || e.type === "injection.delivered") return AlertTriangle;
  if (e.type.startsWith("guard")) return Shield;
  if (e.type.startsWith("finding")) return ShieldAlert;
  if (e.type.startsWith("tool.")) return Wrench;
  if (e.type.startsWith("sandbox") || e.type.startsWith("process")) return Box;
  return Cpu;
}

const ACTOR_LABEL: Record<string, string> = { agent: "Agent", orchestrator: "Orchestrator", mcp: "MCP", guard: "Guard", sandbox: "Sandbox" };

export const EvidenceEvent = memo(function EvidenceEvent({
  event,
  selected,
  muted,
  emphasized,
  onSelect,
  compact,
}: {
  event: TraceEvent;
  selected?: boolean;
  muted?: boolean;
  emphasized?: boolean;
  onSelect?: (e: TraceEvent) => void;
  compact?: boolean;
}) {
  const tone = eventTone(event);
  const t = toneClasses[tone];
  const Icon = iconFor(event);
  const decision = event.decision;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(event)}
      aria-pressed={selected}
      data-seq={event.seq}
      className={cn(
        "group grid w-full grid-cols-[44px_18px_1fr_auto] items-start gap-2 border-l-2 px-3 text-left transition-colors duration-150",
        compact ? "py-1.5" : "py-2",
        selected ? "bg-surface-2 border-l-text" : tone === "neutral" ? "border-l-transparent hover:bg-surface-2/60" : cn(t.border.replace("border-", "border-l-"), "hover:bg-surface-2/60"),
        tone === "danger" && !selected && "border-l-danger bg-danger-bg/40",
        tone === "blocked" && !selected && "border-l-blocked bg-blocked-bg/40",
        muted && "opacity-45",
        emphasized && "ring-1 ring-inset ring-text/60",
      )}
    >
      <span className="mono pt-[1px] text-[11px] text-faint tabular-nums">{clock(event.timestamp)}</span>
      <Icon className={cn("mt-[2px] size-3.5", tone === "neutral" ? "text-muted" : t.text)} aria-hidden />
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className={cn("text-[13px] font-medium", tone === "danger" && "text-danger", tone === "blocked" && "text-blocked")}>{event.title}</span>
          {event.target && !compact && <span className="mono truncate text-[11.5px] text-muted">{event.target}</span>}
        </span>
        {!compact && event.summary && event.summary !== event.title && <span className="block truncate text-[12px] text-muted">{event.summary}</span>}
      </span>
      <span className="flex items-center gap-1.5 pt-[1px]">
        {event.flags.includes("untrusted_content") && !compact && <span className="rounded-[3px] border border-warning/30 px-1 text-[10.5px] text-warning">untrusted</span>}
        {decision && decision !== "observed" && (
          <span className={cn("text-[10.5px] font-semibold uppercase tracking-wide", decision === "allowed" ? (tone === "danger" ? "text-danger" : "text-success") : decision === "denied" ? "text-blocked" : "text-danger")}>
            {decision}
          </span>
        )}
        {!compact && <span className="hidden text-[10.5px] text-faint xl:inline">{ACTOR_LABEL[event.actor] ?? event.actor}</span>}
      </span>
    </button>
  );
});
