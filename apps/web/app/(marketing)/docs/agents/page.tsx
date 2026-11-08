import type { Metadata } from "next";
import { CodeFrame } from "@/components/marketing/Section";
import { Bullets, Callout, Code, DocCards, DocPage, DocSection, DocTable, Steps } from "@/components/docs/Doc";

export const metadata: Metadata = {
  title: "Test your own agent — Docs",
  description: "Three ways to put your own agent through Decoyr: configure it in the console, automate trials from CI through the API, or bring your own agent runtime as a Docker image.",
};

const CI_SCRIPT = `#!/usr/bin/env bash
# Fail the build unless the agent earns a calibrated Passport. Requires curl and jq.
set -euo pipefail
API="\${DECOYR_URL:?set DECOYR_URL, e.g. https://your-decoyr-host}/api/v1"

get()  { curl -fsS "$API$1"; }
post() { if [ $# -gt 1 ]; then curl -fsS -X POST -H 'content-type: application/json' -d "$2" "$API$1"
         else curl -fsS -X POST "$API$1"; fi; }
wait_idle() { until [ -z "$(get "/trials/$1" | jq -r '.activeRunId // empty')" ]; do sleep 3; done; }

SPEC=$(jq -n --arg prompt "$(cat prompts/system.txt)" '{
  agent: {
    name: "MyBot", version: "2.0.0", purpose: "Drafts release notes from repository history",
    model: "glm-5.3-flash",            # any id from GET /api/v1/models
    systemPrompt: $prompt,             # your agent'"'"'s real instructions
    requestedCapabilities: ["repo.list_files","repo.read_file","repo.get_commits","artifact.write","secrets.get","net.post"]
  },
  worldVersion: "acme-labs-v1", taskId: "release-notes-v2.4.0", scenarioPack: ["indirect-injection-v1"]
}')

TRIAL=$(post /trials "$SPEC" | jq -r .id)
post "/trials/$TRIAL/run" >/dev/null && wait_idle "$TRIAL"          # baseline (observe-only)
post "/trials/$TRIAL/calibrate" | jq -r .deltaText                    # minimum authority + Guard
post "/trials/$TRIAL/replay" >/dev/null && wait_idle "$TRIAL"       # same trial, Guard enforced

get "/trials/$TRIAL/guard"    > guard.json                            # ship this policy with the agent
get "/trials/$TRIAL/passport" > passport.json
jq -e '.status == "calibrated"' passport.json >/dev/null || { jq '.label, .limitations' passport.json; exit 1; }`;

const PY_AGENT = `"""Minimal Decoyr-compatible agent: MCP tools + OpenAI-compatible inference via the trial relay."""
import asyncio, json, os

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from openai import OpenAI

TOKEN = os.environ["DECOYR_TRIAL_TOKEN"]          # the only credential the sandbox ever receives
AGENT = json.loads(os.environ.get("DECOYR_AGENT", "{}"))
TASK = json.loads(os.environ["DECOYR_TASK"])
llm = OpenAI(base_url=os.environ["DECOYR_INFERENCE_URL"], api_key=TOKEN)  # relayed to Vultr by the control plane


async def main() -> None:
    headers = {"Authorization": f"Bearer {TOKEN}"}
    async with streamablehttp_client(os.environ["DECOYR_MCP_URL"], headers=headers) as (read, write, _):
        async with ClientSession(read, write) as mcp:
            await mcp.initialize()
            tools = (await mcp.list_tools()).tools
            # MCP tool names contain dots; OpenAI function names can't, so map "." <-> "__".
            fns = [{"type": "function", "function": {"name": t.name.replace(".", "__"),
                    "description": t.description or t.name, "parameters": t.inputSchema}} for t in tools]
            messages = [{"role": "system", "content": AGENT.get("systemPrompt", "")},
                        {"role": "user", "content": f"{TASK['goal']}\\n\\n{TASK.get('instructions', '')}"}]
            for _ in range(int(os.environ.get("DECOYR_MAX_STEPS", "16"))):
                msg = llm.chat.completions.create(model=AGENT.get("model", "default"),
                                                  messages=messages, tools=fns).choices[0].message
                messages.append(msg.model_dump(exclude_none=True))
                if not msg.tool_calls:
                    break
                for call in msg.tool_calls:
                    res = await mcp.call_tool(call.function.name.replace("__", "."), json.loads(call.function.arguments or "{}"))
                    text = "\\n".join(c.text for c in res.content if c.type == "text")
                    messages.append({"role": "tool", "tool_call_id": call.id,
                                     "content": ("error: " if res.isError else "") + text})


asyncio.run(main())`;

const DOCKERFILE = `FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir "mcp>=1.10" "openai>=1.100"
COPY agent.py /app/agent.py
USER 10001:10001
CMD ["python", "/app/agent.py"]`;

const REGISTER = `# on the Decoyr host
docker build -t acme/my-agent:1.0 path/to/my-agent
echo 'DECOYR_CANDIDATE_IMAGES=acme/my-agent:1.0' >> infra/docker/.env
cd infra/docker && docker compose up -d api      # the runtime now appears in New trial`;

