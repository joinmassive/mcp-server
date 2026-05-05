import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { accountStatusHandler } from "../../src/tools/account-status.js";
import { MassiveClient } from "../../src/client.js";

describe("accountStatusHandler", () => {
  beforeEach(() => {
    process.env.MASSIVE_TOKEN = "test-token";
  });
  afterEach(() => {
    delete process.env.MASSIVE_TOKEN;
    vi.restoreAllMocks();
  });

  it("returns credits_remaining from the first array element", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ email: "a@b.com", credits: 990 }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });

    const result = await accountStatusHandler(client);

    const [reqUrl] = fetchSpy.mock.calls[0];
    expect(reqUrl).toBe("https://render.joinmassive.com/users");
    expect(result.structuredContent).toEqual({ credits_remaining: 990 });
  });

  it("does not leak the account email anywhere in the response", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ email: "secret@b.com", credits: 42 }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const result = await accountStatusHandler(client);
    expect(JSON.stringify(result)).not.toMatch(/secret@b\.com/);
    expect(result.content[0].text).toMatch(/\b42\b/);
  });

  it("returns a tool error when the response array is empty", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const result = await accountStatusHandler(client);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/no user|empty/i);
  });

  it("returns a tool error on upstream failure (e.g., 403)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const result = await accountStatusHandler(client);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/403/);
  });

  it("returns a tool error when response is not an array", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ email: "a@b.com", credits: 42 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const result = await accountStatusHandler(client);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/unexpected|invalid|shape/i);
  });

  it("flags low_balance when credits are below 100", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ credits: 42 }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const result = await accountStatusHandler(client);
    expect(result.structuredContent).toEqual({ credits_remaining: 42, low_balance: true });
  });

  it("does not flag low_balance at exactly 100 credits", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ credits: 100 }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const result = await accountStatusHandler(client);
    expect(result.structuredContent).toEqual({ credits_remaining: 100 });
  });
});

describe("toolError surfaces upstream status to the model", () => {
  beforeEach(() => {
    process.env.MASSIVE_TOKEN = "test-token";
  });
  afterEach(() => {
    delete process.env.MASSIVE_TOKEN;
    vi.restoreAllMocks();
  });

  it("includes status and body in structuredContent when err is a MassiveClientError", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("server boom", { status: 502 }));
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const result = await accountStatusHandler(client);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({ status: 502, body: "server boom" });
  });

  it("propagates upstream body to tool output so the model can self-correct", async () => {
    const UPSTREAM_BODY = "language must be a valid ISO 639-1 code";
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(UPSTREAM_BODY, { status: 422, headers: { "content-type": "text/plain" } }),
    );
    const client = new MassiveClient({ fetchImpl: fetchSpy });
    const result = await accountStatusHandler(client);
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain(UPSTREAM_BODY);
    expect(result.structuredContent).toMatchObject({ status: 422, body: UPSTREAM_BODY });
  });
});
