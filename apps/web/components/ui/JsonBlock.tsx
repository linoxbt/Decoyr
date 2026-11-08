"use client";
import { useEffect, useState } from "react";
import { cn } from "./cn";

/** Lazy shiki highlighting with plain <pre> fallback. */
export function JsonBlock({ value, className, maxHeight = 480 }: { value: unknown; className?: string; maxHeight?: number }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import("shiki")
      .then(({ codeToHtml }) => codeToHtml(text, { lang: "json", theme: "github-light" }))
      .then((h) => alive && setHtml(h))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [text]);
  return (
    <div className={cn("shiki-wrap overflow-auto rounded-[6px] border border-border bg-surface scroll-thin", className)} style={{ maxHeight }}>
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="mono p-3 text-[12px] leading-[1.55] whitespace-pre">{text}</pre>
      )}
    </div>
  );
}

export function RawJson({ value }: { value: unknown }) {
  return <pre className="mono max-h-72 overflow-auto rounded-[4px] border border-border bg-surface-2 p-2 text-[11.5px] leading-[1.5] whitespace-pre-wrap break-all scroll-thin">{JSON.stringify(value, null, 2)}</pre>;
}
