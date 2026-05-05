import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "../src/index.js";

const EXPECTED_TOOL_NAMES = [
  "account_status",
  "ai_chat_completion",
  "web_fetch",
  "web_search",
];

describe("tools/list icons", () => {
  beforeEach(() => {
    process.env.MASSIVE_TOKEN = "test-token";
  });
  afterEach(() => {
    delete process.env.MASSIVE_TOKEN;
  });

  it("each tool has icons[] with at least one image/png entry sourced from a data URI", async () => {
    const server = createServer();
    // Access the underlying protocol instance to invoke the tools/list handler directly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proto = server.server as any;
    const handler = proto._requestHandlers.get("tools/list");
    expect(handler).toBeDefined();

    const result = await handler({ method: "tools/list", params: {} }, {});
    const tools: Array<{ name: string; icons?: Array<{ src: string; mimeType: string; sizes: string[] }> }> =
      result.tools;

    // All four tools must be present.
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(EXPECTED_TOOL_NAMES);

    // Every tool must carry icons.
    for (const tool of tools) {
      expect(tool.icons, `${tool.name} missing icons`).toBeDefined();
      expect(tool.icons!.length, `${tool.name} icons is empty`).toBeGreaterThanOrEqual(1);

      const icon = tool.icons![0];
      expect(icon.mimeType, `${tool.name} icon mimeType`).toBe("image/png");
      expect(icon.src, `${tool.name} icon src`).toMatch(/^data:image\/png;base64,/);
    }
  });
});
