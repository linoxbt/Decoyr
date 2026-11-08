"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "./Button";

export function CopyButton({ text, label = "Copy", size = "sm" }: { text: string; label?: string; size?: "sm" | "md" }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size={size}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {done ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {done ? "Copied" : label}
    </Button>
  );
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
