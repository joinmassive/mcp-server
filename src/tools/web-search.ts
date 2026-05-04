import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MassiveClient } from "../client.js";
import { parseSerp } from "../parsers/search-html.js";
import { toolError } from "./common.js";

export const webSearchInput = {
  query: z
    .string()
    .min(1)
    .max(255, "query must be ≤ 255 characters")
    .describe("Search query (max 255 chars)"),
  country: z.string().length(2).optional().describe("ISO 3166-1 alpha-2 country code"),
  city: z.string().optional().describe("City name for geo-targeting"),
  max_results: z.number().int().min(1).max(50).default(10).describe("Max organic results to return (default 10)"),
  expiration: z
    .number()
    .int("expiration must be an integer (days)")
    .min(0, "expiration must be 0–365 days")
    .max(365, "expiration must be 0–365 days")
    .optional()
    .describe("Days the cached result is reused (0 = always live; default 1)."),
  language: z
    .string()
    .min(2)
    .max(64)
    .optional()
    .describe("Search language. Accepts language name (e.g. 'spanish') or ISO 639-1 code (e.g. 'es'). Case-insensitive."),
  display: z
    .string()
    .min(2)
    .max(64)
    .optional()
    .describe("UI display language. Same format as `language`."),
};

const InputSchema = z.object(webSearchInput);
type Input = z.infer<typeof InputSchema>;

export async function webSearchHandler(input: Input, client: MassiveClient): Promise<CallToolResult> {
  try {
    // Apply Zod defaults. Redundant in production (server.tool() pre-validates),
    // but unit tests call the handler directly with raw input.
    const parsed = InputSchema.parse(input);
    // Note: API param is `terms`, MCP-facing arg is `query`. Translate here.
    const html = await client.get<string>("/search", {
      terms: parsed.query,
      country: parsed.country,
      city: parsed.city,
      awaiting: ["ai", "answers"],
      expiration: parsed.expiration,
      language: parsed.language,
      display: parsed.display,
    });

    const serp = parseSerp(html, { query: parsed.query, maxResults: parsed.max_results });

    return {
      content: [{ type: "text", text: JSON.stringify(serp, null, 2) }],
      structuredContent: serp as unknown as Record<string, unknown>,
    };
  } catch (err) {
    return toolError(err);
  }
}

export function registerWebSearch(server: McpServer, client: MassiveClient): void {
  server.tool(
    "web_search",
    [
      "Google search results parsed into structured JSON. Returns organic results, AI overview (if present), and 'people also ask' questions.",
      "",
      "Cost: 1 credit base. No multipliers.",
      "Use expiration=0 for always-live results; default expiration=1 (day) reuses cached SERPs.",
      "Localize with country, city, language, display.",
    ].join("\n"),
    webSearchInput,
    async (args) => webSearchHandler(args, client),
  );
}
