import type { Metadata } from "next";
import { CodeFrame } from "@/components/marketing/Section";
import { Callout, Code, DocPage, DocSection, Steps } from "@/components/docs/Doc";

export const metadata: Metadata = { title: "Quickstart — Docs", description: "Run Decoyr locally: control plane, sandbox services, candidate agent and web console." };

export default function Quickstart() {
  return (
    <DocPage path="/docs/quickstart" title="Quickstart" lead="Run the whole stack on your machine with the process sandbox and SQLite. It takes a few minutes and needs no API keys.">
      <DocSection id="requirements" title="Requirements">
        <Steps items={[["Python 3.12+ and uv", "For the FastAPI control plane in apps/api."], ["Node.js 22", "For mcp-city, egress-proxy, the candidate agent and the web console."], ["Optional: a Vultr Serverless Inference key", "Without one, a deterministic simulated model is used and labeled as such."]]} />
      </DocSection>

      <DocSection id="run" title="Run it">
        <CodeFrame title="1 · control plane (:8000)">{`cd apps/api
uv venv .venv && uv pip install -r requirements-dev.txt
.venv/bin/uvicorn decoyr.main:app --port 8000`}</CodeFrame>
        <CodeFrame title="2 · sandbox services (:7100, :7200) and candidate">{`cd services/mcp-city        && npm ci && npm run dev
cd services/egress-proxy    && npm ci && npm run dev
cd services/candidate-agent && npm ci && npm run build`}</CodeFrame>
        <CodeFrame title="3 · web console (:3000)">{`cd apps/web && npm ci && npm run dev`}</CodeFrame>
        <p>Open <Code>http://localhost:3000</Code> and click <strong>Test an agent</strong>. The prepared demo creates a trial for ResearchBot 0.9.2 on Acme Labs v1. Then start the baseline, derive minimum authority, replay with the Guard, and open the Passport.</p>
      </DocSection>

      <DocSection id="test" title="Run the tests">
        <CodeFrame title="terminal">{`cd apps/api && .venv/bin/python -m pytest -q        # control plane
cd apps/web && npx vitest run                       # console unit tests
cd apps/web && E2E_BASE_URL=http://localhost:3000 npx playwright test   # full demo in a browser`}</CodeFrame>
        <Callout>The API tests include a Python stand-in for mcp-city, egress-proxy and the candidate, so they run without Node or Docker.</Callout>
      </DocSection>
    </DocPage>
  );
}
