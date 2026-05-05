# Changelog

## v0.2.0 (2026-05-04)

### Added
- **New tool params** (additive, backward-compatible):
  - `web_fetch`: `expiration`, `difficulty`, `subdivision`
  - `web_search`: `expiration`, `language`, `display`, `subdivision`
  - `ai_chat_completion`: `expiration`, `language`, `display`, `device`, `subdivision`
- **Explicit tool titles** via `server.registerTool(...)` migration. Fixes auto-titlecase quirks like "Ai chat completion" → "AI chat completion".
- **MCP resources** for in-client reference: `docs://massive/pricing`, `docs://massive/geotargeting`, `docs://massive/changelog`.
- **MCPB starter prompts**: `web_search_full`, `web_fetch_markdown`, `ai_chat_full`, `account_check`. Registered both at the manifest level (DXT discovery) and at the MCP server level via `server.prompt(...)` (runtime).
- **Per-tool icons** in `tools/list` responses (48×48 inlined as `data:image/png;base64,…`) so clients render the Massive logo as the per-tool badge.
- **Square 512×512 connector icon** replaces the previous letterboxed image.
- **README sections**: "Pricing & cost control", "Resources", and updated arg tables for each tool.

### Changed
- Tool descriptions now enumerate cost-affecting params explicitly (model can be cost-conscious).
- Manifest `description` and `long_description` clarified; `tools[]` descriptions sync with new params.
- `language`/`display` description corrected: accepts common name, two-letter ISO 639-1 (e.g. `"es"`), or Google code, case-insensitive. (The original draft mentioned ISO 639-2 like `"spa"`, which Massive's API rejects with HTTP 422.)
- `toolError` now propagates the upstream response body (truncated to 1024 chars + truncation marker) into both the text content and `structuredContent.body`. Lets the model self-correct on 4xx errors. Reverses the v0.1 "suppress upstream body" defense-in-depth choice.

### Fixed
- DXT manifest `prompts[]` schema: `arguments` is now `string[]` (just arg names) and template variables use `${arguments.X}` syntax. The original draft used object-shaped arguments and `{X}` syntax; Claude Desktop's manifest validator rejected it.

### Deferred
- Async / `mode=async` polling.
- Sticky `session` cookie.
- Search pagination (`serps`/`size`/`offset`).

## v0.1.0 (2026-05-01)

Initial public release. Four tools: `web_fetch`, `web_search`, `ai_chat_completion`, `account_status`.