export default function TestYourAgent() {
  return (
    <DocPage
      path="/docs/agents"
      title="Test your own agent"
      lead="Three levels, from no code to full control: configure your agent in the console, automate trials from CI through the API, or bring your own agent runtime."
    >
      <DocCards
        items={[
          { href: "#console", title: "1 · In the console", body: "Your agent's model, instructions and requested capabilities. No code." },
          { href: "#api", title: "2 · From CI with the API", body: "Run the full loop on every change and fail the build without a calibrated Passport." },
          { href: "#runtime", title: "3 · Bring your own runtime", body: "Your own agent code in a Docker image, run in the same hardened sandbox." },
          { href: "#results", title: "Reading the results", body: "What to ship: the Guard, the Passport and the evidence." },
        ]}
      />

      <DocSection id="console" title="1 · Test in the console">
        <Steps
          items={[
            ["Open New trial", "From the console (Trials › New trial), start from the ResearchBot profile or describe your own agent: name, version and declared purpose."],
            ["Choose the model", <>Pick any chat model with tool calling on Vultr Serverless Inference. The list is live from <Code>GET /api/v1/models</Code> and validated server-side.</>],
            ["Paste your agent's instructions", "The system prompt your agent really uses (up to 8,000 characters). It goes only to the model, through the trial-scoped relay."],
            ["Declare the authority it asks for", "Tick the capabilities your agent would request in production. Decoyr treats this as a hypothesis to test, not a grant."],
            ["Pick the scenario packs and run", "Start the baseline, derive minimum authority, replay with the Guard, and read the Passport."],
          ]}
        />
        <Callout>Each trial pins the agent profile it was created with. A new model, prompt or version creates a new profile, so results never mix.</Callout>
      </DocSection>

      <DocSection id="api" title="2 · Automate with the API">
        <p>Everything the console does is a public JSON API (see <a className="underline" href="/docs/api">API reference</a>). This script runs the whole loop and fails CI unless the agent is contained with its task intact:</p>
        <CodeFrame title="decoyr-check.sh">{CI_SCRIPT}</CodeFrame>
        <Bullets
          items={[
            <>Run it on every change to the agent's prompt, model or tools. A regression shows up as a failed security assertion, a broken task, or a wider minimum authority.</>,
            <>Commit <Code>guard.json</Code> next to the agent: it is the least-privilege policy the trial proved.</>,
            <>Trials are rate limited per hour on shared deployments; keep CI runs to one per change.</>,
          ]}
        />
      </DocSection>

      <DocSection id="runtime" title="3 · Bring your own agent runtime">
        <p>To test your actual agent code rather than a prompt, package it as a Docker image that follows the sandbox contract. It runs in the same hardened container as the built-in runtime: uid 10001, read-only root filesystem, a writable <Code>/workspace</Code>, no internet, CPU, memory, PID and time limits, destroyed after the run.</p>
        <DocTable
          head={["Environment variable", "What your agent gets"]}
          mono={[0]}
          rows={[
            ["DECOYR_TRIAL_TOKEN", "Short-lived token scoped to this run. Send it as Authorization: Bearer on MCP and inference requests. It's the only credential in the sandbox."],
            ["DECOYR_MCP_URL", "MCP Streamable HTTP endpoint of the synthetic company (tools: repo.*, docs.search, messages.search, secrets.get, net.*, artifact.write)."],
            ["DECOYR_INFERENCE_URL", "OpenAI-compatible base URL (POST /chat/completions). The control plane relays to Vultr Serverless Inference with the agent's model."],
            ["DECOYR_AGENT", "JSON: name, version, purpose, systemPrompt, model, from the trial's agent profile."],
            ["DECOYR_TASK", "JSON: goal and instructions of the legitimate task."],
            ["DECOYR_MAX_STEPS", "Suggested upper bound on agent loop steps."],
          ]}
        />
        <CodeFrame title="agent.py (minimal, Python)">{PY_AGENT}</CodeFrame>
        <CodeFrame title="Dockerfile">{DOCKERFILE}</CodeFrame>
        <p>The reference implementation in TypeScript is <Code>services/candidate-agent</Code> in the repository.</p>
        <p><strong>Register it (operators).</strong> Runtimes are an allowlist so nobody can make the orchestrator run an arbitrary image. Build the image on the Decoyr host and list it:</p>
        <CodeFrame title="terminal">{REGISTER}</CodeFrame>
        <p>Then choose it in New trial (Runtime), or pass <Code>{`"runtime": "acme/my-agent:1.0"`}</Code> in the agent spec of <Code>POST /api/v1/trials</Code>.</p>
        <Callout tone="warning" title="What your agent can't do in the sandbox">Reach the internet, the control plane or any host other than mcp-city; read any key except its trial token; write outside <Code>/workspace</Code> and <Code>/tmp</Code>; outlive the wall-clock limit. Network tools go through the egress proxy, which serves synthetic hosts only.</Callout>
      </DocSection>

      <DocSection id="results" title="Reading the results">
        <DocTable
          head={["Artifact", "Use it for"]}
          rows={[
            ["Trace", "Exactly what the agent did, correlated from model choice to policy decision to result."],
            ["Findings", "Where untrusted content turned into action, with the causal chain."],
            ["Authority + Guard", "The minimum capabilities and constraints the task needed: the policy to deploy the agent with."],
            ["Replay", "Proof the Guard keeps the useful work and blocks what it should."],
            ["Passport", "A scoped record for reviewers. Labeled “Calibrated” only when the replay passed the task and every tested security check."],
          ]}
        />
        <p>A model that ignores the injection is a valid, useful result: the Passport records that the attack was delivered and resisted, and the Guard still removes the authority the task didn't need.</p>
      </DocSection>
    </DocPage>
  );
}
