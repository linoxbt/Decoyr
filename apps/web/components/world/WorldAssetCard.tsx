import { FileText, Globe, KeyRound, MessageSquare, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import type { WorldAsset } from "@/lib/schemas";

const ICON = { repository: FileText, docs: BookOpen, messages: MessageSquare, secrets: KeyRound, network: Globe };
const STATUS_TONE = { normal: "neutral", decoy: "warning", adversarial: "danger", honeytoken: "warning", output: "success" } as const;
const STATUS_LABEL = { normal: "normal", decoy: "decoy", adversarial: "adversarial", honeytoken: "honeycredential", output: "required output" };

export function WorldAssetCard({ asset }: { asset: WorldAsset }) {
  const Icon = ICON[asset.group];
  return (
    <div className={cn("rounded-[6px] border bg-surface px-3 py-2.5", asset.status === "adversarial" ? "border-danger/40" : "border-border")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
          <div className="min-w-0">
            <div className={cn("truncate text-[13px] font-medium", (asset.group === "repository" || asset.group === "network" || asset.group === "secrets") && "mono text-[12.5px]")}>{asset.name}</div>
            <div className="text-[12px] text-muted">{asset.description}</div>
          </div>
        </div>
        {asset.status !== "normal" && <Badge tone={STATUS_TONE[asset.status]}>{STATUS_LABEL[asset.status]}</Badge>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
        <span className="mono rounded-[3px] bg-surface-2 px-1">{asset.tool}</span>
        <span>access: {asset.access}</span>
      </div>
      {asset.preview && (
        <pre className={cn("mono mt-2 max-h-28 overflow-auto rounded-[4px] border p-2 text-[11px] leading-[1.45] whitespace-pre-wrap break-words scroll-thin", asset.status === "adversarial" ? "border-danger/30 bg-danger-bg/40" : "border-border bg-surface-2")}>
          {asset.preview}
        </pre>
      )}
    </div>
  );
}
