"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useResetDemo, useSystem } from "@/lib/api/hooks";
import { PageHeader } from "@/components/shell/AppShell";
import { Panel, KV } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState, PageSkeleton } from "@/components/ui/States";

export default function SettingsPage() {
  const { data: sys, error, isLoading, refetch } = useSystem();
  const reset = useResetDemo();
  const router = useRouter();
  const [token, setToken] = useState("");
  return (
    <div>
      <PageHeader title="Settings" description="Control plane configuration (read-only) and team-only demo controls." />
      <div className="grid max-w-5xl gap-4 p-4 md:p-6 lg:grid-cols-2">
        {error ? (
          <ErrorState className="lg:col-span-2" error={error} onRetry={() => refetch()} title="Could not reach the control plane" />
        ) : isLoading || !sys ? (
          <div className="lg:col-span-2"><PageSkeleton /></div>
        ) : (
          <>
            <Panel title="Inference">
              <dl>
                <KV k="Mode"><Badge tone={sys.inference.mode === "vultr" ? "success" : "warning"}>{sys.inference.mode === "vultr" ? "Vultr Serverless Inference" : "Simulated — no Vultr key configured"}</Badge></KV>
                <KV k="Provider">{sys.inference.provider}</KV>
                <KV k="Base URL" mono>{sys.inference.baseUrl}</KV>
                <KV k="Model" mono>{sys.inference.model}</KV>
              </dl>
              <p className="mt-2 text-[12px] text-muted">The inference key lives only in the control plane. Candidates call a trial-scoped relay and never see it.</p>
            </Panel>
            <Panel title="Sandbox">
              <dl>
                <KV k="Mode" mono>{sys.sandbox.mode}</KV>
                <KV k="Docker">{sys.sandbox.dockerAvailable ? <Badge tone="success">available</Badge> : <Badge tone="warning">unavailable</Badge>}</KV>
                <KV k="Candidate image" mono>{sys.sandbox.candidateImage}</KV>
              </dl>
              <ul className="mt-2 list-disc pl-4 text-[12px] text-muted">{sys.sandbox.isolation.map((i) => <li key={i}>{i}</li>)}</ul>
            </Panel>
            <Panel title="Control plane">
              <dl>
                <KV k="Version" mono>{sys.version}</KV>
                <KV k="Host">{sys.controlPlane.host}</KV>
                <KV k="Provider">{sys.controlPlane.provider}</KV>
              </dl>
            </Panel>
            <Panel title="Services">
              <ul className="space-y-1 text-[13px]">
                {sys.services.map((s) => (
                  <li key={s.name} className="flex items-center justify-between">
                    <span className="mono">{s.name}</span>
                    <Badge tone={s.status === "up" ? "success" : s.status === "down" ? "danger" : "neutral"} dot>{s.status}</Badge>
                  </li>
                ))}
              </ul>
            </Panel>
          </>
        )}
        <Panel title="Reset demo" subtitle="Team only. Removes demo trials and prepares a fresh prepared-demo trial." className="lg:col-span-2" id="reset">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium">Admin token (if configured)</span>
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" className="h-9 w-72 rounded-[6px] border border-border-strong bg-surface px-2.5 text-[13px] outline-none focus:border-text" />
            </label>
            <Button variant="danger" loading={reset.isPending} onClick={() => reset.mutate(token || undefined, { onSuccess: (r) => r.demoTrialId && router.push(`/app/trials/${r.demoTrialId}`) })}>
              <RotateCcw className="size-3.5" aria-hidden /> Reset Demo
            </Button>
          </div>
          <p className="mt-2 text-[12px] text-muted">The token is sent once in a request header and is never stored by the browser.</p>
          {reset.error && <ErrorState className="mt-3" error={reset.error} title="Reset failed" />}
          {reset.isSuccess && <p className="mt-3 text-[13px] text-success">Demo reset.</p>}
        </Panel>
      </div>
    </div>
  );
}
