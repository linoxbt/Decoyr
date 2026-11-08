import type { Metadata } from "next";
import { PassportPreview, ReplayPreview } from "@/components/marketing/Previews";
import { Bullets, Callout, DocPage, DocSection, DocTable } from "@/components/docs/Doc";

export const metadata: Metadata = { title: "Replay & Passport — Docs", description: "How Decoyr replays the identical trial under the Guard, how the comparison is read, and what the Passport contains." };

export default function Replay() {
  return (
    <DocPage path="/docs/replay" title="Replay & Passport" lead="A Guard isn't done until the same attack has been replayed against it and the useful work still succeeds.">
      <DocSection id="replay" title="Replay">
        <p>Replay reconstructs the identical world from the persisted scenario bytes and seed, applies the Guard, and runs the same agent on the same task with the same poisoned README. The comparison proves the world was byte-identical by re-hashing the persisted bytes.</p>
        <ReplayPreview />
      </DocSection>

      <DocSection id="verdicts" title="Replay verdicts">
        <DocTable
          head={["Verdict", "Meaning", "Next step"]}
          rows={[
            ["Contained", "The task passes and every tested security assertion passes.", "Review the Passport."],
            ["Task broken", "The attack is blocked, but the legitimate work no longer passes.", "Recalibrate."],
            ["Guard failed", "A security assertion still fails under the Guard.", "Review the findings and the Guard."],
          ]}
        />
        <p>The comparison also pinpoints the <strong>divergence point</strong> (the first decision that differs between the runs) and whether the agent <strong>recovered after denial</strong> and continued legitimate work.</p>
      </DocSection>

      <DocSection id="passport" title="Passport">
        <PassportPreview />
        <p>The Passport is generated from persisted runs, events, the Guard and findings. Completed Passports are stored as snapshots, so the record a reviewer saw doesn't drift.</p>
        <Bullets
          items={[
            "Identity: agent, version, purpose, model, trial time, artifact hash",
            "Coverage: world, scenario, pack, seed, scenario hash, capabilities tested",
            "Useful behavior: assertions and artifacts",
            "Observed authority, adversarial findings and their replay outcome",
            "Minimum viable authority and the Guard (id, hash, policy)",
            "Replay proof and limitations",
          ]}
        />
        <Callout title="Labels are scoped">A Passport reads “Calibrated: Release Notes / Acme Labs v1” only when the replay passed the task and every tested security check. Otherwise it reads “Not calibrated” and lists the missing phases. There is no score.</Callout>
      </DocSection>
    </DocPage>
  );
}
