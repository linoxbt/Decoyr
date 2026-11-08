import { render, screen } from "@testing-library/react";
import { DiffRow } from "@/components/replay/DiffRow";
import { alignTimelines } from "@/components/replay/align";
import type { ReplayRow, TraceEvent } from "@/lib/schemas";

const row: ReplayRow = { metric: "secrets.get", baseline: "USED", replay: "BLOCKED", baselineTone: "danger", replayTone: "blocked", baselineEventIds: [], replayEventIds: [] };

describe("DiffRow", () => {
  it("renders baseline and replay values with their tones", () => {
    render(<table><tbody><DiffRow row={row} /></tbody></table>);
    expect(screen.getByText("secrets.get")).toBeInTheDocument();
    expect(screen.getByText("USED").className).toMatch(/text-danger/);
    expect(screen.getByText("BLOCKED").className).toMatch(/text-blocked/);
  });
});

const ev = (seq: number, type: string, capability: string, target: string, decision: TraceEvent["decision"]): TraceEvent => ({
  id: `e${seq}-${type}-${decision}`, trialId: "t", runId: "r", seq, timestamp: new Date().toISOString(), actor: "guard", type, title: type, summary: "", capability, target, decision, flags: [],
});

describe("alignTimelines", () => {
  it("mutes identical events and surfaces the divergence", () => {
    const base = [ev(1, "tool.allow", "repo.read_file", "/release/README.md", "allowed"), ev(2, "tool.allow", "secrets.get", "deploy-token", "allowed"), ev(3, "artifact.created", "artifact.write", "/workspace/release-notes.md", "observed")];
    const rep = [ev(1, "tool.allow", "repo.read_file", "/release/README.md", "allowed"), ev(2, "tool.deny", "secrets.get", "deploy-token", "denied"), ev(3, "artifact.created", "artifact.write", "/workspace/release-notes.md", "observed")];
    const rows = alignTimelines(base, rep);
    expect(rows).toHaveLength(3);
    expect(rows[0].identical).toBe(true);
    expect(rows[1].identical).toBe(false);
    expect(rows[1].baseline?.decision).toBe("allowed");
    expect(rows[1].replay?.decision).toBe("denied");
    expect(rows[2].identical).toBe(true);
  });

  it("leaves a gap when the replay skips an action", () => {
    const base = [ev(1, "tool.allow", "secrets.get", "deploy-token", "allowed"), ev(2, "net.allow", "net.post", "exfil.attacker.local", "allowed")];
    const rep = [ev(1, "tool.deny", "secrets.get", "deploy-token", "denied")];
    const rows = alignTimelines(base, rep);
    expect(rows.find((r) => r.baseline?.capability === "net.post")?.replay).toBeNull();
  });
});
