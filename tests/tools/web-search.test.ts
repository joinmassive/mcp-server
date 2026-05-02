import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { webSearchHandler } from "../../src/tools/web-search.js";
import { MassiveClient } from "../../src/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(
  resolve(__dirname, "../fixtures/search-sample.html"),
  "utf8",
);

describe("webSearchHandler", () => {
  beforeEach(() => {
    process.env.MASSIVE_TOKEN = "test-token";
  });
  afterEach(() => {
    delete process.env.MASSIVE_TOKEN;
    vi.restoreAllMocks();
  });

  it("calls /search with terms= and awaiting=ai&awaiting=answers, returns parsed JSON", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(fixture, { status: 200, headers: { "content-type": "text/html" } }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    const result = await webSearchHandler(
      { query: "mcp server", max_results: 10 },
      client,
    );

    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).toMatch(/awaiting=ai&awaiting=answers/);
    expect(reqUrl).toMatch(/terms=mcp\+server|terms=mcp%20server/);
    expect(reqUrl).not.toMatch(/[?&]query=/); // MCP arg name must not leak to API
    expect(result.structuredContent).toMatchObject({ query: "mcp server" });
    const sc = result.structuredContent as { organic: unknown[] };
    expect(Array.isArray(sc.organic)).toBe(true);
  });

  it("forwards country/city and respects max_results", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(fixture, { status: 200, headers: { "content-type": "text/html" } }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const result = await webSearchHandler(
      { query: "x", country: "FR", city: "Paris", max_results: 3 },
      client,
    );

    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).toMatch(/country=FR/);
    expect(reqUrl).toMatch(/city=Paris/);
    const sc = result.structuredContent as { organic: unknown[] };
    expect(sc.organic.length).toBeLessThanOrEqual(3);
  });

  it("rejects queries longer than 255 characters", async () => {
    const client = new MassiveClient({ fetchImpl: vi.fn() });
    const result = await webSearchHandler({ query: "x".repeat(256), max_results: 10 }, client);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/255/);
  });

  it("preserves the exact 'query must be ≤ 255 characters' suffix in the error message", async () => {
    const client = new MassiveClient({ fetchImpl: vi.fn() });
    const result = await webSearchHandler({ query: "x".repeat(300), max_results: 10 }, client);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("query must be ≤ 255 characters");
  });

  it("returns an MCP error result on upstream failure", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const result = await webSearchHandler({ query: "x", max_results: 10 }, client);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/403/);
  });
});
