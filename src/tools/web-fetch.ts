import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MassiveClient } from "../client.js";
import { toolError } from "./common.js";

export const webFetchInput = {
  url: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), "url must use http(s) protocol")
    .describe("URL to fetch (must be a valid http(s) URL)"),
  format: z
    .enum(["markdown", "rendered", "raw"])
    .default("markdown")
    .describe("Output format. 'markdown' is best for LLM consumption."),
  country: z.string().length(2).optional().describe("ISO 3166-1 alpha-2 country code (e.g. 'US', 'DE')"),
  city: z.string().optional().describe("City name for geo-targeting"),
  device: z.string().optional().describe("Device emulation name (e.g. 'iphone-15')"),
};

const InputSchema = z.object(webFetchInput);
type Input = z.infer<typeof InputSchema>;

type ToolResult = CallToolResult;

export async function webFetchHandler(input: Input, client: MassiveClient): Promise<ToolResult> {
  try {
    // Apply Zod defaults. Redundant in production (server.tool() pre-validates),
    // but unit tests call the handler directly with raw input.
    const parsed = InputSchema.parse(input);
    const body = await client.get<string>("/browser", {
      url: parsed.url,
      format: parsed.format,
      country: parsed.country,
      city: parsed.city,
      device: parsed.device,
    });

    const structured: Record<string, unknown> = {
      format: parsed.format,
      url: parsed.url,
      bytes: Buffer.byteLength(body, "utf8"),
    };
    if (parsed.country) structured.country = parsed.country;
    if (parsed.city) structured.city = parsed.city;
    if (parsed.device) structured.device = parsed.device;

    return {
      content: [{ type: "text", text: body }],
      structuredContent: structured,
    };
  } catch (err) {
    return toolError(err);
  }
}

export function registerWebFetch(server: McpServer, client: MassiveClient): void {
  server.tool(
    "web_fetch",
    "Fetch any URL through Massive. Returns Markdown by default (best for LLM consumption); also supports rendered HTML and raw HTML. Handles JS rendering, captcha solving, and geo-targeting (195+ countries). Cost: 1 credit base; premium features (rendered format, geo-targeting) add multipliers — see https://joinmassive.com/pricing.",
    webFetchInput,
    async (args) => webFetchHandler(args, client),
  );
}
