"use client";
import { useSystem } from "@/lib/api/hooks";
import { ArchitectureDiagram } from "./ArchitectureDiagram";
import { Badge } from "@/components/ui/Badge";

const BOUNDARIES = [
  ["Vultr key never enters the sandbox", "The candidate receives only a short-lived HMAC trial token. Inference goes through a trial-scoped relay to the control plane, which alone holds VULTR_SERVERLESS_INFERENCE_API_KEY."],
  ["Execution outside the app process", "Candidates run in Docker containers: non-root uid, cap-drop ALL, no-new-privileges, read-only rootfs, memory/CPU/PID limits, no Docker socket."],
  ["Per-trial network", "Each run gets an internal Docker network with no route to the internet. Only the synthetic MCP company is attached; it forwards net.* to a controlled egress proxy that serves synthetic hosts."],
  ["Guard is machine-enforced", "Policy is evaluated in MCP middleware before tool handlers and at the egress proxy per domain. The system prompt is never the boundary."],
  ["Evidence is append-only", "Events carry trial_id, run_id, seq and correlation IDs. Honeycredential values are masked before reaching the browser."],
  ["Disposable by default", "Containers and networks are destroyed after every run and replay. Destroying a candidate workspace does not affect the API or database."],
];

export function ArchitectureLive() {
  const { data } = useSystem();
  return (
    <div>
      <div className="flex flex-wrap gap-2 text-[12px]">
        {data ? (
          <>
            <Badge tone={data.inference.mode === "vultr" ? "success" : "warning"} dot>Inference: {data.inference.mode === "vultr" ? `Vultr · ${data.inference.model}` : "simulated (no key configured)"}</Badge>
            <Badge dot tone={data.sandbox.dockerAvailable ? "success" : "warning"}>Sandbox: {data.sandbox.mode}</Badge>
            <Badge dot>Control plane: {data.controlPlane.provider}</Badge>
            {data.services.map((s) => <Badge key={s.name} tone={s.status === "up" ? "success" : s.status === "down" ? "danger" : "neutral"} dot>{s.name}</Badge>)}
          </>
        ) : (
          <Badge>Live system status unavailable</Badge>
        )}
      </div>
      <div className="mt-6 rounded-[8px] border border-border bg-surface p-4">
        <ArchitectureDiagram inferenceMode={data?.inference.mode} sandboxMode={data?.sandbox.mode} />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {BOUNDARIES.map(([t, d]) => (
          <div key={t} className="rounded-[8px] border border-border bg-surface p-4">
            <div className="text-[14px] font-semibold">{t}</div>
            <p className="mt-1 text-[13px] text-muted">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
