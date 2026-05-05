import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PACKAGE_NAME, PACKAGE_VERSION } from "./types.js";
import { MassiveClient } from "./client.js";
import { registerWebFetch } from "./tools/web-fetch.js";
import { registerWebSearch } from "./tools/web-search.js";
import { registerAiChat } from "./tools/ai-chat.js";
import { registerAccountStatus } from "./tools/account-status.js";
import { registerResources } from "./resources/index.js";
import { registerPrompts } from "./prompts/index.js";
import { TOOL_ICONS } from "./tool-icons.js";

export function createServer(client?: MassiveClient): McpServer {
  const server = new McpServer({ name: PACKAGE_NAME, version: PACKAGE_VERSION });
  const c = client ?? new MassiveClient();
  registerWebFetch(server, c);
  registerWebSearch(server, c);
  registerAiChat(server, c);
  registerAccountStatus(server, c);
  registerResources(server);
  registerPrompts(server);

  // Inject per-tool icons into tools/list responses.
  // The SDK (1.29.0) strips icons from registerTool config, so we intercept
  // the handler here and add icons[] to each tool entry.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proto = server.server as any;
  const baseHandler = proto._requestHandlers.get("tools/list");
  server.server.setRequestHandler(
    ListToolsRequestSchema,
    async (req, extra) => {
      const result = await baseHandler(req, extra);
      return {
        ...result,
        tools: result.tools.map((t: { name: string }) => ({
          ...t,
          icons: TOOL_ICONS[t.name] ?? TOOL_ICONS.default,
        })),
      };
    },
  );

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function isEntryPoint(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((err) => {
    console.error("Fatal error starting MCP server:", err);
    process.exit(1);
  });
}
