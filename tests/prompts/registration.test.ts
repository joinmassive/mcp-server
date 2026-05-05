import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPrompts } from "../../src/prompts/index.js";

const EXPECTED_NAMES = ["account_check", "ai_chat_full", "web_fetch_markdown", "web_search_full"];

describe("registerPrompts", () => {
  it("registers exactly 4 prompts via server.prompt", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    const promptSpy = vi.spyOn(server, "prompt");

    registerPrompts(server);

    expect(promptSpy).toHaveBeenCalledTimes(4);
    const names = promptSpy.mock.calls.map((c) => c[0] as string).sort();
    expect(names).toEqual(EXPECTED_NAMES);
  });

  it("each prompt handler interpolates the user-provided args into the text", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    const promptSpy = vi.spyOn(server, "prompt");
    registerPrompts(server);

    // Map of name → sample args + assertion substring
    const cases: Record<string, { args: Record<string, string>; expectInText: string[] }> = {
      web_search_full: { args: { topic: "espresso machines" }, expectInText: ["espresso machines", "top 10"] },
      web_fetch_markdown: { args: { url: "https://example.com" }, expectInText: ["https://example.com", "format=markdown"] },
      ai_chat_full: { args: { model: "gemini", topic: "what is mcp" }, expectInText: ["model=gemini", "what is mcp"] },
      account_check: { args: {}, expectInText: ["account_status", "low_balance"] },
    };

    for (const call of promptSpy.mock.calls) {
      const name = call[0] as string;
      // server.prompt(name, description, argsSchema, handler) — handler is the 4th arg.
      const handler = call[3] as (args: Record<string, string>) => Promise<{
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      }>;
      const { args, expectInText } = cases[name]!;
      const result = await handler(args);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.type).toBe("text");
      for (const substr of expectInText) {
        expect(result.messages[0].content.text).toContain(substr);
      }
    }
  });
});
