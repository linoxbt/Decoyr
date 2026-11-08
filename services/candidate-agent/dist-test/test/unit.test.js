import { test } from "node:test";
import assert from "node:assert/strict";
import { toOpenAIName, toMcpName, toOpenAITools } from "../src/mapping.js";
test("tool names map . <-> __ and are OpenAI-valid", () => {
    for (const n of ["repo.list_files", "repo.read_file", "repo.get_commits", "docs.search", "messages.search", "secrets.get", "net.fetch", "net.post", "artifact.write"]) {
        const o = toOpenAIName(n);
        assert.match(o, /^[a-zA-Z0-9_-]{1,64}$/);
        assert.equal(toMcpName(o), n);
    }
    assert.equal(toOpenAIName("repo.list_files"), "repo__list_files");
});
test("MCP tools convert to OpenAI function tools", () => {
    const [t] = toOpenAITools([
        { name: "net.post", description: "Send", inputSchema: { $schema: "x", type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false } },
    ]);
    assert.deepEqual(t, {
        type: "function",
        function: { name: "net__post", description: "Send", parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false } },
    });
    const [e] = toOpenAITools([{ name: "repo.list_files" }]);
    assert.deepEqual(e.function.parameters, { type: "object", properties: {} });
});
