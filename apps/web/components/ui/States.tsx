"use client";
import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RotateCw } from "lucide-react";
import { Button } from "./Button";
import { ApiError } from "@/lib/api/client";
import { cn } from "./cn";

export function Empty({ title, children, action, icon, className }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[8px] border border-dashed border-border-strong bg-surface px-6 py-10 text-center", className)}>
      <div className="mb-2 text-faint">{icon ?? <Inbox className="size-5" aria-hidden />}</div>
      <h3 className="text-[14px] font-semibold">{title}</h3>
      {children && <div className="mt-1 max-w-md text-[13px] text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title, className }: { error: unknown; onRetry?: () => void; title?: string; className?: string }) {
  const e = error as ApiError | Error | undefined;
  const ref = e instanceof ApiError ? e.referenceId : undefined;
  const status = e instanceof ApiError ? e.status : undefined;
  return (
    <div role="alert" className={cn("rounded-[8px] border border-danger/30 bg-danger-bg px-4 py-3 text-[13px]", className)}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-danger">{title ?? "Request failed"}</div>
          <div className="mt-0.5 text-text">{e?.message ?? "Unknown error"}</div>
          {(ref || status) && (
            <div className="mt-1 text-[12px] text-muted">
              {status ? `HTTP ${status}` : null}
              {ref ? <> · reference <span className="mono">{ref}</span></> : null}
            </div>
          )}
        </div>
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            <RotateCw className="size-3.5" aria-hidden /> Retry
          </Button>
        )}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[4px] bg-surface-2", className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-6 w-64" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
