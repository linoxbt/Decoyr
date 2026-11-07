import Link from "next/link";
import { cn } from "@/components/ui/cn";

export function Mark({ className }: { className?: string }) {
  // Simple geometric mark: an outlined square (the real company) offset by a filled square (the decoy).
  return (
    <svg viewBox="0 0 20 20" className={cn("size-5", className)} aria-hidden>
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="7.5" y="7.5" width="11" height="11" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function Logo({ href = "/", compact }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold tracking-[0.08em] text-[13px]" aria-label="Decoyr home">
      <Mark />
      {!compact && <span>DECOYR</span>}
    </Link>
  );
}
