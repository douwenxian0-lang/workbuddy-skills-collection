---
name: artifact-naming
description: Naming conventions for artifact kind and path, ensuring data can be aggregated and analyzed
---

# Artifact Naming Conventions

## Important: --path Is a Required Parameter

Every call to `wanman artifact put` must include the `--path` parameter. Artifacts without a path cannot be retrieved or aggregated.

```bash
# Full command format
wanman artifact put --kind <kind> --path "<domain>/<category>/<item>" --source "<source>" --confidence <0-1> '<json>'
```

## Important: Use --file to Store Output File Contents

After writing an MD/HTML or other file, use the `--file` parameter to store the file contents in the artifact. This ensures file contents are version-controlled in the database.

```bash
# After writing a file, include --file in artifact put
wanman artifact put --kind brand_asset --path "brand/identity/handbook" \
  --source "marketing" --confidence 0.9 \
  --file /workspace/agents/output/marketing/brand-design.md \
  '{"name":"Brand Handbook","type":"handbook"}'

# Structured data (no file) does not need --file
wanman artifact put --kind budget_item --path "costs/opex/rent" \
  --source "estimate" --confidence 0.4 \
  '{"item":"rent","amount":350000,"currency":"JPY"}'
```

**Rule:** If your task output includes MD or HTML files, you **must** include `--file` pointing to that file when calling artifact put.

## Kind Standardization

**Only use the following standard kind values — do not invent your own:**

| Domain | Standard Kind | Description |
|--------|--------------|-------------|
| Market research | `competitor` | Competitor information |
| Market research | `market_data` | Market data (size, trends) |
| Market research | `customer_profile` | Customer personas |
| Market research | `location_data` | Location-related data |
| Finance | `budget_item` | Individual cost item (use this uniformly, not monthly_cost/initial_investment) |
| Finance | `revenue_forecast` | Revenue forecast |
| Finance | `financial_summary` | Financial summary (break-even, payback period, etc.) |
| Branding | `brand_asset` | Brand asset (name, story, visuals, tagline — all under brand_asset) |
| Content | `content_plan` | Content planning |
| Technical | `tech_spec` | Technical specification |

## Path Naming Convention (Required)

Format: `{domain}/{category}/{item}`

```
costs/capex/renovation        ← One-time renovation cost
costs/capex/equipment          ← Equipment procurement
costs/opex/rent               ← Monthly rent
costs/opex/labor              ← Monthly labor
costs/opex/materials          ← Raw material costs
market/competitors/cafe-a     ← Competitor A
market/competitors/cafe-b     ← Competitor B
market/demographics/target    ← Target customer segment
market/location/rent-level    ← Rent level
brand/naming/candidate-1      ← Brand name candidate 1
brand/naming/candidate-2      ← Brand name candidate 2
brand/visual/colors           ← Color system
brand/visual/typography       ← Typography direction
brand/story/core              ← Brand story
brand/slogan/main             ← Brand tagline
content/social/instagram      ← Instagram plan
content/social/twitter        ← Twitter plan
revenue/forecast/monthly      ← Monthly revenue forecast
revenue/forecast/breakeven    ← Break-even analysis
finance/summary/cashflow      ← Cash flow summary
tech/website/spec             ← Website technical specification
```

## Correct vs. Incorrect Examples

```bash
# Wrong: kind is too granular, no path
wanman artifact put --kind initial_investment --source "estimate" --confidence 0.4 '{"item":"equipment"}'
wanman artifact put --kind monthly_cost --source "estimate" --confidence 0.4 '{"item":"rent"}'
wanman artifact put --kind brand_name_candidate --source "original" --confidence 0.8 '{"name":"ITTEKI"}'

# Correct: standard kind + path for differentiation
wanman artifact put --kind budget_item --path "costs/capex/equipment" --source "estimate" --confidence 0.4 '{"item":"equipment","amount":500000}'
wanman artifact put --kind budget_item --path "costs/opex/rent" --source "estimate" --confidence 0.4 '{"item":"rent","amount":350000}'
wanman artifact put --kind brand_asset --path "brand/naming/candidate-1" --source "original" --confidence 0.8 '{"name":"ITTEKI","meaning":"one drop"}'
```
