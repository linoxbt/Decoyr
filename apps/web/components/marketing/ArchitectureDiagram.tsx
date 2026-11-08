import { cn } from "@/components/ui/cn";

function Box({ title, items, tone = "trusted", className }: { title: string; items?: string[]; tone?: "trusted" | "untrusted" | "external" | "synthetic"; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[6px] border bg-surface px-3 py-2",
        tone === "trusted" && "border-border-strong",
        tone === "untrusted" && "border-danger/40 bg-danger-bg/30",
        tone === "synthetic" && "border-warning/40 bg-warning-bg/30",
        tone === "external" && "border-info/40 bg-info-bg/40",
        className,
      )}
    >
      <div className="text-[12.5px] font-semibold">{title}</div>
      {items && (
        <ul className="mt-1 space-y-0.5 text-[11.5px] text-muted">
          {items.map((i) => <li key={i}>{i}</li>)}
        </ul>
      )}
    </div>
  );
}

function Arrow({ label, vertical }: { label?: string; vertical?: boolean }) {
  return (
    <div className={cn("flex items-center justify-center text-[10.5px] text-faint", vertical ? "flex-col py-1" : "px-1")} aria-hidden>
      {vertical ? <span className="h-4 w-px bg-border-strong" /> : <span className="h-px w-6 bg-border-strong" />}
      {label && <span className="mono px-1">{label}</span>}
      {vertical ? <span className="h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-border-strong" /> : <span className="h-0 w-0 border-y-4 border-l-4 border-y-transparent border-l-border-strong" />}
    </div>
  );
}

export function ArchitectureDiagram({ inferenceMode, sandboxMode }: { inferenceMode?: string; sandboxMode?: string }) {
  return (
    <div className="space-y-2" role="img" aria-label="Decoyr architecture: browser to Next.js web, to the trusted Vultr VM control plane, which calls Vultr Serverless Inference and orchestrates an isolated per-trial network containing the untrusted candidate agent, the synthetic MCP company and controlled egress.">
      <div className="flex flex-wrap items-center gap-1">
        <Box title="Browser" items={["Live trace via SSE"]} />
        <Arrow label="HTTPS" />
        <Box title="Decoyr Web" items={["Next.js · no secrets in bundle"]} />
        <Arrow label="REST + SSE" />
        <span className="text-[11px] text-muted">→ control plane</span>
      </div>
      <div className="rounded-[8px] border-2 border-text/80 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Trusted · Vultr Cloud Compute VM — central control plane</span>
          <span className="text-[11px] text-muted">holds Vultr inference key + signing key</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Box title="FastAPI API" items={["Trial orchestrator", "Telemetry collector", "Evidence store (Postgres)"]} />
          <Box title="Authority engine" items={["Capability accounting", "Deterministic assertions"]} />
          <Box title="Guard compiler" items={["Policy evaluator", "Replay + verifier"]} />
          <Box title="Inference proxy" items={["Trial-scoped token", inferenceMode ? `mode: ${inferenceMode}` : "OpenAI-compatible"]} />
        </div>
        <div className="mt-2 flex flex-wrap items-stretch gap-2">
          <div className="flex-1">
            <Arrow vertical label="docker SDK · per-trial network" />
            <div className="rounded-[8px] border-2 border-dashed border-danger/60 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-danger">Untrusted · isolated trial network (internal, no internet)</span>
                <span className="text-[11px] text-muted">{sandboxMode ? `sandbox: ${sandboxMode}` : "destroyed after every run"}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Box tone="untrusted" title="Candidate agent" items={["non-root · cap-drop ALL", "read-only rootfs · limits", "gets only a trial token"]} />
                <Arrow label="MCP" />
                <Box tone="synthetic" title="Synthetic MCP company" items={["Acme Labs repo/docs/messages", "Honeycredentials", "Guard in middleware"]} />
                <Arrow label="net.*" />
                <Box tone="synthetic" title="Controlled egress" items={["docs.acme.local", "exfil.attacker.local (sink)", "domain policy"]} />
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col justify-end sm:w-56">
            <Arrow vertical label="all LLM calls" />
            <Box tone="external" title="Vultr Serverless Inference" items={["api.vultrinference.com/v1", "OpenAI-compatible"]} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm border-2 border-text/80" /> trusted</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm border border-dashed border-danger" /> untrusted</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm border border-warning/60 bg-warning-bg" /> synthetic</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm border border-info/50 bg-info-bg" /> Vultr managed</span>
      </div>
    </div>
  );
}
