# Massive — Pricing & Cost Multipliers

Live reference: <https://joinmassive.com/pricing>

## Base cost

| Endpoint | Base cost per successful call |
| --- | --- |
| `/browser` (web_fetch) | 1 credit |
| `/search` (web_search) | 1 credit |
| `/ai` (ai_chat_completion) | 1 credit |
| `/users` (account_status) | Free |

Failed requests are not billed. Credits are prepaid.

## Multipliers (web_fetch / `/browser` only)

Multipliers stack:

| Param | Value | Multiplier |
| --- | --- | --- |
| `difficulty` | `low` (default) | 1× |
| `difficulty` | `medium` | 2× |
| `difficulty` | `high` | premium (further multiplier — see live pricing page) |
| `speed` | `light` (default) | 1× |
| `speed` | `ridiculous` | 1.5× |
| `speed` | `ludicrous` | premium (see live pricing page) |

> **Note:** v0.2 of this MCP server exposes `difficulty` only. `speed` is not surfaced as a tool param yet — defaults to `light`.

### Worked example

`web_fetch` with `difficulty=medium` would cost `1 × 2 = 2 credits`.

## Cost-control tips

- **Cache:** set `expiration` (days) to reuse recent results. Default `1`. Use `expiration=0` for always-live data (prices, scores, weather).
- **Difficulty:** start with default `low`; bump to `medium` / `high` only after a low attempt fails.
- **Geo-targeting:** `country` / `city` does not change cost as of this writing — confirm against the live pricing page.
- **Account check:** call `account_status` (free) before launching a batch of requests.
