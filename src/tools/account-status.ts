import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MassiveClient } from "../client.js";
import { toolError } from "./common.js";

interface UserRow {
  credits: number;
}

export async function accountStatusHandler(client: MassiveClient): Promise<CallToolResult> {
  try {
    const body = await client.get<UserRow[]>("/users");
    if (!Array.isArray(body)) {
      return {
        content: [{ type: "text", text: "Error: unexpected response shape from /users (expected array)." }],
        isError: true,
      };
    }
    if (body.length === 0) {
      return {
        content: [{ type: "text", text: "Error: empty user list returned for this token (no user found)." }],
        isError: true,
      };
    }
    const row = body[0]!;
    const out: { credits_remaining: number; low_balance?: true } = { credits_remaining: row.credits };
    if (row.credits < 100) out.low_balance = true;
    const text = out.low_balance
      ? `${out.credits_remaining} credits remaining (low balance — top up at https://dashboard.joinmassive.com).`
      : `${out.credits_remaining} credits remaining.`;
    return {
      content: [{ type: "text", text }],
      structuredContent: out as unknown as Record<string, unknown>,
    };
  } catch (err) {
    return toolError(err);
  }
}

export function registerAccountStatus(server: McpServer, client: MassiveClient): void {
  server.tool(
    "account_status",
    "Returns the user's remaining credit balance. Free; does not consume credits.",
    {},
    async () => accountStatusHandler(client),
  );
}
