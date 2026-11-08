import type { Metadata } from "next";
import { AuthorityPreview, GUARD_JSON, Pill } from "@/components/marketing/Previews";
import { CodeFrame } from "@/components/marketing/Section";
import { Callout, Code, DocPage, DocSection, DocTable, Steps } from "@/components/docs/Doc";

export const metadata: Metadata = { title: "Authority & Guard — Docs", description: "How Decoyr derives Minimum Viable Authority from baseline evidence and compiles it into a decoyr.guard.v1 policy." };

export default function Authority() {
  return (
    <DocPage path="/docs/authority" title="Authority & Guard" lead="Decoyr derives the Minimum Viable Authority from what the agent did in the baseline, then compiles it into a policy enforced in code.">
      <AuthorityPreview />

      <DocSection id="derivation" title="How authority is derived">
        <Steps
          items={[
            ["Collect calls", "Every baseline tool.request is paired with its decision event by correlation ID."],
            ["Separate the paths", "Calls that accessed a honeycredential, reached an adversarial host or carried a credential are on the attack path. Reads of decoy files are scope creep. The read that delivered untrusted content is not an attack action; it may be a required call."],
            ["Classify", "Each requested or observed capability gets one class, anchored by the scenario's required capabilities."],
            ["Narrow", "Allowed capabilities are constrained to the narrowest scope the legitimate calls used."],
          ]}
        />
      </DocSection>

      <DocSection id="classes" title="Capability classes">
        <DocTable
          head={["Class", "Decision", "Meaning"]}
          rows={[
            [<Pill key="r" tone="success">required</Pill>, "allow", "Needed by the task and used on the legitimate path."],
            [<Pill key="c" tone="blocked">constrained</Pill>, "allow", "Required, and narrowed to the exact scope used, e.g. /release/** instead of the whole repository."],
            [<Pill key="u">unnecessary</Pill>, "deny", "Used and harmless, but the task completes without it."],
            [<Pill key="d" tone="danger">dangerous</Pill>, "deny", "Used only on the attack path."],
            [<Pill key="t" tone="warning">untested</Pill>, "deny", "Requested but never exercised, so its safe use is unproven."],
          ]}
        />
        <p>In the prepared demo this yields <strong>8 requested → 4 required; 2 narrowed; 4 removed</strong>.</p>
      </DocSection>

      <DocSection id="guard" title="The Guard policy">
        <p>A Guard is a JSON policy in the <Code>decoyr.guard.v1</Code> format. Anything not explicitly allowed is denied. Each calibration stores a new, hashed version and sets it on the trial.</p>
        <CodeFrame title="guard.json (prepared demo)">{GUARD_JSON}</CodeFrame>
        <DocTable
          head={["Constraint", "Matches when"]}
          mono={[0]}
          rows={[
            ["path_prefix", "The path starts with the prefix; /release/ also matches /release itself."],
            ["paths", "The path is exactly one of the listed paths."],
            ["path_glob", "The path matches the glob."],
            ["repo", "The repository equals the value."],
            ["hosts", "The host is in the list (net.fetch)."],
            ["names", "The secret name is in the list."],
          ]}
        />
      </DocSection>

      <DocSection id="enforcement" title="Where it's enforced">
        <DocTable
          head={["Rule", "Enforced at"]}
          rows={[
            ["allow / deny mcp_tools, constraints", "MCP middleware, before the tool handler runs"],
            ["limits.max_tool_calls", "MCP middleware (rule limits.max_tool_calls)"],
            ["allow.network GET / POST", "Egress proxy, per host"],
            ["wall clock, memory, PIDs", "Container runtime"],
          ]}
        />
        <Callout title="Fail closed">If the policy service errors or can't be reached, mcp-city and the egress proxy deny the call.</Callout>
      </DocSection>

      <DocSection id="calibration" title="Static check and recalibration">
        <p><strong>Static check.</strong> Before replay, every baseline call is re-evaluated under the candidate Guard: legitimate calls must be allowed and attack calls denied (4/4 and 2/2 in the prepared demo). The result is recorded as a calibration iteration.</p>
        <p><strong>Recalibration.</strong> If a replay breaks the task, calibrating again promotes the narrowest denied capability that isn't dangerous (widening an existing constraint first) and compiles a new Guard version. Dangerous capabilities stay denied.</p>
        <p><strong>Rationale.</strong> Each class carries a plain-language rationale. With a Vultr key configured it is written by a trusted control-plane model; the classifications themselves are always deterministic.</p>
      </DocSection>
    </DocPage>
  );
}
