import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { webFetchHandler } from "../../src/tools/web-fetch.js";
import { MassiveClient } from "../../src/client.js";

describe("webFetchHandler", () => {
  beforeEach(() => {
    process.env.MASSIVE_TOKEN = "test-token";
  });
  afterEach(() => {
    delete process.env.MASSIVE_TOKEN;
    vi.restoreAllMocks();
  });

  it("calls /browser with default format=markdown", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("# Page", { status: 200, headers: { "content-type": "text/markdown" } }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    const result = await webFetchHandler({ url: "https://example.com" }, client);

    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).toMatch(/format=markdown/);
    expect(reqUrl).toMatch(/url=https%3A%2F%2Fexample\.com/);
    expect(result.content[0]).toEqual({ type: "text", text: "# Page" });
    expect(result.structuredContent).toEqual({
      format: "markdown",
      url: "https://example.com",
      bytes: 6,
    });
    // Body must NOT be duplicated into structuredContent — already in content[0].text
    expect(result.structuredContent).not.toHaveProperty("content");
  });

  it("forwards optional country, city, device and echoes them in structured output", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    const result = await webFetchHandler(
      { url: "https://example.com", format: "raw", country: "DE", city: "Berlin", device: "iphone-15" },
      client,
    );

    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).toMatch(/format=raw/);
    expect(reqUrl).toMatch(/country=DE/);
    expect(reqUrl).toMatch(/city=Berlin/);
    expect(reqUrl).toMatch(/device=iphone-15/);
    expect(result.structuredContent).toMatchObject({
      format: "raw",
      country: "DE",
      city: "Berlin",
      device: "iphone-15",
    });
    expect(result.structuredContent).not.toHaveProperty("content");
  });

  it("returns an MCP error result on upstream failure", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    const result = await webFetchHandler({ url: "https://example.com" }, client);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/403/);
  });

  it.each(["file:///etc/passwd", "data:text/plain,hello", "gopher://example.com", "ftp://example.com"])(
    "rejects non-http(s) URL: %s",
    async (badUrl) => {
      const fetchSpy = vi.fn();
      const client = new MassiveClient({ fetchImpl: fetchSpy });
      const result = await webFetchHandler({ url: badUrl }, client);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/http\(s\)|protocol/i);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it("forwards expiration when provided", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    await webFetchHandler({ url: "https://example.com", expiration: 7 }, client);

    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).toMatch(/expiration=7/);
  });

  it("forwards expiration=0 (live, no cache) without omitting it", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    await webFetchHandler({ url: "https://example.com", expiration: 0 }, client);

    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).toMatch(/expiration=0/);
  });

  it("omits expiration from query when not provided", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    await webFetchHandler({ url: "https://example.com" }, client);

    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).not.toMatch(/expiration=/);
  });

  it.each([
    { val: -1, hint: "0–365" },
    { val: 366, hint: "0–365" },
    { val: 1.5, hint: "integer" },
  ])("rejects invalid expiration $val", async ({ val, hint }) => {
    const fetchSpy = vi.fn();
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const result = await webFetchHandler(
      { url: "https://example.com", expiration: val } as never,
      client,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toMatch(new RegExp(hint));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
