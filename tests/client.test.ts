import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MassiveClient, MassiveClientError } from "../src/client.js";

describe("MassiveClient", () => {
  beforeEach(() => {
    process.env.MASSIVE_TOKEN = "test-token-abc";
  });

  afterEach(() => {
    delete process.env.MASSIVE_TOKEN;
    vi.restoreAllMocks();
  });

  it("does not throw on construction when MASSIVE_TOKEN is unset", () => {
    delete process.env.MASSIVE_TOKEN;
    expect(() => new MassiveClient()).not.toThrow();
  });

  it("throws MassiveClientError on first request when MASSIVE_TOKEN is unset", async () => {
    delete process.env.MASSIVE_TOKEN;
    const client = new MassiveClient();
    await expect(client.get("/users")).rejects.toThrow(MassiveClientError);
    await expect(client.get("/users")).rejects.toThrow(/MASSIVE_TOKEN/);
    await expect(client.get("/users")).rejects.toThrow(/dashboard\.joinmassive\.com\/developer\/api-keys/);
  });

  it("sends Authorization, User-Agent, and X-Source headers on every call", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("<html>ok</html>", { status: 200, headers: { "content-type": "text/html" } }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    await client.get("/browser", { url: "https://example.com" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [reqUrl, init] = fetchSpy.mock.calls[0];
    expect(reqUrl).toMatch(/^https:\/\/render\.joinmassive\.com\/browser\?/);
    expect(reqUrl).toMatch(/url=https%3A%2F%2Fexample\.com/);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token-abc");
    expect(headers["User-Agent"]).toMatch(/^massive-mcp\/0\.1\.0/);
    expect(headers["X-Source"]).toBe("mcp-server/0.1.0");
  });

  it("returns text body for non-JSON responses", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("<html>hi</html>", { status: 200, headers: { "content-type": "text/html" } }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const result = await client.get("/browser", { url: "https://example.com" });
    expect(result).toBe("<html>hi</html>");
  });

  it("returns parsed JSON for application/json responses", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ email: "a@b.com", credits: 5 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const result = await client.get("/users");
    expect(result).toEqual({ email: "a@b.com", credits: 5 });
  });

  it("supports array query params", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    await client.get("/search", { query: "x", awaiting: ["ai", "answers"] });
    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).toMatch(/awaiting=ai&awaiting=answers/);
  });

  it("skips undefined params from the URL", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    await client.get("/browser", { url: "https://example.com", country: undefined, city: undefined });
    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).not.toMatch(/country=/);
    expect(reqUrl).not.toMatch(/city=/);
    expect(reqUrl).toMatch(/url=https%3A%2F%2Fexample\.com/);
  });

  it("attaches status and body to MassiveClientError.detail on !res.ok", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("upstream said no", { status: 500, headers: { "content-type": "text/plain" } }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    await expect(client.get("/browser", { url: "x" })).rejects.toMatchObject({
      name: "MassiveClientError",
      detail: { status: 500, body: "upstream said no" },
    });
  });
});

describe("MassiveClient error handling", () => {
  beforeEach(() => {
    process.env.MASSIVE_TOKEN = "test-token-abc";
  });
  afterEach(() => {
    delete process.env.MASSIVE_TOKEN;
    vi.restoreAllMocks();
  });

  it("retries once after 5s on 503, then surfaces autoscaling message", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("still busy", { status: 503 }));
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    const promise = client.get("/browser", { url: "x" });
    // Attach the rejection handler before advancing timers to avoid unhandled rejection warning
    const assertion = expect(promise).rejects.toThrow(/autoscaling/i);
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("succeeds on retry if second attempt returns 200", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }));
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    const promise = client.get("/browser", { url: "x" });
    // Attach the resolution handler before advancing timers
    const assertion = expect(promise).resolves.toBe("ok");
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("surfaces 403 with a clear message (no retry)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    await expect(client.get("/browser", { url: "x" })).rejects.toThrow(/403/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("surfaces other 5xx with status code (no retry)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("oops", { status: 502 }));
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    await expect(client.get("/browser", { url: "x" })).rejects.toThrow(/502/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("surfaces network errors clearly and preserves the original error as cause", async () => {
    const networkErr = new TypeError("network failure");
    const fetchSpy = vi.fn().mockRejectedValue(networkErr);
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const err = await client.get("/browser", { url: "x" }).catch((e) => e);
    expect(err).toBeInstanceOf(MassiveClientError);
    expect(err.message).toMatch(/network failure/);
    expect(err.cause).toBe(networkErr);
  });
});

