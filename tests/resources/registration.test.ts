import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResources } from "../../src/resources/index.js";

const EXPECTED_URIS = [
  "docs://massive/changelog",
  "docs://massive/geotargeting",
  "docs://massive/pricing",
];

describe("registerResources", () => {
  it("registers exactly three docs:// resources via server.resource", () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    const resourceSpy = vi.spyOn(server, "resource");

    registerResources(server);

    expect(resourceSpy).toHaveBeenCalledTimes(3);
    // server.resource(name, uri, metadata, handler) — second arg is the URI string.
    const uris = resourceSpy.mock.calls.map((c) => c[1] as string).sort();
    expect(uris).toEqual(EXPECTED_URIS);
  });

  it("each resource handler returns non-empty markdown content", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    const resourceSpy = vi.spyOn(server, "resource");

    registerResources(server);

    for (const call of resourceSpy.mock.calls) {
      const handler = call[3] as (uri: URL, extra: unknown) => Promise<{
        contents: Array<{ text: string; mimeType?: string }>;
      }>;
      const result = await handler(new URL(call[1] as string), {});
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe("text/markdown");
      expect(result.contents[0].text.length).toBeGreaterThan(50);
    }
  });
});
