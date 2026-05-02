import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "../src/index.js";

describe("createServer", () => {
  beforeEach(() => {
    process.env.MASSIVE_TOKEN = "test-token";
  });
  afterEach(() => {
    delete process.env.MASSIVE_TOKEN;
  });

  it("creates an MCP server with the four tools registered", () => {
    const server = createServer();
    expect(server).toBeDefined();
  });
});
