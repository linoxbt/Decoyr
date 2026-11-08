import Link from "next/link";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/shell/Logo";
import { PreparedDemoButton } from "@/components/trial/PreparedDemoButton";

export const NAV = [
  { href: "/product", label: "Product" },
  { href: "/use-cases", label: "Use cases" },
  { href: "/docs", label: "Docs" },
  { href: "/about", label: "About" },
];

const FOOTER: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/product", label: "Overview" },
      { href: "/use-cases", label: "Use cases" },
      { href: "/app/trials", label: "Trials console" },
      { href: "/about", label: "About" },
    ],
  },
  {
    title: "Docs",
    links: [
      { href: "/docs", label: "Introduction" },
      { href: "/docs/quickstart", label: "Quickstart" },
      { href: "/docs/how-it-works", label: "How it works" },
      { href: "/docs/scenarios", label: "Scenarios" },
    ],
  },
  {
    title: "Trust & reference",
    links: [
      { href: "/docs/security", label: "Security model" },
      { href: "/docs/architecture", label: "Architecture" },
      { href: "/docs/api", label: "API reference" },
      { href: "/docs/faq", label: "FAQ" },
    ],
  },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-0.5 text-[13px] lg:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded px-2.5 py-1.5 text-muted transition-colors hover:text-text">{n.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-1 text-[13px]">
            <Link href="/app/trials" className="hidden rounded px-2.5 py-1.5 text-muted hover:text-text sm:inline">Trials</Link>
            <span className="hidden sm:inline"><PreparedDemoButton label="Test an agent" variant="primary" size="sm" /></span>
            {/* Mobile menu: native <details>, works without JavaScript. */}
            <details className="group relative lg:hidden">
              <summary className="flex size-8 cursor-pointer list-none items-center justify-center rounded-[6px] border border-border text-muted hover:text-text [&::-webkit-details-marker]:hidden" aria-label="Open menu">
                <Menu className="size-4" aria-hidden />
              </summary>
              <nav aria-label="Mobile" className="absolute right-0 mt-2 w-56 rounded-[8px] border border-border bg-surface p-1.5 shadow-lg">
                {[...NAV, { href: "/docs/how-it-works", label: "How it works" }, { href: "/docs/security", label: "Security model" }, { href: "/app/trials", label: "Trials console" }].map((n) => (
                  <Link key={n.href} href={n.href} className="block rounded-[6px] px-3 py-2 text-[13px] text-text hover:bg-surface-2">{n.label}</Link>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:px-6 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              Agent trust calibration. Give your AI agent a fake company before you give it yours.
            </p>
            <p className="mt-3 text-[12px] text-faint">Every file, message, credential and host in a Decoyr world is synthetic. Nothing leaves the sandbox.</p>
          </div>
          {FOOTER.map((col) => (
            <div key={col.title}>
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{col.title}</div>
              <ul className="mt-3 space-y-2 text-[13px]">
                {col.links.map((l) => (
                  <li key={l.href}><Link href={l.href} className="text-text/80 hover:text-text hover:underline">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-[12px] text-muted md:px-6">
            <span>© {new Date().getFullYear()} Decoyr · Built for Vultr Agent Rush — Blast Radius Zero</span>
            <span>Vultr Cloud Compute · Vultr Serverless Inference · MIT licensed</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
