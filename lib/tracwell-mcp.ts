/**
 * Minimal client for Tracwell's MCP server (streamable HTTP, JSON-RPC), used
 * server-side to read analytics back out. The `tracwell` package only sends.
 * Keep this out of client components: it reads a secret key.
 */

const ENDPOINT = "https://tracwell.app/mcp";
const PROTOCOL_VERSION = "2025-06-18";

/** Tracwell's id for this site (not a secret; the MCP key is). */
export const TRACWELL_PROJECT_ID = "888fa603-1018-468a-8e07-6275b95d2226";

type JsonRpcResponse = {
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
};

export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

export type McpToolResult = {
  content?: { type: string; text?: string }[];
  structuredContent?: unknown;
  isError?: boolean;
};

/** Pulls the JSON-RPC reply out of a plain JSON body or an SSE stream. */
async function readReply(response: Response, id: number): Promise<JsonRpcResponse> {
  const body = await response.text();
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    return JSON.parse(body) as JsonRpcResponse;
  }
  for (const line of body.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const message = JSON.parse(line.slice(5)) as JsonRpcResponse;
    if (message.id === id) return message;
  }
  throw new Error("Tracwell MCP: no reply in event stream.");
}

export async function createTracwellMcp(key: string) {
  let session: string | null = null;
  let nextId = 1;

  async function post(body: object) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      cache: "no-store",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": PROTOCOL_VERSION,
        ...(session ? { "mcp-session-id": session } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", ...body }),
    });
    if (!response.ok) {
      throw new Error(`Tracwell MCP: HTTP ${response.status} ${await response.text()}`);
    }
    session = response.headers.get("mcp-session-id") ?? session;
    return response;
  }

  async function request<T>(method: string, params?: object): Promise<T> {
    const id = nextId++;
    const reply = await readReply(await post({ id, method, params }), id);
    if (reply.error) throw new Error(`Tracwell MCP: ${reply.error.message}`);
    return reply.result as T;
  }

  await request("initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "evil-buttons", version: "1.0.0" },
  });
  await post({ method: "notifications/initialized" });

  return {
    async listTools() {
      const { tools } = await request<{ tools: McpTool[] }>("tools/list");
      return tools;
    },
    async callTool(name: string, args: Record<string, unknown> = {}) {
      const result = await request<McpToolResult>("tools/call", { name, arguments: args });
      if (result.isError) {
        throw new Error(`Tracwell MCP ${name}: ${result.content?.[0]?.text ?? "failed"}`);
      }
      return result;
    },
  };
}
