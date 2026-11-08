import type { ReactNode } from "react";
import { cn } from "./cn";
import { toneClasses } from "@/lib/status";
import type { Tone } from "@/lib/formatting";

export function Badge({ tone = "neutral", children, dot, className, title }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string; title?: string }) {
  const t = toneClasses[tone];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[4px] border px-1.5 py-[1px] text-[11.5px] font-medium leading-[18px] whitespace-nowrap",
        t.text,
        t.bg,
        t.border,
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", t.dot)} aria-hidden />}
      {children}
    </span>
  );
}
