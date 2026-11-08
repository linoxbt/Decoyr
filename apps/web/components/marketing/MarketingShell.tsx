import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/shell/Logo";
import { PreparedDemoButton } from "@/components/trial/PreparedDemoButton";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <Logo />
          <nav aria-label="Main" className="flex items-center gap-1 text-[13px]">
            <Link href="/how-it-works" className="hidden rounded px-2.5 py-1.5 text-muted hover:text-text sm:inline">How it works</Link>
            <Link href="/architecture" className="hidden rounded px-2.5 py-1.5 text-muted hover:text-text sm:inline">Architecture</Link>
            <Link href="/app/trials" className="rounded px-2.5 py-1.5 text-muted hover:text-text">Trials</Link>
            <span className="ml-2"><PreparedDemoButton label="Test an agent" variant="primary" size="sm" /></span>
          </nav>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-[12px] text-muted md:px-6">
          <span>DECOYR · Agent Trust Calibration</span>
          <span>Built on Vultr Cloud Compute + Vultr Serverless Inference · MIT licensed</span>
        </div>
      </footer>
    </div>
  );
}
