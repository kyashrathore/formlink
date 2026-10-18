import { z } from "zod";
import type { Auth, Env } from "@/env";
import { ApiError, forbidden } from "@/lib/errors";
import { TOOLS } from "@/mcp/tools";
import { MCP_APP_MIME, VIEW_APP_HTML, VIEW_APP_URI } from "@/views";

/**
 * A stateless MCP server over Streamable HTTP: every request is a JSON-RPC POST answered with JSON.
 * Tools call the same services as the REST API.
 */
const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

const INSTRUCTIONS =
  "Formlink is headless forms infrastructure. Call `guide` first. You build the form UI; Formlink stores submissions, runs per-form hooks and hosts the app.";

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const toolList = TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  inputSchema: z.toJSONSchema(t.input, { io: "input" }),
  annotations: { readOnlyHint: !!t.readOnly, destructiveHint: !!t.destructive },
  ...(t.meta ? { _meta: t.meta } : {}),
}));

const RESOURCES = [
  { uri: VIEW_APP_URI, name: "Formlink view", description: "Renders a saved Formlink view with live data", mimeType: MCP_APP_MIME },
];

async function callTool(env: Env, auth: Auth, ctx: ExecutionContext, params: Record<string, unknown>) {
  const tool = TOOLS.find((t) => t.name === params.name);
  if (!tool) throw new RpcError(-32602, `Unknown tool: ${String(params.name)}`);
  try {
    if (!tool.readOnly && auth.role !== "admin") throw forbidden("This key is read-only");
    const parsed = tool.input.safeParse(params.arguments ?? {});
    if (!parsed.success)
      return toolError(`Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    const result = await tool.run(env, auth, parsed.data, (p) => ctx.waitUntil(p.catch(console.error)));
    // A result's `message` is what the model reads; the rest travels as structuredContent.
    const message = result && typeof result === "object" && "message" in result ? String((result as { message: unknown }).message) : null;
    const text = message ?? (typeof result === "string" ? result : JSON.stringify(result, null, 2));
    return {
      content: [{ type: "text", text }],
      ...(result && typeof result === "object" && !Array.isArray(result) ? { structuredContent: result } : {}),
    };
  } catch (err) {
    if (err instanceof ApiError)
      return toolError(`${err.code}: ${err.message}${err.details ? `\n${JSON.stringify(err.details)}` : ""}`);
    console.error(err);
    return toolError("Internal error");
  }
}

const toolError = (text: string) => ({ content: [{ type: "text", text }], isError: true });

class RpcError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

async function handle(env: Env, auth: Auth, ctx: ExecutionContext, msg: RpcRequest) {
  switch (msg.method) {
    case "initialize": {
      const requested = String(msg.params?.protocolVersion ?? "");
      return {
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: { name: "formlink", version: "0.1.0" },
        instructions: INSTRUCTIONS,
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return { tools: toolList };
    case "resources/list":
      return { resources: RESOURCES };
    case "resources/templates/list":
      return { resourceTemplates: [] };
    case "resources/read": {
      if (msg.params?.uri !== VIEW_APP_URI) throw new RpcError(-32002, `Resource not found: ${String(msg.params?.uri)}`);
      return {
        contents: [
          {
            uri: VIEW_APP_URI,
            mimeType: MCP_APP_MIME,
            text: VIEW_APP_HTML,
            _meta: { ui: { csp: { connectDomains: [], resourceDomains: [], frameDomains: [] }, prefersBorder: true } },
          },
        ],
      };
    }
    case "tools/call":
      return callTool(env, auth, ctx, msg.params ?? {});
    default:
      throw new RpcError(-32601, `Method not found: ${msg.method}`);
  }
}

export async function handleMcp(request: Request, env: Env, ctx: ExecutionContext, auth: Auth) {
  if (request.method !== "POST")
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  let payload: RpcRequest | RpcRequest[];
  try {
    payload = await request.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const messages = Array.isArray(payload) ? payload : [payload];
  const responses = [];
  for (const msg of messages) {
    if (msg.id === undefined || msg.id === null) continue; // notification
    try {
      responses.push({ jsonrpc: "2.0", id: msg.id, result: await handle(env, auth, ctx, msg) });
    } catch (err) {
      const e = err instanceof RpcError ? err : new RpcError(-32603, "Internal error");
      responses.push({ jsonrpc: "2.0", id: msg.id, error: { code: e.code, message: e.message } });
    }
  }
  if (!responses.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(payload) ? responses : responses[0]);
}
