import { MassiveClientError } from "../client.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const MAX_BODY_CHARS = 1024;

export function toolError(err: unknown): CallToolResult {
  const message =
    err instanceof MassiveClientError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err);

  const isMassiveErr = err instanceof MassiveClientError;
  const status = isMassiveErr && typeof err.detail.status === "number" ? err.detail.status : undefined;
  const rawBody = isMassiveErr ? err.detail.body : undefined;
  const body =
    rawBody && rawBody.length > MAX_BODY_CHARS
      ? `${rawBody.slice(0, MAX_BODY_CHARS)} …(truncated)`
      : rawBody || undefined;

  const text = body ? `Error: ${message}\nUpstream response: ${body}` : `Error: ${message}`;

  const result: CallToolResult = {
    content: [{ type: "text", text }],
    isError: true,
  };

  if (status !== undefined || body) {
    const structured: Record<string, unknown> = {};
    if (status !== undefined) structured.status = status;
    if (body) structured.body = body;
    result.structuredContent = structured;
  }
  return result;
}
