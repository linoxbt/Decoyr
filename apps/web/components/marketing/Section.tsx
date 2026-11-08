import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { buttonClass } from "@/components/ui/Button";
import { PreparedDemoButton } from "@/components/trial/PreparedDemoButton";

/** Small uppercase label above headings. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("text-[12px] font-semibold uppercase tracking-[0.08em] text-muted", className)}>{children}</div>;
}

export function Section({ children, className, tinted, id }: { children: ReactNode; className?: string; tinted?: boolean; id?: string }) {
  return (
    <section id={id} className={cn("border-b border-border", tinted && "bg-bg")}>
      <div className={cn("mx-auto max-w-6xl px-4 py-14 md:px-6 lg:py-16", className)}>{children}</div>
    </section>
  );
}

export function SectionHeader({ eyebrow, title, lead, action, className }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-2xl">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h2 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] md:text-[28px]">{title}</h2>
        {lead && <p className="mt-2 text-[15px] leading-relaxed text-muted">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-medium text-info hover:underline">
      {children} <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

/** Feature card: icon, title, body. */
export function Card({ icon, title, children, className }: { icon?: ReactNode; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[8px] border border-border bg-surface p-5", className)}>
      {icon && <div className="mb-3 inline-flex size-8 items-center justify-center rounded-[6px] border border-border bg-surface-2 text-text">{icon}</div>}
      <div className="text-[14.5px] font-semibold">{title}</div>
      <div className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}

/** Closing call to action shown at the bottom of each page. */
export function CtaBand({ title, lead, secondary }: { title: ReactNode; lead: ReactNode; secondary?: { href: string; label: string } }) {
  return (
    <section className="bg-text text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-14 md:px-6">
        <div className="max-w-2xl">
          <h2 className="text-[24px] font-semibold tracking-[-0.02em] md:text-[28px]">{title}</h2>
          <p className="mt-2 text-[14.5px] text-white/70">{lead}</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <PreparedDemoButton label="Test an agent" variant="secondary" size="lg" />
          {secondary && (
            <Link href={secondary.href} className={buttonClass("ghost", "lg", "text-white hover:bg-white/10")}>
              {secondary.label} <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/** Code block with a filename header (static, no highlighting dependency). */
export function CodeFrame({ title, children, className }: { title: string; children: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[8px] border border-border bg-surface", className)}>
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-3 py-1.5">
        <span className="mono text-[11.5px] text-muted">{title}</span>
        <span className="flex gap-1" aria-hidden>
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
        </span>
      </div>
      <pre className="scroll-thin overflow-x-auto p-4 text-[12px] leading-[1.6]"><code className="font-mono">{children}</code></pre>
    </div>
  );
}
