# @joinmassive/mcp-server

Official MCP server for the [Massive Web Render API](https://docs.joinmassive.com/web-render). Give your AI agents real-time web access — fetch any URL, search Google, query AI chatbots — with JS rendering, captcha solving, and 195+ country geo-targeting handled automatically.

## Quickstart (Claude Desktop)

### Option A — One-click install (`.mcpb`)

1. Download the latest [`massive-mcp-X.Y.Z.mcpb`](https://github.com/joinmassive/mcp-server/releases/latest) from GitHub Releases.
2. Open the file with Claude Desktop (or drag-drop into Settings → Extensions).
3. Paste your Massive API token when prompted. Token is stored in your OS keychain.

### Option B — npx + config snippet

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "massive": {
      "command": "npx",
      "args": ["-y", "@joinmassive/mcp-server"],
      "env": { "MASSIVE_TOKEN": "your-token-here" }
    }
  }
}
```

Restart Claude Desktop.

### Other MCP clients

The same JSON snippet works for any MCP-compatible client. Drop it into the client's config file:

| Client | Config path |
|---|---|
| Cursor | `~/.cursor/mcp.json` |
| Continue | `~/.continue/config.json` (under `mcpServers`) |
| Cody | `~/Library/Application Support/com.sourcegraph.cody/mcp.json` (macOS) |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| VS Code (MCP) | `~/.config/Code/User/settings.json` (under `chat.mcp.servers`) |

If `npx` isn't on the client's PATH, swap to a direct binary path: `"command": "node", "args": ["/absolute/path/to/dist/index.js"]`.

## Getting an API token

Sign in at [dashboard.joinmassive.com](https://dashboard.joinmassive.com) → Developer → API Keys.

## Tools

### `web_fetch`

Fetch any URL. Returns Markdown by default (best for LLMs).

| Arg | Type | Default | Notes |
|-----|------|---------|-------|
| `url` | string (required) | — |   |
| `format` | `"markdown"` \| `"rendered"` \| `"raw"` | `"markdown"` |   |
| `country` | string (ISO 3166-1 alpha-2) | — |   |
| `city` | string | — |   |
| `device` | string | — | Device emulation name |

Example prompt: *"Use the Massive MCP server to fetch https://news.ycombinator.com and summarise the top stories."*

### `web_search`

Google search results, parsed into structured JSON.

| Arg | Type | Default |
|-----|------|---------|
| `query` (required, ≤ 255 chars) | string | — |
| `country` | string (ISO) | — |
| `city` | string | — |
| `max_results` | number | 10 |

Returns: `{ organic, ai_overview, people_also_ask, query }`.

Example shape:

```json
{
  "query": "best espresso machines 2026",
  "organic": [
    { "title": "...", "url": "https://...", "snippet": "..." }
  ],
  "ai_overview": { "answer": "...", "sources": [{ "domain": "wirecutter.com", "url": "https://..." }] },
  "people_also_ask": [
    { "question": "What is the best espresso machine for beginners?", "answer": "" }
  ]
}
```

Example prompt: *"Use web_search to find recent reviews of espresso machines and return the top 3 organic results plus the AI overview."*

### `ai_chat_completion`

Chatbot answer with sources.

| Arg | Type | Default |
|-----|------|---------|
| `prompt` (required, ≤ 2047 chars) | string | — |
| `model` | `"chatgpt"` \| `"gemini"` \| `"perplexity"` \| `"copilot"` | `"chatgpt"` |
| `country` | string (ISO) | — |
| `city` | string | — |

Returns: `{ completion, sources, model, subqueries? }`.

### `account_status`

No args. Returns `{ credits_remaining }`. Useful to warn the user before they run out of credits. Free — does not consume credits.

## Troubleshooting

**"MASSIVE_TOKEN env var is not set"**
Confirm the `env` block in your Claude Desktop config has the token. Restart Claude Desktop.

**"Massive endpoint is autoscaling, please retry"**
A 503 from upstream. The server already retried once; wait ~10s and try again.

**"403 Forbidden — the request was rejected (likely captcha or invalid token)"**
Either the target site rejected our captcha solver, or the token is invalid. Re-check the token at the dashboard.

**No tools appear in Claude Desktop**
Settings → Developer → check the MCP server logs. The most common cause is `command: "npx"` not being on Claude Desktop's PATH. Run `which npx` in Terminal — if it's under Homebrew (`/opt/homebrew/bin`), Claude Desktop's PATH won't include it. As a workaround, use a direct path: `"command": "node", "args": ["/absolute/path/to/dist/index.js"]`. Or install the `.mcpb` bundle (Option A above), which sidesteps PATH issues entirely.

## Contributing

Issues and PRs welcome at [github.com/joinmassive/mcp-server](https://github.com/joinmassive/mcp-server).

## License

MIT. See [LICENSE](./LICENSE).
