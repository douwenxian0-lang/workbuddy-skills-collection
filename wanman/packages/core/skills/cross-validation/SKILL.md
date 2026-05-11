---
name: cross-validation
description: CEO checks consistency of agent outputs during post-completion review
---

# Output Consistency Validation

## When to Execute

After `wanman task list` shows all tasks with status=done, perform output consistency validation **before inspecting artifact data**.

## Validation Process

### Step 1: Collect All Output Files

```bash
# List all agent output files
find /workspace/agents -name "*.md" -o -name "*.html" | grep -v CLAUDE.md | sort
```

### Step 2: Extract Key Facts

Extract the following key information from each file:

| Fact Type | Example |
|-----------|---------|
| Brand name | "COFFEE TO" |
| Tagline | "Coffee to, begin." |
| Address | 2-XX-XX Kamimeguro, Meguro-ku, Tokyo |
| Business hours | 8:00 - 20:00 |
| Opening date | 2026.4.1 |
| Menu prices | Drip Coffee ¥500 |
| Instagram handle | @coffee.to.nakameguro |
| Color HEX values | #2D1B0E, #F5E6D3 |

### Step 3: Compare for Consistency

Cross-check file by file:

```
Brand guide (marketing) brand name  ←→  Website (dev) brand name
Brand guide tagline                 ←→  Poster (marketing) tagline
Brand guide colors                  ←→  Website CSS colors
Financial report pricing            ←→  Website menu prices
Poster opening date                 ←→  Social media content date
Poster address                      ←→  Website address
```

### Step 4: Handle Inconsistencies

When inconsistencies are found, **defer to the earliest completed authoritative document** (usually the brand guide) and create a correction task:

```bash
# Example: website brand name does not match brand guide
wanman task create "Fix website brand name: unify the brand name on the website from 'KAWA' to 'COFFEE TO' as specified in the brand guide. Update all brand names, taglines, and Instagram handles in index.html. Reference: /workspace/agents/output/marketing/brand-design.md" --assign dev --priority 1
```

## Authoritative Document Priority

When information conflicts, follow this order of precedence:

1. **Brand guide** — Brand name, tagline, visual style
2. **Financial report** — Prices, cost data
3. **Market research** — Competitor data, market data
4. **Website/posters** — Must align with the above (not a source of truth)

## Common Inconsistency Patterns

| Pattern | Cause | Fix |
|---------|-------|-----|
| Website brand name differs from brand guide | Dev started website before brand design was complete | Create correction task for dev |
| Poster prices differ from financial pricing | Marketing and finance worked independently | Defer to finance, fix the poster |
| Social media dates differ from poster dates | Same agent produced outputs at different times | Unify to the latest confirmed date |

## Preventive Measures

When creating tasks, use `--after` to declare dependencies:

```bash
# Brand design must be completed first
brand_id=$(wanman task create "Brand design" --assign marketing --priority 1 | grep -o '[a-f0-9-]\{36\}')

# Website development depends on brand design
wanman task create "Website development: based on the brand guide..." --assign dev --priority 5 --after $brand_id

# Poster design also depends on brand design
wanman task create "Opening poster: based on the brand guide..." --assign marketing --priority 4 --after $brand_id
```
