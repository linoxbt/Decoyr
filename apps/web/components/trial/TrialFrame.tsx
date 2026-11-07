"use client";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { useDuplicateTrial, useTrial } from "@/lib/api/hooks";
import { TrialStatusBadge } from "./TrialStatusBadge";
import { PhaseAction, StopButton, errorMessage } from "./PhaseAction";
import { ErrorState, Skeleton, Empty } from "@/components/ui/States";
import { cn } from "@/components/ui/cn";
import { ApiError } from "@/lib/api/client";
import { buttonClass } from "@/components/ui/Button";

export function useTrialId() {
  const p = useParams<{ trialId: string }>();
  return p.trialId;
}

export function TrialFrame({ children }: { children: ReactNode }) {
  const id = useTrialId();
  const path = usePathname();
  const router = useRouter();
  const { data: trial, error, refetch, isLoading } = useTrial(id);
  const dup = useDuplicateTrial(id);
  const [actionError, setActionError] = useState<string | null>(null);
  const base = `/app/trials/${id}`;

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="p-6">
        <Empty title="Trial not found" action={<Link href="/app/trials" className={buttonClass("secondary")}>Back to trials</Link>}>
          This trial does not exist or was removed by a demo reset.
        </Empty>
      </div>
    );
  }

  const latestRun = trial?.activeRunId ?? trial?.runs[trial.runs.length - 1]?.id ?? null;
  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/world`, label: "World" },
    { href: latestRun ? `${base}/run/${latestRun}` : `${base}/run/latest`, match: `${base}/run`, label: "Live Run" },
    { href: `${base}/findings`, label: "Findings", count: trial?.findingCount },
    { href: `${base}/authority`, label: "Authority" },
    { href: `${base}/guard`, label: "Guard" },
    { href: `${base}/replay`, label: "Replay" },
    { href: `${base}/passport`, label: "Passport" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-30 border-b border-border bg-surface no-print">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-2.5 md:px-6">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-muted">
              <Link href="/app/trials" className="hover:text-text">Trials</Link>
              <ChevronRight className="size-3" aria-hidden />
              <span className="mono">{trial ? trial.shortId : "…"}</span>
            </nav>
            <div className="flex items-center gap-2">
              {trial ? <h1 className="truncate text-[16px] font-semibold tracking-[-0.01em]">{trial.name}</h1> : <Skeleton className="h-5 w-64" />}
              {trial && <TrialStatusBadge status={trial.status} />}
            </div>
          </div>
          {trial && (
            <div className="flex items-center gap-2">
              <StopButton trial={trial} />
              <PhaseAction trial={trial} onError={(e) => setActionError(errorMessage(e))} />
              <DropdownMenu.Root>
                <DropdownMenu.Trigger className={buttonClass("ghost", "md", "px-2")} aria-label="More trial actions">
                  <MoreHorizontal className="size-4" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-[200px] rounded-[6px] border border-border bg-surface p-1 text-[13px] shadow-sm">
                    <DropdownMenu.Item className="cursor-pointer rounded px-2 py-1.5 outline-none data-[highlighted]:bg-surface-2" onSelect={() => dup.mutate(undefined, { onSuccess: (t) => router.push(`/app/trials/${t.id}`) })}>
                      Duplicate trial
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className="cursor-pointer rounded px-2 py-1.5 outline-none data-[highlighted]:bg-surface-2" onSelect={() => router.push(`${base}/passport`)}>
                      Export Passport JSON
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className="cursor-pointer rounded px-2 py-1.5 outline-none data-[highlighted]:bg-surface-2" onSelect={() => router.push(`/app/settings#reset`)}>
                      Reset demo (team)
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          )}
        </div>
        <nav aria-label="Trial sections" className="mt-1.5 flex gap-0.5 overflow-x-auto px-3 md:px-5 scroll-thin">
          {tabs.map((t) => {
            const active = t.exact ? path === t.href : path.startsWith(t.match ?? t.href);
            return (
              <Link
                key={t.label}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-[13px] whitespace-nowrap transition-colors duration-150",
                  active ? "border-text font-medium text-text" : "border-transparent text-muted hover:text-text",
                )}
              >
                {t.label}
                {!!t.count && <span className="rounded-[3px] bg-danger-bg px-1 text-[11px] font-semibold text-danger">{t.count}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
      {(actionError || (error && !(error instanceof ApiError && error.status === 404))) && (
        <div className="px-4 pt-3 md:px-6">
          {actionError ? (
            <ErrorState error={new Error(actionError)} title="Action failed" onRetry={() => setActionError(null)} />
          ) : (
            <ErrorState error={error} onRetry={() => refetch()} title="Could not load trial" />
          )}
        </div>
      )}
      <div className="flex-1">{isLoading ? <div className="p-6"><Skeleton className="h-40" /></div> : children}</div>
    </div>
  );
}
