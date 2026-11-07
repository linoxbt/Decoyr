"use client";
import Link from "next/link";
import { useAgents } from "@/lib/api/hooks";
import { PageHeader } from "@/components/shell/AppShell";
import { Empty, ErrorState, Skeleton } from "@/components/ui/States";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { relativeTime } from "@/lib/formatting";

export default function AgentsPage() {
  const { data, error, isLoading, refetch } = useAgents();
  return (
    <div>
      <PageHeader title="Agents" description="Agent versions that have entered a synthetic company." actions={<Link href="/app/trials/new" className={buttonClass("primary")}>Test an agent</Link>} />
      <div className="p-4 md:p-6">
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} title="Could not load agents" />
        ) : isLoading ? (
          <Skeleton className="h-40" />
        ) : !data?.length ? (
          <Empty title="No agents yet" action={<Link href="/app/trials/new" className={buttonClass("primary")}>Test an agent</Link>}>Agents appear here after their first trial.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-[8px] border border-border bg-surface">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="border-b border-border text-[11.5px] uppercase tracking-[0.05em] text-faint">
                <tr>
                  <th className="px-4 py-2 font-semibold">Agent</th>
                  <th className="px-3 py-2 font-semibold">Purpose</th>
                  <th className="px-3 py-2 font-semibold">Trials</th>
                  <th className="px-3 py-2 font-semibold">Latest scoped calibration</th>
                  <th className="px-3 py-2 font-semibold">Last tested</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-surface-2/50">
                    <td className="px-4 py-2.5">
                      <Link href={`/app/agents/${a.id}`} className="font-medium hover:underline">{a.name}</Link> <span className="mono text-[12px] text-muted">{a.version}</span>
                      {a.builtin && <Badge className="ml-2">demo profile</Badge>}
                    </td>
                    <td className="max-w-[320px] truncate px-3 py-2.5 text-muted">{a.purpose}</td>
                    <td className="px-3 py-2.5 tabular-nums">{a.trialCount ?? 0}</td>
                    <td className="px-3 py-2.5">{a.latestCalibration ? <Badge tone="success">{a.latestCalibration}</Badge> : <span className="text-faint">Not calibrated</span>}</td>
                    <td className="px-3 py-2.5 text-muted">{relativeTime(a.lastTestedAt)}</td>
                    <td className="px-4 py-2.5 text-right"><Link href={`/app/agents/${a.id}`} className={buttonClass("secondary", "sm")}>Profile</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
