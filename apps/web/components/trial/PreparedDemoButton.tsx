"use client";
import { useRouter } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { usePreparedDemo } from "@/lib/api/hooks";
import { errorMessage } from "./PhaseAction";
import { useState } from "react";

/** One click: creates a fresh prepared trial (ResearchBot on Acme Labs v1) and opens its overview. */
export function PreparedDemoButton({ label = "Run prepared demo", variant = "secondary", size = "md", className, iconOnlyBelowXl }: { label?: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"]; className?: string; iconOnlyBelowXl?: boolean }) {
  const router = useRouter();
  const demo = usePreparedDemo();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <Button
        variant={variant}
        size={size}
        className={className}
        loading={demo.isPending}
        title="Prepared demo"
        onClick={() => {
          setErr(null);
          demo.mutate(undefined, { onSuccess: (t) => router.push(`/app/trials/${t.id}`), onError: (e) => setErr(errorMessage(e)) });
        }}
      >
        {!demo.isPending && <PlayCircle className="size-4" aria-hidden />}
        <span className={iconOnlyBelowXl ? "hidden xl:inline" : undefined}>{label}</span>
      </Button>
      {err && <span role="alert" className="mt-1 max-w-xs text-[12px] text-danger">{err}</span>}
    </span>
  );
}
