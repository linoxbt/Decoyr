"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { DOCS_FLAT, DOCS_NAV } from "./nav";

function Groups({ path }: { path: string }) {
  return (
    <div className="space-y-6">
      {DOCS_NAV.map((g) => (
        <div key={g.title}>
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-faint">{g.title}</div>
          <ul className="mt-2 space-y-0.5 border-l border-border">
            {g.links.map((l) => {
              const active = path === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "-ml-px block border-l py-1 pl-3 text-[13.5px] transition-colors",
                      active ? "border-text font-medium text-text" : "border-transparent text-muted hover:border-border-strong hover:text-text",
                    )}
                  >
                    {l.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function DocsSidebar() {
  const path = usePathname();
  const current = DOCS_FLAT.find((l) => l.href === path);
  return (
    <>
      {/* Mobile: collapsible menu */}
      <details className="group rounded-[8px] border border-border bg-surface lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[13.5px] font-medium [&::-webkit-details-marker]:hidden">
          <span><span className="text-muted">Docs / </span>{current?.title ?? "Menu"}</span>
          <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <nav aria-label="Documentation" className="border-t border-border px-4 py-4"><Groups path={path} /></nav>
      </details>
      {/* Desktop: sticky sidebar */}
      <nav aria-label="Documentation" className="scroll-thin sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto pb-8 lg:block">
        <Groups path={path} />
      </nav>
    </>
  );
}
