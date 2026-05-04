import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { aiChatHandler } from "../../src/tools/ai-chat.js";
import { MassiveClient } from "../../src/client.js";

describe("aiChatHandler", () => {
  beforeEach(() => {
    process.env.MASSIVE_TOKEN = "test-token";
  });
  afterEach(() => {
    delete process.env.MASSIVE_TOKEN;
    vi.restoreAllMocks();
  });

  it("calls /ai with format=json and returns plain-text completion + structured sources", async () => {
    const apiBody = {
      completion: "<p>Answer here.</p>",
      sources: '<a href="https://example.com/x">Example</a>',
      model: "chatgpt",
      subqueries: ["q1", "q2"],
    };
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(apiBody), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    const result = await aiChatHandler({ prompt: "what is mcp" }, client);

    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).toMatch(/format=json/);
    expect(reqUrl).toMatch(/model=chatgpt/);
    expect(reqUrl).toMatch(/prompt=what(\+|%20)is(\+|%20)mcp/);
    const sc = result.structuredContent as {
      completion: string;
      sources: Array<{ title: string; url: string }>;
      model: string;
      subqueries?: string[];
    };
    expect(sc.completion).toBe("Answer here.");
    expect(sc.sources).toEqual([{ title: "Example", url: "https://example.com/x" }]);
    expect(sc.model).toBe("chatgpt");
    expect(sc.subqueries).toEqual(["q1", "q2"]);
  });

  it("rejects prompts > 2047 chars and preserves the user-friendly suffix", async () => {
    const client = new MassiveClient({ fetchImpl: vi.fn() });
    const result = await aiChatHandler({ prompt: "x".repeat(2048) }, client);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("prompt must be ≤ 2047 characters");
  });

  it("forwards model, country, city", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ completion: "", sources: "", model: "perplexity" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    await aiChatHandler({ prompt: "hi", model: "perplexity", country: "JP", city: "Tokyo" }, client);
    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).toMatch(/model=perplexity/);
    expect(reqUrl).toMatch(/country=JP/);
    expect(reqUrl).toMatch(/city=Tokyo/);
  });

  it("omits subqueries from structuredContent when API doesn't return them", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ completion: "<p>x</p>", sources: "", model: "chatgpt" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const result = await aiChatHandler({ prompt: "hi" }, client);
    const sc = result.structuredContent as Record<string, unknown>;
    expect("subqueries" in sc).toBe(false);
  });

  it("returns an MCP error result on upstream failure", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const result = await aiChatHandler({ prompt: "x" }, client);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/403/);
  });

  it("forwards expiration when provided", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ completion: "<p>x</p>", sources: "", model: "chatgpt" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    await aiChatHandler({ prompt: "hi", expiration: 7 }, client);

    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).toMatch(/expiration=7/);
  });

  it("forwards expiration=0 (live, no cache)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ completion: "<p>x</p>", sources: "", model: "chatgpt" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    await aiChatHandler({ prompt: "hi", expiration: 0 }, client);

    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).toMatch(/expiration=0/);
  });

  it("omits expiration when not provided", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ completion: "<p>x</p>", sources: "", model: "chatgpt" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    await aiChatHandler({ prompt: "hi" }, client);

    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).not.toMatch(/expiration=/);
  });

  it("forwards language and display params", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ completion: "<p>x</p>", sources: "", model: "chatgpt" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    await aiChatHandler({ prompt: "hola", language: "spanish", display: "spa" }, client);

    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).toMatch(/language=spanish/);
    expect(reqUrl).toMatch(/display=spa/);
  });

  it("omits language and display when not provided", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ completion: "<p>x</p>", sources: "", model: "chatgpt" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    await aiChatHandler({ prompt: "hi" }, client);

    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).not.toMatch(/language=/);
    expect(reqUrl).not.toMatch(/display=/);
  });
});
