import * as cheerio from "cheerio";

export function stripCompletionHtml(html: string | null | undefined): string {
  if (!html) return "";
  const $ = cheerio.load(`<div id="root">${html}</div>`);
  // Remove non-content tags entirely
  $("#root script, #root style, #root noscript, #root svg, #root img").remove();
  // Insert newlines after block elements so paragraph breaks survive
  $(
    "#root p, #root br, #root li, #root h1, #root h2, #root h3, #root h4, #root h5, #root h6, #root div, #root tr, #root section",
  ).each((_, el) => {
    $(el).append("\n");
  });
  const text = $("#root").text();
  return text
    .replace(/[ \t]+\n/g, "\n") // trailing whitespace before newline
    .replace(/\n[ \t]+/g, "\n") // leading whitespace after newline
    .replace(/[ \t]{2,}/g, " ") // collapse repeated horizontal spaces
    .replace(/\n{3,}/g, "\n\n") // collapse triple+ newlines to double
    .trim();
}

export interface SourceLink {
  title: string;
  url: string;
}

export function parseSourcesHtml(html: string | null | undefined): SourceLink[] {
  if (!html) return [];
  const $ = cheerio.load(`<div id="root">${html}</div>`);
  const out: SourceLink[] = [];
  $("#root a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (!/^https?:\/\//i.test(href)) return;
    const title = $(el).text().trim() || href;
    out.push({ title, url: href });
  });
  return out;
}
