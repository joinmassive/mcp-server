# Changelog

## v0.2.1 (2026-05-05)

Polish on top of v0.2.0 — visual fixes for Claude Desktop and a runtime API migration. No new tool capabilities.

### Added
- **Per-tool icons** in `tools/list` responses (48×48 inlined as `data:image/png;base64,…`). Clients render the Massive logo as the per-tool badge instead of a generic "M" placeholder.

### Changed
- **Explicit tool titles** via `server.registerTool(...)` migration. Fixes Claude Desktop's auto-titlecase rendering of `ai_chat_completion` as "Ai chat completion" — now shows "AI chat completion". Other tools also get explicit titles ("Web fetch", "Web search", "Account status").
- **Square 512×512 connector icon** replaces the previous letterboxed 343×189 image. Renders correctly in connector listings.

## v0.2.0 (2026-05-04)

### Added
- **New tool params** (additive, backward-compatible):
  - `web_fetch`: `expiration`, `difficulty`, `subdivision`
  - `web_search`: `expiration`, `language`, `display`, `subdivision`
  - `ai_chat_completion`: `expiration`, `language`, `display`, `device`, `subdivision`
- **MCP resources** for in-client reference: `docs://massive/pricing`, `docs://massive/geotargeting`, `docs://massive/changelog`.
- **MCPB starter prompts**: `web_search_full`, `web_fetch_markdown`, `ai_chat_full`, `account_check`. Registered both at the manifest level (DXT discovery) and at the MCP server level via `server.prompt(...)` (runtime).
- **README sections**: "Pricing & cost control", "Resources", and updated arg tables for each tool.

### Changed
- Tool descriptions now enumerate cost-affecting params explicitly (model can be cost-conscious).
- Manifest `description` and `long_description` clarified; `tools[]` descriptions sync with new params.
- `language`/`display` description: accepts common name, two-letter ISO 639-1 (e.g. `"es"`), or Google code, case-insensitive. (Massive's API rejects ISO 639-2 codes like `"spa"` with HTTP 422.)
- `toolError` now propagates the upstream response body (truncated to 1024 chars + truncation marker) into both the text content and `structuredContent.body`. Lets the model self-correct on 4xx errors. Reverses the v0.1 "suppress upstream body" defense-in-depth choice.

### Fixed
- DXT manifest `prompts[]` schema: `arguments` is `string[]` (just arg names) and template variables use `${arguments.X}` syntax.

### Deferred
- Async / `mode=async` polling.
- Sticky `session` cookie.
- Search pagination (`serps`/`size`/`offset`).

## v0.1.0 (2026-05-01)

Initial public release. Four tools: `web_fetch`, `web_search`, `ai_chat_completion`, `account_status`.
