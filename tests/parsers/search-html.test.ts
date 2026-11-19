import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSerp, resultLink } from "../../src/parsers/search-html.js";

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

// Results pages from November 2026, cut to the blocks the parser reads.
// Session values removed, every Google link token replaced with a made-up one, names of people replaced.
const fx = (name: string) => readFileSync(resolve(__dirname, `../fixtures/${name}`), "utf8");
const webScraping = fx("search-2026-11-web-scraping-api.html");
const withOverview = fx("search-2026-11-ai-overview.html");

describe("parseSerp on 2026 pages (results link through /goto)", () => {
  it("returns every result, with Google's link and the address text as printed", () => {
    const out = parseSerp(webScraping, { query: "web scraping API", maxResults: 10 });
    expect(out.organic).toHaveLength(9);
    const first = out.organic[0]!;
    expect(first.title).toBe("9 Best Web Scraping APIs for Developers in 2026");
    expect(first.url).toMatch(/^https:\/\/www\.google\.com\/goto\?url=[A-Za-z0-9_-]+$/);
    expect(first.url_is_redirect).toBe(true);
    expect(first.displayed_url).toBe("https://visionvix.com › Blog");
    expect(first.domain).toBe("visionvix.com");
    expect(first.snippet).toMatch(/web scraping API/);
    for (const r of out.organic) {
      expect(r.url).toMatch(/^https:\/\/www\.google\.com\/goto\?url=/);
      expect(r.url).not.toMatch(/gsessionid/);
      expect(r.url_is_redirect).toBe(true);
      expect(r.domain).not.toBeNull();
    }
    expect(out.warnings).toBeUndefined();
  });

  it("keeps forum results, whose address text is not an address, and lists AI overview sources one per cited link", () => {
    const out = parseSerp(withOverview, { query: "x", maxResults: 10 });
    const forum = out.organic.find((r) => /comments/.test(r.displayed_url));
    expect(forum).toBeDefined();
    expect(forum!.domain).toBeNull();
    expect(forum!.url).toMatch(/^https:\/\/www\.google\.com\/goto\?url=/);

    const aio = out.ai_overview!;
    expect(aio.text.length).toBeGreaterThan(60);
    expect(aio.sources.map((s) => s.label)).toEqual([
      "YouTube · Wiza",
      "PCMag",
      "Reddit",
      "Bigin by Zoho CRM",
      "www.dench.com",
    ]);
    for (const s of aio.sources) {
      expect(s.url).toMatch(/^https:\/\/www\.google\.com\/goto\?url=/);
      expect(s.url_is_redirect).toBe(true);
    }
    expect(new Set(aio.sources.map((s) => s.url)).size).toBe(aio.sources.length);
    expect(aio.source_domains).toContain("youtube.com");
    expect(aio.source_domains).toContain("pcmag.com");
  });

  it("reads 'People also ask' answers, now written as AI Mode replies", () => {
    // "People also ask" blocks of a November 2026 page (wait for answers on); names of people replaced.
    const out = parseSerp(fx("search-2026-11-people-also-ask.html"), { query: "what is a vector database", maxResults: 10 });
    expect(out.people_also_ask.map((q) => q.question)).toEqual([
      "What is a vector database for dummies?",
      "What is an example of Vector data?",
      "Is a vector database a relational database?",
      "What is Vector data science?",
    ]);
    for (const q of out.people_also_ask) expect(q.answer.length).toBeGreaterThan(200);
    expect(out.people_also_ask[0]!.answer).toMatch(/^A vector database is a specialized system/);
    expect(out.people_also_ask[2]!.answer).toMatch(/^No, a vector database is not a relational database/);
  });

  it("warns when 'People also ask' answers are on the page but could not be read", () => {
    const page = fx("search-2026-11-people-also-ask.html");
    expect(parseSerp(page, { query: "x", maxResults: 10 }).warnings).toBeUndefined();
    const moved = page.replace(/\bmZJni\b/g, "renamedByGoogle");
    const out = parseSerp(moved, { query: "x", maxResults: 10 });
    expect(out.people_also_ask.filter((q) => q.answer)).toEqual([]);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings![0]).toMatch(/^4 "people also ask" answer\(s\) are on the page but could not be read/);
  });

  it("does not warn about unexpanded 'People also ask' questions", () => {
    const out = parseSerp(webScraping, { query: "x", maxResults: 10 });
    expect(out.people_also_ask.length).toBeGreaterThan(0);
    expect(out.warnings).toBeUndefined();
  });

  it("warns when the page has results but none could be read", () => {
    const moved = webScraping.replace(/\byuRUbf\b/g, "renamedByGoogle");
    const out = parseSerp(moved, { query: "x", maxResults: 10 });
    expect(out.organic).toEqual([]);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings![0]).toMatch(/could be read/);
  });

  it("does not warn on a page with no results", () => {
    const out = parseSerp("<html><body><div id=\"rso\"></div></body></html>", { query: "x", maxResults: 10 });
    expect(out.organic).toEqual([]);
    expect(out.warnings).toBeUndefined();
  });

  it("keeps plain links as they were on older pages", () => {
    const out = parseSerp(fixture, { query: "x", maxResults: 10 });
    for (const r of out.organic) {
      expect(r.url).toMatch(/^https?:\/\//);
      expect(r.url_is_redirect).toBe(false);
      expect(r.domain).toBe(new URL(r.url!).hostname.replace(/^www\./, ""));
    }
  });
});

describe("resultLink", () => {
  it.each([
    ["https://example.com/a?b=1", { url: "https://example.com/a?b=1", url_is_redirect: false }],
    ["/url?q=https://example.com/a%3Fb%3D1&sa=U", { url: "https://example.com/a?b=1", url_is_redirect: false }],
    ["https://www.google.com/url?q=https://example.com/a", { url: "https://example.com/a", url_is_redirect: false }],
    ["/goto?url=CAESabc_-1&gsessionid=xyz", { url: "https://www.google.com/goto?url=CAESabc_-1", url_is_redirect: true }],
    ["/url?sa=t&url=CAESopaque", { url: "https://www.google.com/url?sa=t&url=CAESopaque", url_is_redirect: true }],
    ["/search?q=related", null],
    ["#", null],
    ["", null],
  ])("%s", (href, expected) => {
    expect(resultLink(href)).toEqual(expected);
  });
});
