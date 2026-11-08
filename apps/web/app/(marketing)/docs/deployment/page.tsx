import type { Metadata } from "next";
import { CodeFrame } from "@/components/marketing/Section";
import { Bullets, Callout, Code, DocPage, DocSection, DocTable } from "@/components/docs/Doc";

export const metadata: Metadata = { title: "Deployment — Docs", description: "Deploy Decoyr on a Vultr VM with Docker isolation, or as an all-in-one demo service with a separately hosted console." };

export default function Deployment() {
  return (
    <DocPage path="/docs/deployment" title="Deployment" lead="Two supported shapes: the full stack on one Vultr VM with Docker isolation, or an all-in-one demo service with the console hosted separately.">
      <DocSection id="options" title="Choose a shape">
        <DocTable
          head={["", "Vultr VM (Docker)", "All-in-one service"]}
          rows={[
            ["Sandbox", "Hardened container per run, per-run internal network", "Separate process (not a security boundary)"],
            ["Where", "infra/docker + infra/vultr", "infra/railway/Dockerfile (any container PaaS)"],
            ["Use for", "Real isolation evidence", "Public demos and evaluation"],
          ]}
        />
      </DocSection>

      <DocSection id="vultr" title="Vultr VM with Docker">
        <p>One Vultr Cloud Compute VM runs the api, Postgres, mcp-city, egress-proxy, the web console and Caddy. Only the api container gets the Docker socket, through its group (<Code>DOCKER_GID</Code>), and runs as a non-root user. Candidates never get the socket.</p>
        <CodeFrame title="terminal">{`cd infra/docker
cp .env.example .env      # signing key, Postgres password, Vultr key, DOCKER_GID
docker compose --profile build build
docker compose up -d

# or provision and deploy a VM end to end (see infra/vultr/README.md)
bash infra/vultr/provision.sh
bash infra/vultr/deploy.sh`}</CodeFrame>
        <Callout>Run <Code>bash tests/containment/run.sh</Code> on the host after deploying to verify the sandbox boundary.</Callout>
      </DocSection>

      <DocSection id="all-in-one" title="All-in-one service">
        <p><Code>infra/railway/Dockerfile</Code> builds the control plane, mcp-city, egress-proxy and the candidate into one image (build from the repository root). The startup script:</p>
        <Bullets
          items={[
            "binds mcp-city and egress-proxy to loopback; only the API listens on $PORT",
            "runs one API worker, because run state lives in-process",
            "generates the internal signing key at boot if none is set, so it never leaves the container",
            "generates an unguessable admin token unless DECOYR_ADMIN_TOKEN is set (demo reset disabled)",
            "exits if any process dies, so the platform restarts the container",
          ]}
        />
        <p>Attach PostgreSQL through <Code>DATABASE_URL</Code>, set <Code>DECOYR_PUBLIC_URL</Code> to the console origin, and use <Code>/api/v1/health</Code> as the healthcheck.</p>
      </DocSection>

      <DocSection id="console" title="Hosting the console separately">
        <p>The Next.js console in <Code>apps/web</Code> can be deployed on its own (for example on Vercel with root directory <Code>apps/web</Code>). Set <Code>DECOYR_API_URL</Code> to the API origin, and <Code>NEXT_PUBLIC_DECOYR_STREAM_BASE</Code> to the same origin so the live trace streams directly.</p>
      </DocSection>
    </DocPage>
  );
}
