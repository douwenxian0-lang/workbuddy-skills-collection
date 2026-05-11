# Performance example

Use this example when you need a compact shape for browser performance validation. Keep the thresholds in `../../quality-gates.md` as the canonical pass or fail source.

## Example goal

Measure key pages for Core Web Vitals, Lighthouse behavior, and obvious regression risk before release.

## Example structure

1. Pick the few pages that carry most of the user value, usually landing, dashboard, and one task-heavy screen.
2. Capture CWV measurements and Lighthouse output on each page.
3. Note bundle, image, font, or script behavior only where it explains a regression.
4. Re-run after fixes so the evidence shows trend, not just one failing snapshot.
5. Compare the final numbers against `../../quality-gates.md`.

## Example evidence

- CWV readings for the tested pages.
- Lighthouse output or equivalent performance report.
- Brief notes on the likely cause of any regression.
- Before and after comparison if optimization work happened in the same task.

## Example findings format

| Page | Result | Evidence |
| --- | --- | --- |
| Landing page | Pass | CWV and Lighthouse cleared the shared gate |
| Dashboard | Pass | Heavy charts loaded without visible layout shift |
| Settings | Needs follow-up | Script cost spiked after a new dependency landed |

Treat unresolved regressions as release blockers when they miss the shared gate.
