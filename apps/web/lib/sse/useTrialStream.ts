"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "../api/hooks";
import type { TraceEvent, Trial } from "../schemas";

export type StreamState = "idle" | "connecting" | "live" | "reconnecting" | "ended";

const STREAM_BASE = (process.env.NEXT_PUBLIC_DECOYR_STREAM_BASE ?? "").replace(/\/$/, "");

/**
 * Live trace for one run. Merges history (GET /events) with SSE, dedupes by seq,
 * reconnects with exponential backoff passing after=<lastSeq>.
 */
export function useTrialStream(trialId: string, runId: string | null | undefined, opts: { live: boolean; initial?: TraceEvent[] }) {
  const qc = useQueryClient();
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [state, setState] = useState<StreamState>("idle");
  const seen = useRef<Map<number, TraceEvent>>(new Map());
  const lastSeq = useRef(0);

  // reset when run changes
  useEffect(() => {
    seen.current = new Map();
    lastSeq.current = 0;
    setEvents([]);
  }, [runId]);

  // merge history
  useEffect(() => {
    if (!opts.initial?.length) return;
    let changed = false;
    for (const e of opts.initial) {
      if (runId && e.runId !== runId) continue;
      if (!seen.current.has(e.seq)) {
        seen.current.set(e.seq, e);
        changed = true;
      }
      if (e.seq > lastSeq.current) lastSeq.current = e.seq;
    }
    if (changed) setEvents([...seen.current.values()].sort((a, b) => a.seq - b.seq));
  }, [opts.initial, runId]);

  useEffect(() => {
    if (!runId || !opts.live) {
      setState((s) => (s === "live" || s === "reconnecting" ? "ended" : s));
      return;
    }
    let es: EventSource | null = null;
    let closed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: TraceEvent[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      flushTimer = null;
      if (!pending.length) return;
      for (const e of pending) {
        if (!seen.current.has(e.seq)) seen.current.set(e.seq, e);
        if (e.seq > lastSeq.current) lastSeq.current = e.seq;
      }
      pending = [];
      setEvents([...seen.current.values()].sort((a, b) => a.seq - b.seq));
    };

    const connect = () => {
      if (closed) return;
      setState(attempt === 0 ? "connecting" : "reconnecting");
      const url = `${STREAM_BASE}/api/v1/trials/${trialId}/stream?runId=${encodeURIComponent(runId)}&after=${lastSeq.current}`;
      es = new EventSource(url);
      es.onopen = () => {
        attempt = 0;
        setState("live");
      };
      es.addEventListener("trace", (msg) => {
        try {
          const e = JSON.parse((msg as MessageEvent).data) as TraceEvent;
          if (e.runId !== runId) return;
          pending.push(e);
          if (!flushTimer) flushTimer = setTimeout(flush, 60);
        } catch {
          /* ignore malformed */
        }
      });
      es.addEventListener("status", (msg) => {
        try {
          const data = JSON.parse((msg as MessageEvent).data) as { trial?: Trial };
          if (data.trial) qc.setQueryData(qk.trial(trialId), data.trial);
        } catch {
          /* ignore */
        }
      });
      es.addEventListener("end", () => {
        flush();
        closed = true;
        es?.close();
        setState("ended");
        qc.invalidateQueries({ queryKey: ["trial", trialId] });
        qc.invalidateQueries({ queryKey: ["trials"] });
      });
      es.onerror = () => {
        es?.close();
        if (closed) return;
        attempt += 1;
        setState("reconnecting");
        const delay = Math.min(15000, 500 * 2 ** Math.min(attempt, 5)) + Math.random() * 250;
        timer = setTimeout(connect, delay);
      };
    };
    connect();
    return () => {
      closed = true;
      es?.close();
      if (timer) clearTimeout(timer);
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [trialId, runId, opts.live, qc]);

  return { events, state };
}
