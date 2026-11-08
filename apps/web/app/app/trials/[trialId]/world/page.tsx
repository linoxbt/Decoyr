"use client";
import { useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import { ChevronDown, ChevronRight, FileText, Folder, EyeOff } from "lucide-react";
import { useTrial, useWorld } from "@/lib/api/hooks";
import { useTrialId } from "@/components/trial/TrialFrame";
import { Panel, SectionLabel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { ErrorState, PageSkeleton } from "@/components/ui/States";
import { WorldAssetCard } from "@/components/world/WorldAssetCard";
import { PhaseAction } from "@/components/trial/PhaseAction";
import { RawJson } from "@/components/ui/JsonBlock";
import { shortHash } from "@/lib/formatting";
import type { WorldAsset, WorldView } from "@/lib/schemas";
import { cn } from "@/components/ui/cn";

const GROUPS: { id: WorldAsset["group"]; label: string; note: string }[] = [
  { id: "repository", label: "Repository", note: "Release repository the task needs." },
  { id: "docs", label: "Internal Docs", note: "Handbook, policies and a fake sensitive export." },
  { id: "messages", label: "Messages", note: "Engineering threads and requests." },
  { id: "secrets", label: "Secret Store", note: "Names only — values are fake honeycredentials and always masked." },
  { id: "network", label: "Network", note: "Approved synthetic hosts and an adversarial endpoint. No real internet." },
];

export default function WorldPage() {
  const id = useTrialId();
  const [inspect, setInspect] = useState(false);
  const { data: trial } = useTrial(id);
  const { data: world, error, isLoading, refetch } = useWorld(id, inspect);

  if (error) return <div className="p-6"><ErrorState error={error} onRetry={() => refetch()} title="Could not load the World" /></div>;
  if (isLoading || !world) return <div className="p-6"><PageSkeleton /></div>;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Panel bodyClassName="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <SectionLabel>Decoyr World</SectionLabel>
          <h2 className="mt-0.5 text-[16px] font-semibold">{world.company.name} <span className="mono text-[13px] font-normal text-muted">{world.worldVersion}</span></h2>
          <p className="mt-1 text-[13px] text-muted">{world.company.description}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
            <span>seed <span className="mono text-text">{world.seed}</span></span>
            <span title={world.scenarioSha256}>scenario sha256 <span className="mono text-text">{shortHash(world.scenarioSha256, 16)}</span></span>
            <span>{world.assets.length} assets · {world.tools.length} MCP tools</span>
          </div>
          <div className="mt-3 rounded-[6px] border border-border bg-surface-2 px-3 py-2 text-[13px]">
            <span className="text-muted">Task given to the agent: </span>
            <span className="font-medium">{world.task.goal}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          {trial?.status === "draft" && <PhaseAction trial={trial} size="lg" />}
          <label className="flex items-center gap-2 text-[13px]">
            <Switch.Root
              checked={inspect}
              onCheckedChange={setInspect}
              className="relative h-5 w-9 rounded-full border border-border-strong bg-surface-2 data-[state=checked]:border-text data-[state=checked]:bg-text"
              aria-label="Inspect scenario"
            >
              <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-[17px]" />
            </Switch.Root>
            Inspect scenario
          </label>
          <p className="max-w-[260px] text-right text-[11.5px] text-muted">
            {world.revealed ? "Adversarial content is revealed." : "Adversarial content is hidden until a finding exposes it."}
          </p>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Repository" subtitle={<span className="mono">{world.repository.name}</span>}>
          <RepoTree world={world} />
          <SectionLabel className="mb-1.5 mt-4">Commits</SectionLabel>
          <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-[6px] border border-border scroll-thin">
            {world.repository.commits.map((c) => (
              <li key={c.sha} className="flex items-start gap-2 px-3 py-1.5 text-[12.5px]">
                <span className="mono shrink-0 text-faint">{c.sha.slice(0, 7)}</span>
                <span className="min-w-0 flex-1 truncate" title={c.message}>{c.message}</span>
                {c.tag && <Badge tone="info"><span className="mono">{c.tag}</span></Badge>}
              </li>
            ))}
          </ul>
        </Panel>
        <div className="space-y-4">
          {GROUPS.filter((g) => g.id !== "repository").map((g) => {
            const items = world.assets.filter((a) => a.group === g.id);
            return (
              <Panel key={g.id} title={g.label} subtitle={g.note}>
                {items.length === 0 ? (
                  <p className="text-[13px] text-muted">No assets in this group.</p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {items.map((a) => <WorldAssetCard key={a.id} asset={a} />)}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      </div>

      <RepoFiles world={world} />

      <Panel title="MCP tool catalog" subtitle="The only surface the candidate can act through. Guard enforcement happens in MCP middleware before handlers.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="border-b border-border text-[11.5px] uppercase tracking-[0.05em] text-faint">
              <tr>
                <th className="py-2 pr-3 font-semibold">Method</th>
                <th className="py-2 pr-3 font-semibold">Description</th>
                <th className="py-2 pr-3 font-semibold">Risk</th>
                <th className="py-2 pr-3 font-semibold">Requested</th>
                <th className="py-2 pr-3 font-semibold">Guard</th>
                <th className="py-2 font-semibold">Input schema</th>
              </tr>
            </thead>
            <tbody>
              {world.tools.map((t) => <ToolRow key={t.name} tool={t} />)}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function ToolRow({ tool }: { tool: WorldView["tools"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <tr className="border-b border-border align-top last:border-0">
      <td className="mono py-2 pr-3 text-[12.5px]">{tool.name}</td>
      <td className="py-2 pr-3">{tool.description}</td>
      <td className="py-2 pr-3 text-muted">{tool.risk}</td>
      <td className="py-2 pr-3">{tool.requested ? <Badge>requested</Badge> : <span className="text-faint">—</span>}</td>
      <td className="py-2 pr-3">
        {tool.guardStatus === "no_guard" ? (
          <span className="text-[12px] text-muted">No Guard yet</span>
        ) : (
          <Badge tone={tool.guardStatus === "deny" ? "blocked" : tool.guardStatus === "constrained" ? "info" : "success"}>
            {tool.guardStatus}
            {tool.guardConstraint ? <span className="mono"> {tool.guardConstraint}</span> : null}
          </Badge>
        )}
      </td>
      <td className="py-2">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-[12px] text-muted hover:text-text" aria-expanded={open}>
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />} schema
        </button>
        {open && <div className="mt-1 w-72"><RawJson value={tool.inputSchema} /></div>}
      </td>
    </tr>
  );
}

function RepoTree({ world }: { world: WorldView }) {
  return (
    <ul className="rounded-[6px] border border-border py-1 text-[12.5px]">
      {world.repository.tree.map((n) => {
        const depth = n.path.split("/").filter(Boolean).length - 1;
        const name = n.path.split("/").filter(Boolean).pop() ?? n.path;
        const hidden = n.status === "adversarial" && !world.revealed;
        return (
          <li key={n.path} className="flex items-center justify-between gap-2 px-2 py-0.5" style={{ paddingLeft: 8 + depth * 14 }}>
            <span className="flex min-w-0 items-center gap-1.5">
              {n.type === "dir" ? <Folder className="size-3.5 text-faint" aria-hidden /> : <FileText className="size-3.5 text-faint" aria-hidden />}
              <span className="mono truncate">{name}</span>
            </span>
            {n.status === "adversarial" && world.revealed && <Badge tone="danger">poisoned</Badge>}
            {n.status === "output" && <Badge tone="success">output</Badge>}
            {hidden && <span className="sr-only">normal</span>}
          </li>
        );
      })}
    </ul>
  );
}

function RepoFiles({ world }: { world: WorldView }) {
  const files = world.assets.filter((a) => a.group === "repository");
  const [open, setOpen] = useState<string | null>(null);
  if (!files.length) return null;
  return (
    <Panel title="Repository files" subtitle="Content previews are untrusted synthetic content.">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {files.map((f) => (
          <div key={f.id}>
            <button onClick={() => setOpen(open === f.id ? null : f.id)} className={cn("w-full text-left")} aria-expanded={open === f.id}>
              <WorldAssetCard asset={{ ...f, preview: open === f.id ? f.preview : null }} />
            </button>
          </div>
        ))}
      </div>
      {!world.revealed && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted"><EyeOff className="size-3.5" aria-hidden /> Turn on Inspect scenario to reveal which content is adversarial.</p>
      )}
    </Panel>
  );
}
