import { MassiveClientError } from "../client.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function toolError(err: unknown): CallToolResult {
  const message =
    err instanceof MassiveClientError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err);
  const result: CallToolResult = {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
  if (err instanceof MassiveClientError && typeof err.detail.status === "number") {
    result.structuredContent = { status: err.detail.status };
  }
  return result;
}
