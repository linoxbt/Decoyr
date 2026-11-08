import { McpServer, createMcpHandler, type StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { config } from "./config.js";
import * as cp from "./controlPlane.js";
import { executeTool, type Deps } from "./pipeline.js";
import { bearer, TokenError, verifyTrialToken, type TrialClaims } from "./tokens.js";
import { jsonSchemaFor, toolMeta, toolNames, type ToolName } from "./tools.js";

export const defaultDeps: Deps = {
  getWorld: cp.getWorld,
  evaluatePolicy: cp.evaluatePolicy,
  postEvent: cp.postEvent,
  postArtifact: cp.postArtifact,
  egress: cp.egress,
};

/**
 * The SDK validates tool arguments before invoking handlers. Decoyr's middleware must see
 * invalid calls too (to record `tool.error` telemetry), so the SDK receives a pass-through
 * schema that *advertises* the strict JSON schema and our pipeline performs the strict zod
 * validation itself (step 2 of the middleware order).
 */
function advertisedSchema(tool: ToolName): StandardSchemaWithJSON {
  const js = jsonSchemaFor(tool);
  return {
    "~standard": {
      version: 1,
      vendor: "decoyr",
      validate: (value: unknown) => ({ value: value ?? {} }),
      jsonSchema: { input: () => js, output: () => js },
    },
  } as unknown as StandardSchemaWithJSON;
}

export function buildMcpServer(claims: TrialClaims, deps: Deps = defaultDeps): McpServer {
  const server = new McpServer(
    { name: "decoyr-mcp-city", version: "1.0.0", title: "Acme Labs (synthetic enterprise)" },
    { instructions: "Acme Labs internal tools. All content is synthetic." },
  );
  for (const tool of toolNames) {
    const meta = toolMeta[tool];
    server.registerTool(
      tool,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: advertisedSchema(tool),
        annotations: { readOnlyHint: meta.readOnly, openWorldHint: false },
      },
      (async (args: unknown) => executeTool(deps, claims, tool, args)) as never,
    );
  }
  return server;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(text) });
  res.end(text);
}

async function readBody(req: IncomingMessage, limit = 2 * 1024 * 1024): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw Object.assign(new Error("body too large"), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function createApp(deps: Deps = defaultDeps) {
  const mcp = createMcpHandler(
    (ctx) => {
      const claims = ctx.authInfo?.extra?.claims as TrialClaims | undefined;
      if (!claims) throw new Error("unauthenticated");
      return buildMcpServer(claims, deps);
    },
    { onerror: (e) => console.error(`[mcp-city] mcp error: ${e.message}`) },
  );
  const mcpNode = toNodeHandler(mcp, { onerror: (e) => console.error(`[mcp-city] adapter error: ${e.message}`) });

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://mcp-city");
    try {
      if (url.pathname === "/healthz") return sendJson(res, 200, { ok: true, service: "mcp-city" });

      const token = bearer(req.headers.authorization);
      let claims: TrialClaims;
      try {
        claims = verifyTrialToken(config.signingKey, token);
      } catch (err) {
        if (err instanceof TokenError) {
          res.setHeader("www-authenticate", 'Bearer realm="decoyr-trial"');
          return sendJson(res, 401, { error: "unauthorized", detail: err.message });
        }
        throw err;
      }

      if (url.pathname === "/mcp") {
        (req as IncomingMessage & { auth?: unknown }).auth = {
          token: token!,
          clientId: claims.agent_id ?? "candidate",
          scopes: ["trial"],
          expiresAt: claims.exp,
          extra: { claims },
        };
        return await mcpNode(req as never, res);
      }

      if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
        const body = await readBody(req);
        try {
          JSON.parse(body);
        } catch {
          return sendJson(res, 400, { error: { message: "invalid JSON body", type: "invalid_request_error" } });
        }
        try {
          const r = await cp.relayInference(token!, body);
          res.writeHead(r.status, { "content-type": r.contentType });
          return res.end(r.body);
        } catch (err) {
          return sendJson(res, 502, { error: { message: `inference relay failed: ${(err as Error).message}`, type: "relay_error" } });
        }
      }

      if (url.pathname === "/v1/models" && req.method === "GET") {
        return sendJson(res, 200, { object: "list", data: [{ id: "decoyr-relay", object: "model", owned_by: "decoyr" }] });
      }

      return sendJson(res, 404, { error: "not found" });
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      console.error(`[mcp-city] ${req.method} ${url.pathname} failed: ${(err as Error).message}`);
      if (!res.headersSent) sendJson(res, status, { error: (err as Error).message });
      else res.end();
    }
  });
}
