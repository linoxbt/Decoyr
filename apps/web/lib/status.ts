import type { AuthorityClass, CheckResult, Conclusion, TrialStatus } from "./schemas";
import type { Tone } from "./formatting";

export const STATUS_META: Record<TrialStatus, { label: string; tone: Tone; description: string }> = {
  draft: { label: "Draft", tone: "neutral", description: "World prepared. Baseline not started." },
  preparing: { label: "Preparing", tone: "info", description: "Creating isolated network and candidate container." },
  running: { label: "Running", tone: "info", description: "Baseline running inside the synthetic enterprise." },
  observed: { label: "Observed", tone: "neutral", description: "No tested security assertion failed in this run." },
  compromised: { label: "Compromised", tone: "danger", description: "Compromised in tested scenario." },
  calibrating: { label: "Calibrating", tone: "info", description: "Deriving Minimum Viable Authority from evidence." },
  guarded: { label: "Guarded", tone: "blocked", description: "Guard compiled. Replay not yet run." },
  replaying: { label: "Replaying", tone: "info", description: "Same seed, same task, same attack — with Guard." },
  contained: { label: "Contained", tone: "success", description: "Contained for this tested scope." },
  failed: { label: "Failed", tone: "danger", description: "The trial could not complete. Evidence is preserved." },
};

export const CONCLUSION_META: Record<Conclusion, { label: string; tone: Tone }> = {
  not_tested: { label: "Not tested", tone: "neutral" },
  compromised: { label: "Compromised in tested scenario", tone: "danger" },
  no_finding: { label: "No tested security assertion failed in this run", tone: "neutral" },
  guarded: { label: "Guarded — replay pending", tone: "blocked" },
  contained: { label: "Contained for this tested scope", tone: "success" },
  guard_failed: { label: "Guard failed this scenario", tone: "danger" },
  failed: { label: "Trial failed", tone: "danger" },
};

export const CHECK_META: Record<CheckResult, { label: string; tone: Tone }> = {
  pass: { label: "PASS", tone: "success" },
  fail: { label: "FAIL", tone: "danger" },
  pending: { label: "—", tone: "neutral" },
};

export const AUTHORITY_META: Record<AuthorityClass, { label: string; tone: Tone; meaning: string }> = {
  required: { label: "Required", tone: "success", meaning: "Needed for legitimate success" },
  constrained: { label: "Constrained", tone: "info", meaning: "Needed only for a narrow path/resource/domain" },
  unnecessary: { label: "Unnecessary", tone: "warning", meaning: "Not needed for the task" },
  dangerous: { label: "Dangerous", tone: "danger", meaning: "Participated in the attack" },
  untested: { label: "Untested", tone: "neutral", meaning: "Not exercised by this trial — no safety claim" },
};

export const toneClasses: Record<Tone, { text: string; bg: string; border: string; dot: string }> = {
  success: { text: "text-success", bg: "bg-success-bg", border: "border-success/30", dot: "bg-success" },
  danger: { text: "text-danger", bg: "bg-danger-bg", border: "border-danger/30", dot: "bg-danger" },
  warning: { text: "text-warning", bg: "bg-warning-bg", border: "border-warning/30", dot: "bg-warning" },
  blocked: { text: "text-blocked", bg: "bg-blocked-bg", border: "border-blocked/30", dot: "bg-blocked" },
  info: { text: "text-info", bg: "bg-info-bg", border: "border-info/30", dot: "bg-info" },
  neutral: { text: "text-muted", bg: "bg-surface-2", border: "border-border", dot: "bg-faint" },
};

/** Trial-phase-aware primary action. */
export function nextPhase(status: TrialStatus): "start" | "calibrate" | "replay" | "passport" | "watch" | "none" {
  switch (status) {
    case "draft":
      return "start";
    case "preparing":
    case "running":
    case "replaying":
    case "calibrating":
      return "watch";
    case "compromised":
    case "observed":
      return "calibrate";
    case "guarded":
      return "replay";
    case "contained":
      return "passport";
    case "failed":
      return "none";
  }
}
