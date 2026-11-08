"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useTrials } from "@/lib/api/hooks";
import { PageHeader } from "@/components/shell/AppShell";
import { buttonClass } from "@/components/ui/Button";
import { PreparedDemoButton } from "@/components/trial/PreparedDemoButton";
import { TrialStatusBadge, CheckBadge } from "@/components/trial/TrialStatusBadge";
import { Empty, ErrorState, Skeleton } from "@/components/ui/States";
import { relativeTime } from "@/lib/formatting";
import { STATUS_META, nextPhase } from "@/lib/status";
import type { TrialListItem, TrialStatus } from "@/lib/schemas";

function actionFor(t: TrialListItem) {
  const base = `/app/trials/${t.id}`;
  const phase = nextPhase(t.status);
  if (phase === "passport") return { href: `${base}/passport`, label: "Passport" };
  if (phase === "replay") return { href: `${base}/guard`, label: "Replay" };
  if (phase === "calibrate") return { href: `${base}/findings`, label: "Review" };
  if (phase === "watch") return { href: t.status === "replaying" ? `${base}/replay` : base, label: "Watch" };
  return { href: base, label: "Resume" };
}

export default function TrialsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("updated");
  const { data, error, isLoading, refetch } = useTrials({ q, status, sort });

  const rows = useMemo(() => data ?? [], [data]);

  return (
    <div>
      <PageHeader
        title="Trials"
        description="Work queue. Each trial puts one agent version inside a disposable synthetic company."
        actions={
          <>
            <PreparedDemoButton label="Prepared demo" />
            <Link href="/app/trials/new" className={buttonClass("primary")}>
              <Plus className="size-4" aria-hidden /> New Trial
            </Link>
          </>
        }
      />
      <div className="space-y-3 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search trials</span>
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search agent, trial ID…"
              className="h-8 w-64 rounded-[6px] border border-border-strong bg-surface pl-7 pr-2 text-[13px] outline-none focus:border-text"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-muted">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 rounded-[6px] border border-border-strong bg-surface px-2 text-[13px] text-text">
              <option value="all">All</option>
              {(Object.keys(STATUS_META) as TrialStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-muted">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-8 rounded-[6px] border border-border-strong bg-surface px-2 text-[13px] text-text">
              <option value="updated">Last updated</option>
              <option value="created">Created</option>
            </select>
          </label>
        </div>

        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} title="Could not load trials" />
        ) : isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : rows.length === 0 ? (
          <Empty
            title={q || status !== "all" ? "No trials match these filters" : "No trials yet"}
            action={q || status !== "all" ? undefined : <PreparedDemoButton variant="primary" />}
          >
            {q || status !== "all"
              ? "Clear the search or status filter to see all trials."
              : "Run the prepared demo: ResearchBot is asked to write release notes inside Acme Labs while a poisoned README tries to steal a deploy token."}
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-[8px] border border-border bg-surface">
            <table className="w-full min-w-[960px] text-left text-[13px]">
              <thead className="border-b border-border text-[11.5px] uppercase tracking-[0.05em] text-faint">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">Trial</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Agent</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Purpose</th>
                  <th scope="col" className="px-3 py-2 font-semibold">World</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Result</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Updated</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const a = actionFor(t);
                  return (
                    <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface-2/50">
                      <td className="px-4 py-2.5">
                        <Link href={`/app/trials/${t.id}`} className="font-medium hover:underline">{t.name}</Link>
                        <div className="mono text-[11.5px] text-faint">{t.shortId}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        {t.agent.name} <span className="mono text-[12px] text-muted">{t.agent.version}</span>
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-2.5 text-muted" title={t.agent.purpose}>{t.agent.purpose}</td>
                      <td className="px-3 py-2.5"><span className="mono text-[12px]">{t.worldVersion}</span></td>
                      <td className="px-3 py-2.5"><TrialStatusBadge status={t.status} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <CheckBadge label="Task" result={t.taskResult} />
                          <CheckBadge label="Security" result={t.securityResult} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted" title={t.updatedAt}>{relativeTime(t.updatedAt)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={a.href} className={buttonClass("secondary", "sm")}>{a.label}</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
