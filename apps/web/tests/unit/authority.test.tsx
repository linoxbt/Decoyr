import { render, screen, within, fireEvent } from "@testing-library/react";
import { AuthorityMatrix } from "@/components/authority/AuthorityMatrix";
import type { AuthorityCapability } from "@/lib/schemas";

const cap = (p: Partial<AuthorityCapability> & Pick<AuthorityCapability, "name" | "classification">): AuthorityCapability => ({
  id: p.name,
  requested: true,
  observed: true,
  observedCount: 1,
  evidenceEventIds: [],
  rationale: "",
  baselineDecision: "allowed",
  proposedDecision: "allow",
  findingIds: [],
  targets: [],
  ...p,
});

const caps: AuthorityCapability[] = [
  cap({ name: "secrets.get", classification: "dangerous", proposedDecision: "deny", findingIds: ["f1"] }),
  cap({ name: "repo.read_file", classification: "constrained", constraintLabel: "/release/**", observedCount: 3 }),
  cap({ name: "repo.list_files", classification: "required" }),
  cap({ name: "messages.search", classification: "untested", observed: false, observedCount: 0, baselineDecision: "not_used", proposedDecision: "deny" }),
  cap({ name: "docs.search", classification: "unnecessary", proposedDecision: "deny" }),
];

describe("AuthorityMatrix", () => {
  it("distinguishes required, constrained, unnecessary, dangerous and untested", () => {
    render(<AuthorityMatrix capabilities={caps} />);
    expect(within(screen.getByTestId("cap-repo.list_files")).getByText("Required")).toBeInTheDocument();
    const constrained = screen.getByTestId("cap-repo.read_file");
    expect(within(constrained).getByText("Constrained")).toBeInTheDocument();
    expect(within(constrained).getAllByText("/release/**").length).toBeGreaterThan(0);
    expect(within(screen.getByTestId("cap-docs.search")).getByText("Unnecessary")).toBeInTheDocument();
    const dangerous = screen.getByTestId("cap-secrets.get");
    expect(within(dangerous).getByText("Dangerous")).toBeInTheDocument();
    expect(within(dangerous).getByText("deny")).toBeInTheDocument();
    const untested = screen.getByTestId("cap-messages.search");
    expect(within(untested).getByText("Untested")).toBeInTheDocument();
    expect(within(untested).getByText("Not exercised by this trial")).toBeInTheDocument();
  });

  it("orders required first and untested last", () => {
    render(<AuthorityMatrix capabilities={caps} />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveAttribute("data-testid", "cap-repo.list_files");
    expect(rows[rows.length - 1]).toHaveAttribute("data-testid", "cap-messages.search");
  });

  it("reports the clicked cell for evidence inspection", () => {
    const onSelect = vi.fn();
    render(<AuthorityMatrix capabilities={caps} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "secrets.get classification" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ column: "classification", capability: expect.objectContaining({ name: "secrets.get" }) }));
  });
});
