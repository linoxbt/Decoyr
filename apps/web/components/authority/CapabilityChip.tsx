import { cn } from "@/components/ui/cn";
import { AUTHORITY_META, toneClasses } from "@/lib/status";
import type { AuthorityClass } from "@/lib/schemas";

export function CapabilityChip({ name, classification, constraint, className }: { name: string; classification?: AuthorityClass; constraint?: string | null; className?: string }) {
  const tone = classification ? AUTHORITY_META[classification].tone : "neutral";
  const t = toneClasses[tone];
  return (
    <span className={cn("inline-flex max-w-full items-center overflow-hidden rounded-[4px] border text-[11.5px] leading-[18px]", t.border, className)}>
      <span className={cn("mono truncate px-1.5", classification ? t.bg : "bg-surface-2", classification ? t.text : "text-text")}>{name}</span>
      {classification && <span className={cn("border-l px-1.5 font-medium", t.border, t.text)}>{AUTHORITY_META[classification].label}</span>}
      {constraint && <span className="mono truncate border-l border-border bg-surface px-1.5 text-muted">{constraint}</span>}
    </span>
  );
}
