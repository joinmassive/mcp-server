import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSerp } from "../../src/parsers/search-html.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(
  resolve(__dirname, "../fixtures/search-sample.html"),
  "utf8",
);

describe("parseSerp", () => {
  it("extracts at least one organic result with title, url, snippet", () => {
    const out = parseSerp(fixture, { query: "mcp server", maxResults: 10 });
    expect(out.query).toBe("mcp server");
    expect(out.organic.length).toBeGreaterThan(0);
    const first = out.organic[0]!;
    expect(typeof first.title).toBe("string");
    expect(first.url).toMatch(/^https?:\/\//);
    expect(typeof first.snippet).toBe("string");
    expect(first.position).toBe(1);
  });

  it("respects max_results", () => {
    const out = parseSerp(fixture, { query: "x", maxResults: 3 });
    expect(out.organic.length).toBeLessThanOrEqual(3);
  });

  it("returns ai_overview as null when missing, object when present", () => {
    const out = parseSerp(fixture, { query: "x", maxResults: 10 });
    if (out.ai_overview !== null) {
      expect(typeof out.ai_overview.text).toBe("string");
      expect(Array.isArray(out.ai_overview.sources)).toBe(true);
    }
    // null is also an acceptable result for this fixture
  });

  it("returns people_also_ask as an array (possibly empty)", () => {
    const out = parseSerp(fixture, { query: "x", maxResults: 10 });
    expect(Array.isArray(out.people_also_ask)).toBe(true);
  });

  it("orders organic results with sequential 1-based positions", () => {
    const out = parseSerp(fixture, { query: "x", maxResults: 5 });
    out.organic.forEach((r, i) => expect(r.position).toBe(i + 1));
  });
});
