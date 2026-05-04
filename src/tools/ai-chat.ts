import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MassiveClient } from "../client.js";
import { stripCompletionHtml, parseSourcesHtml } from "../parsers/ai-html.js";
import { toolError } from "./common.js";

export const aiChatInput = {
  prompt: z
    .string()
    .min(1)
    .max(2047, "prompt must be ≤ 2047 characters")
    .describe("Prompt for the chatbot"),
  model: z
    .enum(["chatgpt", "gemini", "perplexity", "copilot"])
    .default("chatgpt")
    .describe("Which chatbot to query"),
  country: z.string().length(2).optional().describe("ISO 3166-1 alpha-2 country code"),
  city: z.string().optional().describe("City name for geo-targeting"),
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
    .describe("Conversation language. Accepts language name (e.g. 'spanish') or ISO 639-2 code (e.g. 'spa')."),
  display: z
    .string()
    .min(2)
    .max(64)
    .optional()
    .describe("UI display language. Same format as `language`."),
  device: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe("Device emulation name (e.g. 'iphone-15')."),
};

const InputSchema = z.object(aiChatInput);
type Input = z.infer<typeof InputSchema>;

interface ApiResponse {
  completion?: string;
  sources?: string;
  model?: string;
  subqueries?: string[];
}

export async function aiChatHandler(input: Input, client: MassiveClient): Promise<CallToolResult> {
  try {
    // Apply Zod defaults. Redundant in production (server.tool() pre-validates),
    // but unit tests call the handler directly with raw input.
    const parsed = InputSchema.parse(input);
    const body = await client.get<ApiResponse>("/ai", {
      prompt: parsed.prompt,
      model: parsed.model,
      country: parsed.country,
      city: parsed.city,
      format: "json",
      expiration: parsed.expiration,
      language: parsed.language,
      display: parsed.display,
      device: parsed.device,
    });

    const out = {
      completion: stripCompletionHtml(body.completion),
      sources: parseSourcesHtml(body.sources),
      model: body.model ?? parsed.model,
      ...(body.subqueries ? { subqueries: body.subqueries } : {}),
    };

    return {
      content: [{ type: "text", text: out.completion }],
      structuredContent: out as unknown as Record<string, unknown>,
    };
  } catch (err) {
    return toolError(err);
  }
}

export function registerAiChat(server: McpServer, client: MassiveClient): void {
  server.tool(
    "ai_chat_completion",
    [
      "Get a chatbot answer (ChatGPT, Gemini, Perplexity, or Copilot) with structured sources.",
      "",
      "Cost: 1 credit base. No multipliers.",
      "Use expiration=0 for fresh answers; default expiration=1 (day) reuses cached responses.",
      "Localize with country, city, language, display, device.",
    ].join("\n"),
    aiChatInput,
    async (args) => aiChatHandler(args, client),
  );
}
