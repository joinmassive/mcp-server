import { describe, it, expect } from "vitest";
import { toolError } from "../../src/tools/common.js";
import { MassiveClientError } from "../../src/client.js";

describe("toolError", () => {
  it("forwards upstream body to structuredContent.body and to text content", () => {
    const err = new MassiveClientError("HTTP 422 — upstream error", {
      status: 422,
      body: "language must be a valid ISO 639-1 code or language name",
    });
    const result = toolError(err);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      status: 422,
      body: "language must be a valid ISO 639-1 code or language name",
    });
    expect(result.content[0].text).toContain("HTTP 422 — upstream error");
    expect(result.content[0].text).toContain("Upstream response: language must be a valid ISO 639-1 code");
  });

  it("truncates upstream body to 1024 chars + marker", () => {
    const longBody = "x".repeat(5000);
    const err = new MassiveClientError("HTTP 400 — upstream error", { status: 400, body: longBody });
    const result = toolError(err);

    const sc = result.structuredContent as { status: number; body: string };
    expect(sc.body.startsWith("x".repeat(1024))).toBe(true);
    expect(sc.body).toContain("(truncated)");
    expect(sc.body.length).toBeLessThan(longBody.length);
  });

  it("omits body when upstream returned an empty body", () => {
    const err = new MassiveClientError("HTTP 502 — upstream error", { status: 502, body: "" });
    const result = toolError(err);

    expect(result.structuredContent).toEqual({ status: 502 });
    expect(result.content[0].text).toBe("Error: HTTP 502 — upstream error");
    expect(result.content[0].text).not.toContain("Upstream response");
  });

  it("omits body and status when error has no detail (e.g. timeout, network)", () => {
    const err = new MassiveClientError("Request timed out after 180000ms");
    const result = toolError(err);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Error: Request timed out after 180000ms");
    expect(result.structuredContent).toBeUndefined();
  });

  it("handles non-MassiveClientError errors with just a generic Error message", () => {
    const err = new Error("Something exploded");
    const result = toolError(err);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Error: Something exploded");
    expect(result.structuredContent).toBeUndefined();
  });

  it("handles non-Error throwables by stringifying them", () => {
    const result = toolError("just a string");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Error: just a string");
  });
});
