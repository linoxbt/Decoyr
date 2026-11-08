"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { FlaskConical, Bot, Network, Settings, Menu, X } from "lucide-react";
import { PreparedDemoButton } from "@/components/trial/PreparedDemoButton";
import { Logo } from "./Logo";
import { cn } from "@/components/ui/cn";
import { useSystem } from "@/lib/api/hooks";

const NAV = [
  { href: "/app/trials", label: "Trials", icon: FlaskConical },
  { href: "/app/agents", label: "Agents", icon: Bot },
  { href: "/docs/architecture", label: "Architecture", icon: Network },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

function NavList({ onNavigate, collapsedOnLg }: { onNavigate?: () => void; collapsedOnLg?: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={label}
            className={cn(
              "flex h-8 items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] transition-colors duration-150",
              active ? "bg-surface-2 font-medium text-text" : "text-muted hover:bg-surface-2 hover:text-text",
              collapsedOnLg && "justify-center xl:justify-start",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className={cn(collapsedOnLg && "hidden xl:inline")}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SystemFoot() {
  const { data } = useSystem();
  if (!data) return null;
  return (
    <div className="hidden space-y-1 border-t border-border px-3 py-3 text-[11px] text-muted xl:block">
      <div className="flex items-center justify-between">
        <span>Inference</span>
        <span className={cn("font-medium", data.inference.mode === "vultr" ? "text-success" : "text-warning")}>{data.inference.mode === "vultr" ? "Vultr" : "Simulated"}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Sandbox</span>
        <span className="font-medium text-text">{data.sandbox.mode}</span>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[56px] shrink-0 flex-col border-r border-border bg-surface md:flex xl:w-[224px] no-print">
        <div className="flex h-12 items-center justify-center border-b border-border px-3 xl:justify-start">
          <span className="xl:hidden"><Logo href="/app/trials" compact /></span>
          <span className="hidden xl:inline"><Logo href="/app/trials" /></span>
        </div>
        <div className="flex-1 p-2">
          <NavList collapsedOnLg />
          <div className="mt-4 flex justify-center xl:block">
            <PreparedDemoButton label="Prepared demo" size="sm" className="w-full" iconOnlyBelowXl />
          </div>
        </div>
        <SystemFoot />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 items-center justify-between border-b border-border bg-surface px-3 md:hidden no-print">
          <Logo href="/app/trials" />
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger className="rounded p-1.5 hover:bg-surface-2" aria-label="Open navigation">
              <Menu className="size-5" />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20" />
              <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[240px] border-r border-border bg-surface p-3">
                <div className="mb-3 flex items-center justify-between">
                  <Dialog.Title asChild>
                    <span><Logo href="/app/trials" /></span>
                  </Dialog.Title>
                  <Dialog.Close className="rounded p-1 hover:bg-surface-2" aria-label="Close navigation">
                    <X className="size-4" />
                  </Dialog.Close>
                </div>
                <Dialog.Description className="sr-only">Primary navigation</Dialog.Description>
                <NavList onNavigate={() => setOpen(false)} />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions, breadcrumb }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumb?: ReactNode }) {
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur-0 md:px-6">
      {breadcrumb && <div className="mb-0.5 text-[12px] text-muted">{breadcrumb}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h1>
          {description && <p className="text-[13px] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
