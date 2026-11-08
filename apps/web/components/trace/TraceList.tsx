"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { EvidenceEvent } from "./EvidenceEvent";
import type { TraceEvent } from "@/lib/schemas";

const WINDOW = 400;

export function TraceList({ events, selectedId, onSelect, pendingModel, live, emptyText }: { events: TraceEvent[]; selectedId: string | null; onSelect: (e: TraceEvent) => void; pendingModel?: boolean; live?: boolean; emptyText?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const programmatic = useRef(false);

  const visible = !showAll && events.length > WINDOW ? events.slice(-WINDOW) : events;

  useLayoutEffect(() => {
    if (!follow || !ref.current) return;
    programmatic.current = true;
    ref.current.scrollTop = ref.current.scrollHeight;
  }, [events.length, follow, pendingModel]);

  // scroll selected into view when selected externally (e.g. ?event=)
  useEffect(() => {
    if (!selectedId || !ref.current) return;
    const el = ref.current.querySelector(`[data-evt="${selectedId}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      const c = ref.current.getBoundingClientRect();
      if (r.top < c.top || r.bottom > c.bottom) (el as HTMLElement).scrollIntoView({ block: "center" });
    }
  }, [selectedId]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    if (programmatic.current) {
      programmatic.current = false;
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setFollow(nearBottom);
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={ref} onScroll={onScroll} className="absolute inset-0 overflow-y-auto scroll-thin" role="log" aria-label="Live trace" aria-live="off">
        {events.length > WINDOW && !showAll && (
          <button onClick={() => setShowAll(true)} className="w-full border-b border-border py-1.5 text-[12px] text-muted hover:bg-surface-2">
            Showing latest {WINDOW} of {events.length} events — show all
          </button>
        )}
        {events.length === 0 && !pendingModel ? (
          <div className="p-6 text-center text-[13px] text-muted">{emptyText ?? "No events match this filter."}</div>
        ) : (
          <ul className="divide-y divide-border/70">
            {visible.map((e) => (
              <li key={e.id} data-evt={e.id}>
                <EvidenceEvent event={e} selected={e.id === selectedId} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        )}
        {pendingModel && (
          <div className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-muted">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Model request pending — waiting for Vultr Serverless Inference…
          </div>
        )}
        {live && !pendingModel && events.length > 0 && <div className="h-6" />}
      </div>
      {!follow && (
        <button
          onClick={() => {
            setFollow(true);
          }}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border-strong bg-surface px-3 py-1 text-[12px] shadow-sm hover:bg-surface-2"
        >
          <ArrowDown className="size-3.5" aria-hidden /> Jump to latest
        </button>
      )}
    </div>
  );
}
