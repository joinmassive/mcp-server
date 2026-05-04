# Massive — Geotargeting Reference

Live reference: <https://docs.joinmassive.com/web-render/geotargeting>

Routes search, AI chat, and browser requests through 190+ countries, optionally narrowed by subdivision or city.

## Params (work on `/search`, `/ai`, `/browser`)

| Param | Format | Notes |
| --- | --- | --- |
| `country` | Two-letter ISO code | Case-insensitive (e.g. `us`, `DE`, `jp`). Random country if omitted. |
| `subdivision` | ISO 3166-2 first-level alphanumeric | Case-insensitive (e.g. `tn` for Tennessee, `bav` for Bavaria). **Not currently exposed as an MCP tool param.** |
| `city` | GeoNames common name | Case-sensitive. URL-encode spaces as `+` or `%20`. |

**Precedence:** `city` takes precedence over `subdivision` if both are set.

## Examples

| Goal | Params |
| --- | --- |
| Search Google as if from Berlin, Germany | `country=de&city=Berlin` |
| Render guitars.com as a US shopper in Nashville | `country=us&city=Nashville` |
| Ask ChatGPT a localized question (Tokyo, JP) | `country=jp&city=Tokyo` |

## Tips

- City names are case-sensitive (per upstream API). `Nashville` ✓, `nashville` ✗.
- If a city isn't recognized, the request still goes through but defaults to the country/region IP pool.
- See the live geotargeting reference for the supported country/city inventory.
