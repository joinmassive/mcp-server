import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stripCompletionHtml, parseSourcesHtml } from "../../src/parsers/ai-html.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface AiSample {
  completion?: string;
  sources?: string;
  model?: string;
  subqueries?: string[];
}

const fixture: AiSample = JSON.parse(
  readFileSync(resolve(__dirname, "../fixtures/ai-sample.json"), "utf8"),
);

describe("stripCompletionHtml", () => {
  it("removes tags and returns plain text", () => {
    const html = "<p>Hello <strong>world</strong>.</p>";
    expect(stripCompletionHtml(html)).toBe("Hello world.");
  });

  it("preserves line breaks for block elements", () => {
    const html = "<p>One.</p><p>Two.</p>";
    const out = stripCompletionHtml(html);
    expect(out).toMatch(/One\.\s*\n+\s*Two\./);
  });

  it("returns empty string for empty/null/undefined input", () => {
    expect(stripCompletionHtml("")).toBe("");
    // @ts-expect-error -- runtime fallthrough
    expect(stripCompletionHtml(null)).toBe("");
    // @ts-expect-error -- runtime fallthrough
    expect(stripCompletionHtml(undefined)).toBe("");
  });

  it("handles a real completion fixture without crashing", () => {
    const completion = fixture.completion ?? "";
    expect(completion.length).toBeGreaterThan(0); // sanity: fixture has content
    const out = stripCompletionHtml(completion);
    expect(out.length).toBeGreaterThan(0);
    // No raw HTML tags remain
    expect(out).not.toMatch(/<[a-z][^>]*>/i);
  });

  it("collapses whitespace runs", () => {
    const html = "<div>  Lots\n\n\n   of   space  </div>";
    const out = stripCompletionHtml(html);
    expect(out).not.toMatch(/ {2}/); // no double spaces
    expect(out).not.toMatch(/\n{3,}/); // no triple newlines
  });
});

describe("parseSourcesHtml", () => {
  it("extracts {title, url} from <a href=...>title</a> blocks", () => {
    const html =
      '<a href="https://example.com/a">Example A</a><a href="https://example.com/b">Example B</a>';
    expect(parseSourcesHtml(html)).toEqual([
      { title: "Example A", url: "https://example.com/a" },
      { title: "Example B", url: "https://example.com/b" },
    ]);
  });

  it("returns empty array for empty/missing input", () => {
    expect(parseSourcesHtml("")).toEqual([]);
    // @ts-expect-error -- runtime fallthrough
    expect(parseSourcesHtml(null)).toEqual([]);
    // @ts-expect-error -- runtime fallthrough
    expect(parseSourcesHtml(undefined)).toEqual([]);
  });

  it("skips anchors with no href", () => {
    const html = '<a>noop</a><a href="https://example.com">ok</a>';
    expect(parseSourcesHtml(html)).toEqual([{ title: "ok", url: "https://example.com" }]);
  });

  it("skips anchors with non-http href (mailto:, javascript:, fragment-only)", () => {
    const html =
      '<a href="mailto:a@b.com">m</a><a href="javascript:void(0)">j</a><a href="#anchor">f</a><a href="https://example.com">ok</a>';
    expect(parseSourcesHtml(html)).toEqual([{ title: "ok", url: "https://example.com" }]);
  });

  it("uses the href as fallback title when anchor text is empty", () => {
    const html = '<a href="https://example.com"></a>';
    expect(parseSourcesHtml(html)).toEqual([
      { title: "https://example.com", url: "https://example.com" },
    ]);
  });

  it("handles real fixture sources field without crashing (may be empty array)", () => {
    const sources = fixture.sources ?? "";
    const out = parseSourcesHtml(sources);
    expect(Array.isArray(out)).toBe(true);
  });
});
