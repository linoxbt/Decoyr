import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { DOCS_FLAT } from "./nav";

/** A documentation page: breadcrumb, title, lead, body, previous/next. `path` must match an entry in DOCS_NAV. */
export function DocPage({ path, title, lead, children }: { path: string; title: string; lead?: ReactNode; children: ReactNode }) {
  const i = DOCS_FLAT.findIndex((l) => l.href === path);
  const here = DOCS_FLAT[i];
  const prev = i > 0 ? DOCS_FLAT[i - 1] : null;
  const next = i >= 0 && i < DOCS_FLAT.length - 1 ? DOCS_FLAT[i + 1] : null;
  return (
    <article className="min-w-0">
      <div className="text-[12.5px] text-muted">
        <Link href="/docs" className="hover:text-text">Docs</Link>
        {here && <span> / {here.group}</span>}
      </div>
      <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.02em] md:text-[34px]">{title}</h1>
      {lead && <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-muted">{lead}</p>}
      <div className="mt-8 space-y-10">{children}</div>
      <nav aria-label="Pagination" className="mt-14 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={prev.href} className="group rounded-[8px] border border-border p-4 hover:border-border-strong">
            <div className="flex items-center gap-1 text-[12px] text-muted"><ArrowLeft className="size-3.5" aria-hidden /> Previous</div>
            <div className="mt-1 text-[14px] font-medium group-hover:underline">{prev.title}</div>
          </Link>
        ) : <span />}
        {next && (
          <Link href={next.href} className="group rounded-[8px] border border-border p-4 text-right hover:border-border-strong">
            <div className="flex items-center justify-end gap-1 text-[12px] text-muted">Next <ArrowRight className="size-3.5" aria-hidden /></div>
            <div className="mt-1 text-[14px] font-medium group-hover:underline">{next.title}</div>
          </Link>
        )}
      </nav>
    </article>
  );
}

/** A titled section with a linkable anchor. */
export function DocSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="group text-[21px] font-semibold tracking-[-0.015em]">
        {title}
        <a href={`#${id}`} className="ml-2 text-faint opacity-0 transition-opacity group-hover:opacity-100" aria-label={`Link to ${title}`}>#</a>
      </h2>
      <div className="mt-3 space-y-4 text-[14.5px] leading-relaxed text-muted [&_strong]:font-medium [&_strong]:text-text">{children}</div>
    </section>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-2 text-[16px] font-semibold text-text">{children}</h3>;
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-faint">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

export function Steps({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <ol className="space-y-3">
      {items.map(([t, d], i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-[11.5px] font-semibold text-text">{i + 1}</span>
          <div><div className="font-medium text-text">{t}</div><div>{d}</div></div>
        </li>
      ))}
    </ol>
  );
}

export function Callout({ tone = "info", title, children }: { tone?: "info" | "warning"; title?: string; children: ReactNode }) {
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <div className={cn("flex gap-3 rounded-[8px] border px-4 py-3 text-[13.5px]", tone === "warning" ? "border-warning/30 bg-warning-bg" : "border-info/25 bg-info-bg")}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "warning" ? "text-warning" : "text-info")} aria-hidden />
      <div>{title && <div className="font-medium text-text">{title}</div>}<div className="text-muted">{children}</div></div>
    </div>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-[4px] bg-surface-2 px-1 py-px font-mono text-[0.88em] text-text">{children}</code>;
}

/** Simple table: header row + body rows. */
export function DocTable({ head, rows, mono = [] }: { head: string[]; rows: ReactNode[][]; mono?: number[] }) {
  return (
    <div className="scroll-thin overflow-x-auto rounded-[8px] border border-border">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead className="border-b border-border bg-surface-2 text-left text-[12px] text-text"><tr>{head.map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {r.map((c, j) => <td key={j} className={cn("px-4 py-2.5 align-top", j === 0 ? "text-text" : "text-muted", mono.includes(j) && "font-mono text-[12.5px]")}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Grid of links to other doc pages. */
export function DocCards({ items }: { items: { href: string; title: string; body: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((c) => (
        <Link key={c.href} href={c.href} className="group rounded-[8px] border border-border bg-surface p-4 hover:border-border-strong">
          <div className="flex items-center justify-between text-[14px] font-medium text-text">{c.title}<ArrowRight className="size-3.5 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden /></div>
          <p className="mt-1 text-[13px] text-muted">{c.body}</p>
        </Link>
      ))}
    </div>
  );
}
