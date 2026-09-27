// Lists the tools Tracwell's MCP server exposes to TRACWELL_MCP_KEY, with
// their input schemas, so the landing stats can call the right one.
// Usage: pnpm tracwell:tools [toolName [jsonArgs]]
import { createTracwellMcp } from "../lib/tracwell-mcp.ts";

const key = process.env.TRACWELL_MCP_KEY;
if (!key) {
  console.error("TRACWELL_MCP_KEY is empty. Paste it into .env.local first.");
  process.exit(1);
}

const mcp = await createTracwellMcp(key);
const [tool, args] = process.argv.slice(2);

if (tool) {
  const result = await mcp.callTool(tool, args ? JSON.parse(args) : {});
  console.log(JSON.stringify(result.structuredContent ?? result.content, null, 2));
} else {
  for (const { name, description, inputSchema } of await mcp.listTools()) {
    console.log(`\n## ${name}\n${description ?? ""}`);
    console.log(JSON.stringify(inputSchema, null, 2));
  }
}
