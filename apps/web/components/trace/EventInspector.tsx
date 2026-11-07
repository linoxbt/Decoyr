"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight, Link2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { KV, SectionLabel } from "@/components/ui/Panel";
import { RawJson } from "@/components/ui/JsonBlock";
import { clock, eventTone, maskSecrets } from "@/lib/formatting";
import type { TraceEvent } from "@/lib/schemas";
import { cn } from "@/components/ui/cn";

export function EventInspector({ event, all, onSelect, onClose }: { event: TraceEvent | null; all: TraceEvent[]; onSelect?: (e: TraceEvent) => void; onClose?: () => void }) {
  const [raw, setRaw] = useState(false);
  if (!event) {
    return (
      <div className="p-4 text-[13px] text-muted">
        <SectionLabel className="mb-2">Inspector</SectionLabel>
        Select any event in the trace to see its summary, arguments, policy decision and correlation chain.
      </div>
    );
  }
  const chain = event.correlationId ? all.filter((e) => e.correlationId === event.correlationId) : [event];
  const ev = maskSecrets(event.evidence ?? {}) as Record<string, unknown>;
  const args = ev.args ?? ev.arguments;
  const result = ev.preview ?? ev.result ?? ev.resultPreview;
  const tone = eventTone(event);
  const untrusted = event.flags.includes("untrusted_content");
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <SectionLabel>Event #{event.seq} · {event.type}</SectionLabel>
          <h3 className="mt-0.5 text-[14px] font-semibold">{event.title}</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-surface-2" aria-label="Close inspector">
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3 scroll-thin">
        <p className="text-[13px]">{event.summary}</p>
        {event.flags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.flags.map((f) => (
              <Badge key={f} tone={f === "attack_path" || f === "honeytoken" || f === "adversarial" ? "danger" : f === "injection" || f === "untrusted_content" ? "warning" : f === "guard" ? "blocked" : f === "legitimate_path" ? "success" : "neutral"}>
                {f.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        )}
        <dl className="divide-y divide-border">
          <KV k="Time">{clock(event.timestamp)}</KV>
          <KV k="Actor">{event.actor}</KV>
          {event.capability && <KV k="Capability" mono>{event.capability}</KV>}
          {event.target && <KV k="Target" mono>{event.target}</KV>}
          {event.decision && (
            <KV k="Decision">
              <Badge tone={event.decision === "denied" ? "blocked" : event.decision === "error" ? "danger" : tone === "danger" ? "danger" : event.decision === "allowed" ? "success" : "neutral"}>{event.decision}</Badge>
            </KV>
          )}
          {ev.reason != null && <KV k="Policy reason">{String(ev.reason)}</KV>}
          {ev.ruleId != null && <KV k="Rule" mono>{String(ev.ruleId)}</KV>}
          {event.latencyMs != null && <KV k="Latency">{event.latencyMs} ms</KV>}
          {event.correlationId && <KV k="Correlation" mono>{event.correlationId}</KV>}
          {ev.resultSha256 != null && <KV k="Result hash" mono>{String(ev.resultSha256).slice(0, 16)}…</KV>}
        </dl>
        {args !== undefined && (
          <div>
            <SectionLabel className="mb-1">Arguments</SectionLabel>
            <RawJson value={args} />
          </div>
        )}
        {result !== undefined && (
          <div>
            <SectionLabel className="mb-1">Result {untrusted && <span className="ml-1 normal-case tracking-normal text-warning">· untrusted trial content</span>}</SectionLabel>
            <pre className={cn("mono max-h-56 overflow-auto rounded-[4px] border p-2 text-[11.5px] leading-[1.5] whitespace-pre-wrap break-words scroll-thin", untrusted ? "border-warning/30 bg-warning-bg/40" : "border-border bg-surface-2")}>
              {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
        {chain.length > 1 && (
          <div>
            <SectionLabel className="mb-1 flex items-center gap-1">
              <Link2 className="size-3" aria-hidden /> Correlation chain
            </SectionLabel>
            <ol className="space-y-0.5">
              {chain.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => onSelect?.(c)}
                    className={cn("flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[12px] hover:bg-surface-2", c.id === event.id && "bg-surface-2 font-medium")}
                  >
                    <span className="mono w-7 text-faint">#{c.seq}</span>
                    <span className="mono text-muted">{c.type}</span>
                    <span className="truncate">{c.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
        <div>
          <button onClick={() => setRaw((r) => !r)} className="flex items-center gap-1 text-[12px] font-medium text-muted hover:text-text" aria-expanded={raw}>
            {raw ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />} Raw event JSON
          </button>
          {raw && (
            <div className="mt-1">
              <RawJson value={maskSecrets(event)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
