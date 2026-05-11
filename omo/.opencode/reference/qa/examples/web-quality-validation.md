# Web quality validation example

Use this example when a change needs one combined release-readiness readout instead of separate notes for browser QA, accessibility, performance, and security.

## Example goal

Decide whether a web release candidate is ready to ship.

## Example structure

1. Validate the highest-risk user journeys with browser-driven checks.
2. Review accessibility on the same flows and capture semantic evidence.
3. Measure performance on the key pages.
4. Review auth, authorization boundaries, headers, input handling, and vulnerability scan output.
5. Compare all results against `../../quality-gates.md`.

## Example release summary

| Dimension | Result | Evidence |
| --- | --- | --- |
| Browser flows | Pass | Happy path and one failure path passed on staging |
| Accessibility | Pass | Keyboard, labels, focus, and semantic review cleared the shared gate |
| Performance | Pass | Key pages met the shared CWV and Lighthouse bar |
| Security | Pass | Scan output showed 0 high/critical vulnerabilities |

## Decision shape

- Approve release when all blocking dimensions meet `../../quality-gates.md`.
- Hold release when any blocking dimension misses the shared gate or lacks evidence.
- Link supporting detail to `e2e-playwright.md`, `accessibility.md`, and `performance.md` when one dimension needs a deeper write-up.