describe("MassiveClient request timeout", () => {
  beforeEach(() => {
    process.env.MASSIVE_TOKEN = "test-token-abc";
  });
  afterEach(() => {
    delete process.env.MASSIVE_TOKEN;
    delete process.env.MASSIVE_TIMEOUT_MS;
    vi.restoreAllMocks();
  });

  it("aborts the request after timeoutMs and surfaces a clear error", async () => {
    vi.useFakeTimers();
    // Mock fetch to honor the abort signal: reject with AbortError when signaled.
    const fetchSpy = vi.fn((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init.signal as AbortSignal;
        signal.addEventListener("abort", () => {
          const err = new DOMException("aborted", "AbortError");
          reject(err);
        });
      });
    });
    const client = new MassiveClient({ fetchImpl: fetchSpy as unknown as typeof fetch, timeoutMs: 1000 });

    const promise = client.get("/browser", { url: "x" });
    const assertion = expect(promise).rejects.toThrow(/timed out|timeout/i);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    vi.useRealTimers();
  });

  it("uses MASSIVE_TIMEOUT_MS env var when no explicit option is set", () => {
    process.env.MASSIVE_TIMEOUT_MS = "12345";
    const client = new MassiveClient();
    // Internal: timeoutMs is exposed for tests via a getter
    expect((client as unknown as { timeoutMs: number }).timeoutMs).toBe(12345);
  });

  it("defaults timeoutMs to 180000 (180s)", () => {
    const client = new MassiveClient();
    expect((client as unknown as { timeoutMs: number }).timeoutMs).toBe(180_000);
  });
});

describe("MassiveClient response size cap", () => {
  beforeEach(() => {
    process.env.MASSIVE_TOKEN = "test-token-abc";
  });
  afterEach(() => {
    delete process.env.MASSIVE_TOKEN;
    vi.restoreAllMocks();
  });

  it("rejects with a clear error when the response body exceeds the size cap", async () => {
    const CAP = 1024; // override for the test
    const oversized = new Uint8Array(CAP + 1).fill(65); // 'A' bytes
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(oversized);
        controller.close();
      },
    });
    const res = new Response(stream, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
    const fetchSpy = vi.fn().mockResolvedValue(res);
    const client = new MassiveClient({ fetchImpl: fetchSpy, maxResponseBytes: CAP });

    await expect(client.get("/browser", { url: "x" })).rejects.toThrow(/too large|size limit|exceed/i);
  });

  it("accepts a body at exactly the size cap", async () => {
    const CAP = 1024;
    const exact = new Uint8Array(CAP).fill(65);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(exact);
        controller.close();
      },
    });
    const res = new Response(stream, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
    const fetchSpy = vi.fn().mockResolvedValue(res);
    const client = new MassiveClient({ fetchImpl: fetchSpy, maxResponseBytes: CAP });

    const body = (await client.get("/browser", { url: "x" })) as string;
    expect(body.length).toBe(CAP);
  });
});

describe("MassiveClient 503 Retry-After", () => {
  beforeEach(() => {
    process.env.MASSIVE_TOKEN = "test-token-abc";
  });
  afterEach(() => {
    delete process.env.MASSIVE_TOKEN;
    vi.restoreAllMocks();
  });

  it("honors a delta-seconds Retry-After header on 503", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("busy", { status: 503, headers: { "retry-after": "2" } }),
      )
      .mockResolvedValueOnce(
        new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
      );
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    const promise = client.get("/browser", { url: "x" });
    const assertion = expect(promise).resolves.toBe("ok");
    // 2 seconds is enough; advance only 1.5s and the second call must NOT have happened
    await vi.advanceTimersByTimeAsync(1500);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600);
    await assertion;
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("caps Retry-After at 30s to avoid hung clients", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("busy", { status: 503, headers: { "retry-after": "9999" } }),
      )
      .mockResolvedValueOnce(
        new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
      );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const promise = client.get("/browser", { url: "x" });
    const assertion = expect(promise).resolves.toBe("ok");
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("falls back to 5s when Retry-After is missing or invalid", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(
        new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
      );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const promise = client.get("/browser", { url: "x" });
    const assertion = expect(promise).resolves.toBe("ok");
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
