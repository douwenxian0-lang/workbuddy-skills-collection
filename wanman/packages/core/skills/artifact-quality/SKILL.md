---
name: artifact-quality
description: Quality standards for structured deliverables, ensuring data is verifiable and traceable
---

# Artifact Quality Standards

## Required Fields

Every artifact's metadata must include:

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | Data source identifier |
| `confidence` | number (0-1) | Confidence score |

## Source Identifier Format

```
training_data        → From model training data (lowest confidence)
estimate             → Extrapolated from known data
web_search:<domain>  → Web search result, specify the domain
government_data      → Official government data
industry_report      → Industry report
api:<service>        → API call result
cross_validated      → Cross-validated
```

## Confidence Scoring Guide

```
0.9+    → Official data, multi-source validated
0.7-0.9 → Reliable source, single validation
0.5-0.7 → Web search result, not cross-validated
0.3-0.5 → Extrapolation/estimate with reasonable basis
0.1-0.3 → Training data or rough estimate
```

## Cross-Validation

When the CEO or another agent validates an artifact, update the metadata:

```bash
wanman artifact put --kind market_data --path "competitors/pricing" \
  --meta '{"source":"cross_validated","confidence":0.85,"verified":true,"verified_by":"ceo","verified_at":"2024-01-15","original_source":"web_search:dianping.com","validation_notes":"consistent with Meituan data"}'
```

## Common Quality Issues

1. **Missing source**: `source` is empty or just says "internet"
2. **Inflated confidence**: Estimated data labeled 0.9+
3. **Missing units**: Amounts without currency, areas without units
4. **Vague timing**: No data collection date specified
5. **Inconsistent paths**: `path` does not follow a consistent naming convention

## Path Naming Convention

```
costs/{category}/{item}          → Cost data
revenue/{scenario}/{period}      → Revenue forecasts
competitors/{name}/{metric}      → Competitor data
market/{segment}/{metric}        → Market data
location/{area}/{metric}         → Location data
```
