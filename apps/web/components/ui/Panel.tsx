import type { ReactNode } from "react";
import { cn } from "./cn";

export function Panel({ title, actions, children, className, bodyClassName, id, subtitle }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; id?: string }) {
  return (
    <section id={id} className={cn("rounded-[8px] border border-border bg-surface print-block", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="text-[13px] font-semibold tracking-[-0.005em]">{title}</h2>}
            {subtitle && <p className="text-[12px] text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function KV({ k, children, mono }: { k: ReactNode; children: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[132px_1fr] gap-3 py-1.5 text-[13px]">
      <dt className="text-muted">{k}</dt>
      <dd className={cn("min-w-0 break-words", mono && "mono")}>{children}</dd>
    </div>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("text-[11px] font-semibold uppercase tracking-[0.06em] text-faint", className)}>{children}</div>;
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("mono", className)}>{children}</span>;
}
