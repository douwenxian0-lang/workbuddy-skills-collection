---
name: research-methodology
description: Methodology for market research and data collection, ensuring data quality and source traceability
---

# Research Methodology

## Core Principles

**Every data point must have a source and confidence score.** Estimates are not facts — label them as estimates.

## Data Source Hierarchy

| Tier | Source Type | Confidence Range | Examples |
|------|-----------|-----------------|---------|
| 1 | Official public data | 0.85-0.95 | Government statistics, public company filings, industry association reports |
| 2 | Authoritative media | 0.70-0.85 | Major financial media, industry analysis reports |
| 3 | Web search results | 0.50-0.70 | Blogs, forums, review sites |
| 4 | Model inference/estimates | 0.20-0.50 | Extrapolations from known data, analogical estimates |
| 5 | Training data memory | 0.10-0.30 | Data from model memory (may be outdated) |

## Search Strategy

1. **Search before estimating**: Do not guess from training data if the information can be searched
2. **Cross-validate**: Confirm key data from at least 2 independent sources
3. **Label timeliness**: Note the time range of data (e.g., "2024 data")
4. **Distinguish facts from opinions**: Clearly label when quoting

## Data Recording Format

Use `wanman artifact put` to record each research data point:

```bash
# Good recording practice
wanman artifact put --kind market_data --path "competitors/cafe_a/pricing" \
  --meta '{"source":"web_search:dianping.com","confidence":0.65,"data_date":"2024-12","avg_price":35,"currency":"CNY","category":"specialty_coffee"}'

# Bad practice (missing source and confidence)
wanman artifact put --kind market_data --path "competitors/pricing" \
  --meta '{"avg_price":35}'
```

## Common Pitfalls

- **Survivorship bias**: Successful cases found via search do not represent the full industry picture
- **Outdated data**: Rent and foot traffic data from 2 years ago may have changed significantly
- **Regional differences**: Tier-1 city data cannot be directly applied to tier-2 or tier-3 cities
- **Currency/unit confusion**: Always label currency and measurement units
