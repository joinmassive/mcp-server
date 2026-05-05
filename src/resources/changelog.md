# Changelog

## v0.2.0 (2026-05-04)

### Added
- New tool params:
  - `web_fetch`: `expiration`, `difficulty`, `subdivision`
  - `web_search`: `expiration`, `language`, `display`, `subdivision`
  - `ai_chat_completion`: `expiration`, `language`, `display`, `device`, `subdivision`
- MCP resources for in-client reference: `docs://massive/pricing`, `docs://massive/geotargeting`, `docs://massive/changelog`.
- MCPB starter prompts: `web_search_full`, `web_fetch_markdown`, `ai_chat_full`, `account_check`.
- README sections: "Pricing & cost control", "Resources".

### Changed
- Tool descriptions now enumerate cost-affecting params explicitly (model can be cost-conscious).
- Manifest `description` and `long_description` clarified.

### Deferred
- Async / `mode=async` polling.
- Sticky `session` cookie.
- Search pagination (`serps`/`size`/`offset`).
- New square icon (current icon autoscales fine in Claude Desktop).

## v0.1.0 (2026-05-01)

Initial public release. Four tools: `web_fetch`, `web_search`, `ai_chat_completion`, `account_status`.
