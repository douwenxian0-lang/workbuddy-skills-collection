# Quality gates

Use this file as the shared source of truth for release-ready QA thresholds. Packs and examples should point here instead of repeating the gate values inline.

## Canonical thresholds

| Dimension | Target |
| --- | --- |
| Core Web Vitals | LCP < 2.5s |
| Core Web Vitals | FID < 100ms |
| Core Web Vitals | CLS < 0.1 |
| Accessibility | WCAG 2.1 AA |
| Security | 0 high/critical vulnerabilities |

## How to use these gates

- Use them for release readiness, browser QA, accessibility review, performance checks, and deployment evidence.
- Keep raw evidence attached to the work: screenshots, browser snapshots, logs, Lighthouse output, vulnerability reports, and concise pass or fail notes.
- Measure against real flows and real environments that match the change risk.

## Evidence checklist

1. Functional flow evidence for the highest-risk user journeys.
2. Accessibility evidence for semantics, keyboard use, focus order, labels, and contrast.
3. Performance evidence for CWV, Lighthouse, and obvious regressions on key pages.
4. Security evidence for auth, authorization, headers, input handling, and dependency scanning.
