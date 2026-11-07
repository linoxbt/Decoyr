/** OpenAI function names must match ^[a-zA-Z0-9_-]{1,64}$ — MCP names contain dots. */
export function toOpenAIName(mcpName) {
    return mcpName.replace(/\./g, "__");
}
export function toMcpName(openaiName) {
    return openaiName.replace(/__/g, ".");
}
export function toOpenAITools(tools) {
    return tools.map((t) => {
        const params = { ...(t.inputSchema ?? { type: "object", properties: {} }) };
        delete params.$schema;
        if (params.type !== "object")
            params.type = "object";
        if (!params.properties)
            params.properties = {};
        return { type: "function", function: { name: toOpenAIName(t.name), description: t.description ?? t.name, parameters: params } };
    });
}
