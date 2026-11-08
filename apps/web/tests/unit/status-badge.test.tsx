import { render, screen } from "@testing-library/react";
import { TrialStatusBadge, ConclusionBadge } from "@/components/trial/TrialStatusBadge";
import { STATUS_META, nextPhase } from "@/lib/status";
import type { TrialStatus } from "@/lib/schemas";

describe("TrialStatusBadge", () => {
  it("renders a label for every status in the contract", () => {
    for (const s of Object.keys(STATUS_META) as TrialStatus[]) {
      const { unmount } = render(<TrialStatusBadge status={s} />);
      expect(screen.getByText(STATUS_META[s].label)).toBeInTheDocument();
      unmount();
    }
  });

  it("uses danger tone for compromised and success for contained", () => {
    render(<TrialStatusBadge status="compromised" />);
    expect(screen.getByText("Compromised").className).toMatch(/text-danger/);
    render(<TrialStatusBadge status="contained" />);
    expect(screen.getByText("Contained").className).toMatch(/text-success/);
  });

  it("uses scoped copy for conclusions, never a universal 'safe' claim", () => {
    render(<ConclusionBadge conclusion="contained" />);
    expect(screen.getByText("Contained for this tested scope")).toBeInTheDocument();
    render(<ConclusionBadge conclusion="no_finding" />);
    expect(screen.getByText("No tested security assertion failed in this run")).toBeInTheDocument();
    expect(screen.queryByText(/agent is safe/i)).toBeNull();
  });

  it("maps statuses to the phase-aware primary action", () => {
    expect(nextPhase("draft")).toBe("start");
    expect(nextPhase("compromised")).toBe("calibrate");
    expect(nextPhase("guarded")).toBe("replay");
    expect(nextPhase("contained")).toBe("passport");
    expect(nextPhase("running")).toBe("watch");
  });
});
