"use client";
import { useState } from "react";
import { FileText } from "lucide-react";
import { Markdown } from "@/components/ui/Markdown";
import { bytes, shortHash } from "@/lib/formatting";
import type { Artifact } from "@/lib/schemas";
import { cn } from "@/components/ui/cn";

export function ArtifactViewer({ artifact, className, maxHeight = 420 }: { artifact: Artifact; className?: string; maxHeight?: number }) {
  const [mode, setMode] = useState<"rendered" | "source">("rendered");
  const isMd = artifact.path.endsWith(".md");
  return (
    <div className={cn("rounded-[6px] border border-border bg-surface", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-3.5 text-muted" aria-hidden />
          <span className="mono truncate text-[12.5px] font-medium">{artifact.path}</span>
          <span className="text-[11.5px] text-faint">{bytes(artifact.size)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="mono text-[11px] text-muted" title={artifact.sha256}>sha256 {shortHash(artifact.sha256, 10)}</span>
          {isMd && (
            <div className="flex rounded-[4px] border border-border text-[11.5px]" role="tablist">
              {(["rendered", "source"] as const).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("px-2 py-0.5", mode === m ? "bg-surface-2 font-medium" : "text-muted")}>
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="px-1 text-[11px] text-warning"><span className="px-2">Untrusted candidate output · rendered without HTML</span></div>
      <div className="overflow-auto px-4 py-3 text-[13px] scroll-thin" style={{ maxHeight }}>
        {isMd && mode === "rendered" ? <Markdown source={artifact.content} /> : <pre className="mono text-[12px] whitespace-pre-wrap break-words">{artifact.content}</pre>}
      </div>
    </div>
  );
}
