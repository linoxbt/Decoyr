import { cn } from "@/components/ui/cn";
import { toneClasses } from "@/lib/status";
import type { ReplayRow } from "@/lib/schemas";

function Cell({ value, tone }: { value: string; tone: ReplayRow["baselineTone"] }) {
  const t = toneClasses[tone];
  return <span className={cn("inline-flex whitespace-nowrap rounded-[4px] border px-2 py-0.5 text-[12px] font-semibold tracking-wide", t.text, t.bg, t.border)}>{value}</span>;
}

export function DiffRow({ row }: { row: ReplayRow }) {
  const changed = row.baseline !== row.replay;
  return (
    <tr className={cn("border-b border-border last:border-0", changed && "bg-surface-2/50")}>
      <td className="px-4 py-2.5 text-right" data-testid="diff-baseline">
        <Cell value={row.baseline} tone={row.baselineTone} />
      </td>
      <td className="mono px-4 py-2.5 text-center text-[12.5px] text-muted">{row.metric}</td>
      <td className="px-4 py-2.5" data-testid="diff-replay">
        <Cell value={row.replay} tone={row.replayTone} />
      </td>
    </tr>
  );
}
