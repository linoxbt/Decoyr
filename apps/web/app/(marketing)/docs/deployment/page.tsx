import type { Metadata } from "next";
import { CodeFrame } from "@/components/marketing/Section";
import { Bullets, Callout, Code, DocPage, DocSection } from "@/components/docs/Doc";

export const metadata: Metadata = { title: "Deployment — Docs", description: "Deploy Decoyr on a single Vultr Cloud Compute VM with Docker isolation, provisioned from the Vultr API and kept in sync from git." };

export default function Deployment() {
  return (
    <DocPage path="/docs/deployment" title="Deployment" lead="The full stack runs on one Vultr Cloud Compute VM with the Docker sandbox. It is provisioned from the Vultr API and updates itself from git — no SSH required.">
      <DocSection id="provision" title="Provision the VM">
        <p>One VM runs the api, Postgres, mcp-city, egress-proxy, the web console and Caddy. The services are split across three Docker networks: an internet-facing edge, an internal data network for Postgres, and an internal sandbox network for the candidate-facing services. Only the api container gets the Docker socket (through its group) and runs as a non-root user; candidates never get it.</p>
        <CodeFrame title="terminal (from your machine)">{`export VULTR_API_KEY=...                       # Vultr account API key (stays local)
export VULTR_SERVERLESS_INFERENCE_API_KEY=...  # written to a 0600 bootstrap file on the VM
export DECOYR_MODEL=glm-5.3-flash
./infra/vultr/provision.sh                     # firewall group + instance + cloud-init`}</CodeFrame>
        <p>cloud-init installs Docker, clones the repository, generates the signing key, Postgres password and admin token <strong>on the VM</strong>, builds every image (including the candidate) and starts the stack. The VM then:</p>
        <Bullets
          items={[
            "serves HTTPS on <public-ip>.sslip.io with an automatic Let's Encrypt certificate",
            "pulls the tracked branch every 2 minutes and rebuilds only when it changes, and retries if a build fails",
            "publishes non-secret status and logs at /_ops/<token>/ (no access logs, no secrets)",
          ]}
        />
        <Callout>Set <Code>DECOYR_API_KEYS</Code> to require an <Code>X-Decoyr-Key</Code> on mutating routes, and <Code>DECOYR_ADMIN_TOKEN</Code> to enable demo reset. Both are optional; without them the deployment is an open public demo, rate-limited per IP.</Callout>
      </DocSection>

      <DocSection id="verify" title="Verify">
        <CodeFrame title="terminal">{`curl https://<ip>.sslip.io/api/v1/health
curl https://<ip>.sslip.io/api/v1/system     # inference.mode "vultr", sandbox.mode "docker"
bash tests/containment/run.sh                 # on the VM: prove the sandbox boundary`}</CodeFrame>
      </DocSection>

      <DocSection id="local" title="Run the stack locally">
        <p>The same compose stack runs on any Docker host. Fill a real signing key and Postgres password (the stack refuses the defaults), then:</p>
        <CodeFrame title="terminal">{`cd infra/docker
cp .env.example .env            # set DECOYR_INTERNAL_SIGNING_KEY, POSTGRES_PASSWORD, DOCKER_GID, Vultr key
docker compose --profile build build
docker compose up -d`}</CodeFrame>
        <p><Code>DOCKER_GID</Code> is the host Docker socket's group: <Code>stat -c %g /var/run/docker.sock</Code>.</p>
      </DocSection>

      <DocSection id="residual" title="Production hardening (residual risk)">
        <p>The api container holds the Docker socket so the orchestrator can create and destroy per-run sandboxes. A compromise of the api is therefore host-root. For a hardened production deployment, put a filtering socket proxy in front of the daemon (allow only container and network create/start/kill/remove, reject privileged containers and bind mounts, allowlist images), or move the orchestrator into a service with no public routes, and run candidates under gVisor. The current setup is appropriate for a controlled demo, not untrusted multi-tenant production.</p>
      </DocSection>
    </DocPage>
  );
}
