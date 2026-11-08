import type { Metadata } from "next";
import { CodeFrame } from "@/components/marketing/Section";
import { Bullets, Callout, Code, DocPage, DocSection, DocTable } from "@/components/docs/Doc";

export const metadata: Metadata = { title: "Security model — Docs", description: "How Decoyr isolates the agent under test, the threat model, the containment test suite and what Decoyr does not claim." };

export default function Security() {
  return (
    <DocPage path="/docs/security" title="Security model" lead="Decoyr assumes the candidate agent is hostile. Trusted and untrusted zones are separated by credential, process, container and network boundaries, and the policy that contains the agent is enforced in code.">
      <DocSection id="layers" title="Defense in depth">
        <DocTable
          head={["Layer", "Control"]}
          rows={[
            ["Credentials", "The candidate gets only a short-lived HMAC trial token scoped to one run. Never the inference key, signing key or service token."],
            ["Privileges", "Non-root uid 10001, cap-drop ALL, no-new-privileges."],
            ["Filesystem", "Read-only root; only small noexec tmpfs mounts at /tmp and /workspace."],
            ["Resources", "Memory (swap pinned), CPU quota, PID limit and a wall-clock kill per run."],
            ["Network", "A per-run internal Docker network with no internet route; mcp-city (alias mcp-city) is the only peer."],
            ["Policy", "The Guard is evaluated before every tool handler and again for every outbound request."],
            ["Fail closed", "Policy service errors deny; inactive runs refuse further calls."],
            ["Evidence", "Honeycredential values are masked before storage and before reaching the browser."],
            ["Lifecycle", "Containers and networks are force-removed after each run; an orphan sweep runs at startup."],
          ]}
        />
      </DocSection>

      <DocSection id="zones" title="Trust zones">
        <DocTable
          head={["Zone", "Contains", "Can reach"]}
          rows={[
            ["Control plane", "API, database, Docker SDK, all secrets", "Sandbox services; Docker daemon"],
            ["Sandbox services", "mcp-city (tools + inference relay), egress-proxy (synthetic network)", "Control plane, with the service token"],
            ["Candidate", "Your agent and its trial token", "mcp-city:7100 only"],
            ["Outside world", "n/a", "Never contacted on the agent's behalf"],
          ]}
        />
      </DocSection>

      <DocSection id="threats" title="Threat model">
        <DocTable
          head={["Threat", "Mitigation"]}
          rows={[
            ["Credential exfiltration", "All credentials are honeytokens; egress is default-deny under Guard; credentials in outbound bodies are detected and recorded."],
            ["Escape to the host", "Non-root, no capabilities, no-new-privileges, read-only rootfs, no Docker socket, private PID namespace."],
            ["Attacking the control plane", "The API isn't on the per-run network; mcp-city verifies trial tokens locally."],
            ["Resource exhaustion", "Memory, CPU, PID and wall-clock limits, verified by the drill with a health check afterwards."],
            ["Forging another run's identity", "Run and trial IDs come from signed token claims, never from tool arguments."],
            ["Policy service outage", "Fail closed."],
            ["Secrets leaking through evidence", "Masking before storage and before the browser."],
          ]}
        />
      </DocSection>

      <DocSection id="containment" title="Containment tests">
        <p><Code>tests/containment/run.sh</Code> launches a candidate-like container with the orchestrator's exact hardening flags on a per-run internal network and checks the boundary from the inside. Run it on your Docker host after every infrastructure change.</p>
        <CodeFrame title="terminal">{`docker build -t decoyr/candidate-agent:latest services/candidate-agent
bash tests/containment/run.sh`}</CodeFrame>
        <Bullets
          items={[
            "runs as uid/gid 10001 with no effective capabilities and no-new-privileges",
            "read-only root filesystem, writable /workspace only",
            "no control-plane secrets in the environment and no Docker socket",
            "private PID namespace",
            "reaches mcp-city, and cannot reach the control plane by name or IP",
            "no direct internet egress by name or IP, no cloud metadata endpoint",
          ]}
        />
      </DocSection>

      <DocSection id="limits" title="What Decoyr does not claim">
        <Bullets
          items={[
            <><strong>No universal safety rating.</strong> Results hold for the tested world, task, scenario pack and seed only.</>,
            <><strong>Untested means unproven.</strong> Capabilities never exercised are denied, not certified.</>,
            <><strong>Models are nondeterministic.</strong> A replay demonstrates containment of the observed behavior, not every possible behavior.</>,
            <><strong>Change invalidates.</strong> A new agent version, model, prompt or task needs a new trial.</>,
          ]}
        />
        <Callout tone="warning" title="Process mode is for development">The process sandbox (local development) runs the candidate as a separate OS process. It is not a security boundary, and the system status and every Passport say so. The live deployment uses the Docker sandbox.</Callout>
      </DocSection>
    </DocPage>
  );
}
