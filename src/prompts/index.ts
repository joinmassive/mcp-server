import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface PromptSpec {
  name: string;
  description: string;
  argsSchema: Record<string, z.ZodString>;
  buildText: (args: Record<string, string>) => string;
}

const PROMPTS: PromptSpec[] = [
  {
    name: "web_search_full",
    description: "Google search: top 10 organic results, AI overview, and people-also-asked.",
    argsSchema: { topic: z.string().describe("What to search for") },
    buildText: ({ topic }) =>
      `Use web_search to search Google for "${topic}". List the top 10 organic results (title, URL, snippet), the AI overview (with sources) if present, and the people-also-asked questions.`,
  },
  {
    name: "web_fetch_markdown",
    description: "Fetch a URL as Markdown.",
    argsSchema: { url: z.string().describe("URL to fetch") },
    buildText: ({ url }) =>
      `Use web_fetch on ${url} with format=markdown. Show me the full Markdown content.`,
  },
  {
    name: "ai_chat_full",
    description: "Ask a chatbot (ChatGPT/Gemini/Perplexity/Copilot) and show answer + sources.",
    argsSchema: {
      model: z.string().describe("chatgpt | gemini | perplexity | copilot"),
      topic: z.string().describe("What to ask"),
    },
    buildText: ({ model, topic }) =>
      `Use ai_chat_completion with model=${model} to ask: "${topic}". Show the full answer, all sources, and any subqueries the model used.`,
  },
  {
    name: "account_check",
    description: "Show my Massive credit balance.",
    argsSchema: {},
    buildText: () =>
      "Call account_status. Report my remaining credits and the low-balance flag; if low_balance is true, share the top-up link.",
  },
];

export function registerPrompts(server: McpServer): void {
  for (const p of PROMPTS) {
    server.prompt(
      p.name,
      p.description,
      p.argsSchema,
      async (args) => ({
        messages: [
          {
            role: "user",
            content: { type: "text", text: p.buildText(args as Record<string, string>) },
          },
        ],
      }),
    );
  }
}
