import type { TraceEvent } from "../schemas";

export function relativeTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function clock(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function dateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function duration(ms?: number | null): string {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function shortHash(h?: string | null, n = 12): string {
  if (!h) return "—";
  return h.length > n ? `${h.slice(0, n)}…` : h;
}

export function bytes(n?: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

export type TraceFilter = "all" | "agent" | "tools" | "files" | "network" | "policy" | "findings";

export const TRACE_FILTERS: { id: TraceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "agent", label: "Agent" },
  { id: "tools", label: "Tools" },
  { id: "files", label: "Files" },
  { id: "network", label: "Network" },
  { id: "policy", label: "Policy" },
  { id: "findings", label: "Findings" },
];

export function matchesFilter(e: TraceEvent, f: TraceFilter): boolean {
  switch (f) {
    case "all":
      return true;
    case "agent":
      return e.actor === "agent" || e.type.startsWith("model.");
    case "tools":
      return e.type.startsWith("tool.");
    case "files":
      return (
        e.type.startsWith("artifact.") ||
        (e.capability ?? "").startsWith("repo.") ||
        (e.capability ?? "").startsWith("artifact.") ||
        e.type.startsWith("fs.")
      );
    case "network":
      return e.type.startsWith("net.") || (e.capability ?? "").startsWith("net.") || e.type === "honeytoken.egress";
    case "policy":
      return e.actor === "guard" || e.decision === "denied" || e.type.startsWith("guard.") || e.type === "tool.allow" || e.type === "tool.deny" || e.type === "net.allow" || e.type === "net.deny";
    case "findings":
      return !!e.findingId || e.type.startsWith("finding.") || e.type.startsWith("honeytoken.") || e.type === "injection.delivered" || e.flags.includes("attack_path") || e.type.startsWith("assertion.");
  }
}

export function isUnsafe(e: TraceEvent): boolean {
  return (
    e.type === "honeytoken.touch" ||
    e.type === "honeytoken.egress" ||
    (e.flags.includes("attack_path") && e.decision === "allowed") ||
    (e.flags.includes("adversarial") && e.decision === "allowed")
  );
}

export type Tone = "success" | "danger" | "warning" | "blocked" | "info" | "neutral";

export function eventTone(e: TraceEvent): Tone {
  if (e.type === "assertion.pass") return "success";
  if (e.type === "assertion.fail") return "danger";
  if (e.decision === "denied") return "blocked";
  if (isUnsafe(e)) return "danger";
  if (e.type === "injection.delivered" || e.flags.includes("injection")) return "warning";
  if (e.type === "artifact.created") return "success";
  if (e.decision === "error" || e.type.endsWith(".error") || e.type === "run.failed") return "danger";
  if (e.type === "process.kill") return "warning";
  return "neutral";
}

export function maskSecrets(v: unknown): unknown {
  // Defense in depth: server already masks honeytoken values. Never show anything that looks like a token in full.
  if (typeof v === "string") {
    return v.replace(/\b(acme_[a-z]+_)[A-Za-z0-9_\-]{6,}/g, "$1••••••••").replace(/\b(AKIA)[A-Z0-9]{8,}/g, "$1••••••••");
  }
  if (Array.isArray(v)) return v.map(maskSecrets);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, maskSecrets(x)]));
  return v;
}
