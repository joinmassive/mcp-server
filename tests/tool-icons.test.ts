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

  it("each tool has icons[] with exactly one 48x48 PNG data URI entry", async () => {
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

    // Every tool must carry exactly 1 icon entry (48x48 badge variant).
    for (const tool of tools) {
      expect(tool.icons, `${tool.name} missing icons`).toBeDefined();
      expect(tool.icons!.length, `${tool.name} icons count`).toBe(1);

      const [icon48] = tool.icons!;

      expect(icon48.mimeType, `${tool.name} icon48 mimeType`).toBe("image/png");
      expect(icon48.src, `${tool.name} icon48 src`).toMatch(/^data:image\/png;base64,/);
      expect(icon48.sizes, `${tool.name} icon48 sizes`).toEqual(["48x48"]);
    }
  });
});
