"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAgent } from "@/lib/api/hooks";
import { PageHeader } from "@/components/shell/AppShell";
import { Panel, KV } from "@/components/ui/Panel";
import { ErrorState, PageSkeleton } from "@/components/ui/States";
import { CapabilityChip } from "@/components/authority/CapabilityChip";
import { TrialStatusBadge, CheckBadge } from "@/components/trial/TrialStatusBadge";
import { Badge } from "@/components/ui/Badge";
import { dateTime, relativeTime } from "@/lib/formatting";

export default function AgentProfilePage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { data, error, isLoading, refetch } = useAgent(agentId);
  if (error) return <div className="p-6"><ErrorState error={error} onRetry={() => refetch()} title="Could not load agent" /></div>;
  if (isLoading || !data) return <div className="p-6"><PageSkeleton /></div>;
  const { agent, trials, latestPassport } = data;
  return (
    <div>
      <PageHeader title={<>{agent.name} <span className="mono text-[14px] font-normal text-muted">{agent.version}</span></>} breadcrumb={<Link href="/app/agents" className="hover:text-text">Agents</Link>} description={agent.purpose} />
      <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-3">
        <Panel title="Profile">
          <dl>
            <KV k="Model" mono>{agent.model}</KV>
            <KV k="Created">{dateTime(agent.createdAt)}</KV>
            <KV k="Trials">{trials.length}</KV>
          </dl>
        </Panel>
        <Panel title="Requested capabilities">
          <div className="flex flex-wrap gap-1">{agent.requestedCapabilities.map((c) => <CapabilityChip key={c} name={c} />)}</div>
        </Panel>
        <Panel title="Latest Passport">
          {latestPassport ? (
            <div className="space-y-2 text-[13px]">
              <Badge tone={latestPassport.status === "calibrated" ? "success" : "danger"}>{latestPassport.label}</Badge>
              <div className="text-muted">Minimum authority:</div>
              <div className="flex flex-wrap gap-1">{latestPassport.minimumViableAuthority.map((m) => <CapabilityChip key={m.capability} name={m.capability} classification={m.constraint ? "constrained" : "required"} constraint={m.constraint} />)}</div>
              <Link href={`/app/trials/${latestPassport.trialId}/passport`} className="block text-info hover:underline">Open Passport</Link>
            </div>
          ) : (
            <p className="text-[13px] text-muted">No Passport yet. Complete a baseline, calibration and replay.</p>
          )}
        </Panel>
        <Panel title="Trials & authority changes" className="lg:col-span-3" bodyClassName="p-0">
          <table className="w-full text-left text-[13px]">
            <tbody>
              {trials.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5"><Link href={`/app/trials/${t.id}`} className="font-medium hover:underline">{t.name}</Link> <span className="mono text-[11.5px] text-faint">{t.shortId}</span></td>
                  <td className="px-3 py-2.5"><TrialStatusBadge status={t.status} /></td>
                  <td className="px-3 py-2.5"><div className="flex gap-3"><CheckBadge label="Task" result={t.taskResult} /><CheckBadge label="Security" result={t.securityResult} /></div></td>
                  <td className="px-3 py-2.5">{t.guardId ? <Link href={`/app/trials/${t.id}/guard`} className="text-info hover:underline">Guard</Link> : <span className="text-faint">no Guard</span>}</td>
                  <td className="px-4 py-2.5 text-right text-muted">{relativeTime(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
