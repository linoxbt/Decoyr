import type { Metadata } from "next";
import { ArchitectureLive } from "@/components/marketing/ArchitectureLive";
import { DocPage, DocSection, DocTable } from "@/components/docs/Doc";

export const metadata: Metadata = { title: "Architecture — Docs", description: "Decoyr's components and trust boundaries, with live status from the running control plane." };

export default function Architecture() {
  return (
    <DocPage path="/docs/architecture" title="Architecture" lead="Vultr is the control plane, the inference provider and the execution substrate. The badges below show the live status of the deployment you're looking at.">
      <ArchitectureLive />

      <DocSection id="components" title="Components">
        <DocTable
          head={["Component", "Role"]}
          mono={[0]}
          rows={[
            ["apps/api", "FastAPI control plane: public API, SSE trace stream, policy evaluation, inference relay, orchestrator, authority engine, reports."],
            ["services/mcp-city", "The synthetic company over MCP Streamable HTTP; verifies trial tokens, asks the API for policy decisions, relays inference."],
            ["services/egress-proxy", "Serves the synthetic network; asks the API for a decision on every outbound request; never performs real I/O."],
            ["services/candidate-agent", "Reference agent runtime: MCP client plus an OpenAI-compatible inference loop."],
            ["apps/web", "The Next.js console and this site."],
            ["packages/scenarios", "World definitions; rendered deterministically per trial."],
          ]}
        />
      </DocSection>

      <DocSection id="request-path" title="Path of a tool call">
        <DocTable
          head={["Step", "What happens"]}
          rows={[
            ["1", "The model (via the inference relay) chooses a tool; the API records model.response with the tool calls."],
            ["2", "The candidate calls the tool on mcp-city with its trial token."],
            ["3", "mcp-city validates arguments strictly, then asks the API to evaluate the Guard; the API records tool.request and tool.allow/deny, correlated to the model's choice."],
            ["4", "If allowed, the handler runs; net.* calls go through the egress proxy, which asks for a network decision."],
            ["5", "mcp-city records tool.result (masked preview, hash), and artifact.write uploads the artifact."],
          ]}
        />
      </DocSection>
    </DocPage>
  );
}
