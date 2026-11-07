/** OpenAI function names must match ^[a-zA-Z0-9_-]{1,64}$ — MCP names contain dots. */
export function toOpenAIName(mcpName: string): string {
  return mcpName.replace(/\./g, "__");
}
export function toMcpName(openaiName: string): string {
  return openaiName.replace(/__/g, ".");
}

export type McpToolLike = { name: string; description?: string; inputSchema?: Record<string, unknown> };
export type OpenAITool = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

export function toOpenAITools(tools: McpToolLike[]): OpenAITool[] {
  return tools.map((t) => {
    const params: Record<string, unknown> = { ...(t.inputSchema ?? { type: "object", properties: {} }) };
    delete params.$schema;
    if (params.type !== "object") params.type = "object";
    if (!params.properties) params.properties = {};
    return { type: "function", function: { name: toOpenAIName(t.name), description: t.description ?? t.name, parameters: params } };
  });
}
