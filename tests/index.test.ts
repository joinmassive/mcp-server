import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer } from "../src/index.js";

describe("createServer", () => {
  beforeEach(() => {
    process.env.MASSIVE_TOKEN = "test-token";
  });
  afterEach(() => {
    delete process.env.MASSIVE_TOKEN;
  });

  it("creates an MCP server with the four tools registered", () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it("createServer registers the three docs:// resources", async () => {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const resourceSpy = vi.spyOn(McpServer.prototype, "resource");
    try {
      createServer();
      const uris = resourceSpy.mock.calls.map((c) => c[1] as string).sort();
      expect(uris).toEqual([
        "docs://massive/changelog",
        "docs://massive/geotargeting",
        "docs://massive/pricing",
      ]);
    } finally {
      resourceSpy.mockRestore();
    }
  });

  it("createServer registers the four MCP prompts", async () => {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const promptSpy = vi.spyOn(McpServer.prototype, "prompt");
    try {
      createServer();
      const names = promptSpy.mock.calls.map((c) => c[0] as string).sort();
      expect(names).toEqual([
        "account_check",
        "ai_chat_full",
        "web_fetch_markdown",
        "web_search_full",
      ]);
    } finally {
      promptSpy.mockRestore();
    }
  });
});
