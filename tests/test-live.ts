import { MassiveClient } from "../src/client.js";

interface UserRow {
  email: string;
  credits: number;
}

interface AiResponse {
  completion?: string;
  sources?: string;
  model?: string;
}

async function main(): Promise<void> {
  if (!process.env.MASSIVE_TOKEN) {
    console.error("MASSIVE_TOKEN must be set for live tests.");
    process.exit(1);
  }

  const client = new MassiveClient();
  const results: Array<{ name: string; ok: boolean; detail: string }> = [];

  results.push(
    await run("web_fetch (markdown)", async () => {
      const body = await client.get<string>("/browser", {
        url: "https://example.com",
        format: "markdown",
      });
      return body.toLowerCase().includes("example domain");
    }),
  );

  results.push(
    await run("web_search", async () => {
      const html = await client.get<string>("/search", {
        terms: "openai",
        awaiting: ["ai", "answers"],
      });
      return typeof html === "string" && html.length > 1000;
    }),
  );

  results.push(
    await run("ai_chat_completion (chatgpt, json)", async () => {
      const body = await client.get<AiResponse>("/ai", {
        prompt: "what is mcp",
        model: "chatgpt",
        format: "json",
      });
      return Boolean(body?.completion);
    }),
  );

  results.push(
    await run("account_status", async () => {
      const body = await client.get<UserRow[]>("/users");
      return Array.isArray(body) && body.length === 1 && typeof body[0]?.credits === "number";
    }),
  );

  results.push(
    await run("web_fetch (expiration=0, live)", async () => {
      const body = await client.get<string>("/browser", {
        url: "https://example.com",
        format: "markdown",
        expiration: 0,
      });
      return body.toLowerCase().includes("example domain");
    }),
  );

  results.push(
    await run("web_search (language=es)", async () => {
      const html = await client.get<string>("/search", {
        terms: "noticias",
        awaiting: ["ai", "answers"],
        language: "es",
      });
      return typeof html === "string" && html.length > 1000;
    }),
  );

  for (const r of results) {
    console.error(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  ${r.detail}`);
  }
  if (results.some((r) => !r.ok)) process.exit(1);
}

async function run(
  name: string,
  fn: () => Promise<boolean>,
): Promise<{ name: string; ok: boolean; detail: string }> {
  try {
    const ok = await fn();
    return { name, ok, detail: ok ? "" : "(returned false)" };
  } catch (err) {
    return { name, ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
