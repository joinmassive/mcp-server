import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PRICING_MD, GEOTARGETING_MD, CHANGELOG_MD } from "./bundled.js";

interface ResourceSpec {
  name: string;
  uri: string;
  title: string;
  description: string;
  text: string;
}

const RESOURCES: ResourceSpec[] = [
  {
    name: "pricing",
    uri: "docs://massive/pricing",
    title: "Massive Pricing & Cost Multipliers",
    description: "Credit cost per endpoint and difficulty/speed multipliers.",
    text: PRICING_MD,
  },
  {
    name: "geotargeting",
    uri: "docs://massive/geotargeting",
    title: "Massive Geotargeting Reference",
    description: "Country / subdivision / city formats and examples for routing requests.",
    text: GEOTARGETING_MD,
  },
  {
    name: "changelog",
    uri: "docs://massive/changelog",
    title: "Massive MCP Server Changelog",
    description: "What's new in each release.",
    text: CHANGELOG_MD,
  },
];

export function registerResources(server: McpServer): void {
  for (const r of RESOURCES) {
    server.resource(
      r.name,
      r.uri,
      { title: r.title, description: r.description, mimeType: "text/markdown" },
      async () => ({
        contents: [{ uri: r.uri, mimeType: "text/markdown", text: r.text }],
      }),
    );
  }
}
