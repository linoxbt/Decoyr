import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { runawayDrill } from "./drill.js";
import { toMcpName, toOpenAITools } from "./mapping.js";
function env(name, fallback) {
    const v = process.env[name] ?? fallback;
    if (v === undefined || v === "")
        throw new Error(`missing required env ${name}`);
    return v;
}
function log(line) {
    console.log(`[candidate] ${line}`);
}
function short(s, n = 120) {
    const one = s.replace(/\s+/g, " ");
    return one.length > n ? one.slice(0, n) + "…" : one;
}
async function chat(url, token, body) {
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetch(`${url.replace(/\/$/, "")}/chat/completions`, {
                method: "POST",
                headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(150_000),
            });
            const text = await res.text();
            if (!res.ok) {
                lastErr = new Error(`inference HTTP ${res.status}: ${short(text, 300)}`);
                if (res.status >= 500 || res.status === 429) {
                    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
                    continue;
                }
                throw lastErr;
            }
            return JSON.parse(text);
        }
        catch (err) {
            lastErr = err;
            if (err.message.startsWith("inference HTTP 4"))
                throw err;
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
    }
    throw lastErr ?? new Error("inference failed");
}
async function main() {
    if (process.env.DECOYR_DRILL === "runaway")
        await runawayDrill();
    const token = env("DECOYR_TRIAL_TOKEN");
    const mcpUrl = env("DECOYR_MCP_URL");
    const inferenceUrl = env("DECOYR_INFERENCE_URL");
    const agent = JSON.parse(env("DECOYR_AGENT", "{}"));
    const task = JSON.parse(env("DECOYR_TASK"));
    const maxSteps = Number(process.env.DECOYR_MAX_STEPS ?? 16);
    log(`${agent.name ?? "candidate"} ${agent.version ?? ""} starting; task: ${task.goal}`);
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
    });
    const client = new Client({ name: agent.name ?? "candidate-agent", version: agent.version ?? "0.0.0" }, { versionNegotiation: { mode: "auto" } });
    await client.connect(transport);
    const { tools } = await client.listTools();
    log(`discovered ${tools.length} MCP tools: ${tools.map((t) => t.name).join(", ")}`);
    const openaiTools = toOpenAITools(tools);
    const messages = [];
    if (agent.systemPrompt)
        messages.push({ role: "system", content: agent.systemPrompt });
    messages.push({ role: "user", content: [task.goal, task.instructions].filter(Boolean).join("\n\n") });
    let finished = false;
    for (let step = 1; step <= maxSteps; step++) {
        const resp = await chat(inferenceUrl, token, {
            model: agent.model ?? "default",
            messages,
            tools: openaiTools,
            tool_choice: "auto",
            temperature: 0,
        });
        const msg = resp.choices?.[0]?.message;
        if (!msg)
            throw new Error("inference returned no message");
        const calls = msg.tool_calls ?? [];
        messages.push({ role: "assistant", content: msg.content ?? null, ...(calls.length ? { tool_calls: calls } : {}) });
        if (calls.length === 0) {
            log(`step ${step}: finished — ${short(msg.content ?? "(no content)")}`);
            finished = true;
            break;
        }
        for (const call of calls) {
            const tool = toMcpName(call.function.name);
            let args = {};
            let text;
            try {
                args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
            }
            catch {
                text = `error: tool arguments were not valid JSON`;
                messages.push({ role: "tool", tool_call_id: call.id, content: text });
                log(`step ${step}: ${tool} -> invalid JSON arguments`);
                continue;
            }
            try {
                const result = await client.callTool({ name: tool, arguments: args });
                const parts = (result.content ?? [])
                    .map((c) => (c.type === "text" ? c.text ?? "" : `[${c.type}]`))
                    .join("\n");
                const isError = Boolean(result.isError);
                text = isError ? `error: ${parts}` : parts;
                log(`step ${step}: ${tool}(${short(JSON.stringify(args), 80)}) -> ${isError ? "ERROR " + short(parts, 100) : "ok"}`);
            }
            catch (err) {
                text = `error: ${err.message}`;
                log(`step ${step}: ${tool} -> exception ${short(err.message, 100)}`);
            }
            messages.push({ role: "tool", tool_call_id: call.id, content: text });
        }
    }
    if (!finished)
        log(`stopped after max steps (${maxSteps})`);
    await client.close().catch(() => { });
}
main().then(() => process.exit(0), (err) => {
    console.error(`[candidate] fatal: ${err.message}`);
    process.exit(1);
});
