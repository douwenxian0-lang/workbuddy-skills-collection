---
name: audit
description: Run technical UI quality checks across accessibility, performance, theming, responsiveness, and anti-patterns, then return a scored action plan.
argument-hint: "[area]"
user-invocable: true
---

# Audit

Run a technical quality review of the target UI without silently drifting into implementation work.

## Preparation

1. Load `impeccable` first.
2. If no design context exists yet, run `impeccable teach` before continuing.
3. Scope the audit to the named feature, page, screen, or component if an argument was supplied.

## What to inspect

Score each dimension from 0 to 4:

1. Accessibility
2. Performance
3. Theming and token usage
4. Responsive behavior
5. Anti-pattern resistance

## Anti-pattern verdict comes first

Start the report by answering one question plainly:

Does this look generic or AI-generated?

Call out specific tells such as gradient text, accent side stripes, purple-blue default palettes, nested cards, or weak typographic hierarchy.

## Report shape

- Audit score out of 20
- rating band
- issue counts by severity (`P0` through `P3`)
- top critical findings
- positive findings worth keeping
- recommended next actions

For each issue include:

- location,
- category,
- user impact,
- fix direction,
- and the most relevant follow-up flow (`polish`, `typeset`, `colorize`, `adapt`, or a domain-pack implementation pass).

## Rules

- Be specific, not generic.
- Prioritize ruthlessly.
- Do not fix the issues unless the user explicitly asked for remediation in the same request.
- Prefer verifiable findings over vague taste claims.
