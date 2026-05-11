---
name: optimize
description: "Diagnose and improve UI performance across loading, rendering, animation, images, and bundle weight so the experience becomes faster and smoother."
argument-hint: "[target]"
user-invocable: true
---

# Optimize

Use this flow when the interface feels slow, heavy, janky, or more expensive to load than the experience deserves.

## Preparation

1. Measure the current problem first.
2. Load `impeccable` so performance changes stay aligned with the intended experience.
3. Identify the dominant bottleneck: loading, rendering, animation, images, network, or bundle size.

## What to improve

- image and asset loading,
- bundle size and code-splitting opportunities,
- expensive rendering or layout thrash,
- heavy animations or interaction jank,
- long lists, large tables, and avoidable network work.

## Rules

- Optimize the biggest bottleneck first, then re-measure.
- Prefer user-perceived wins: faster feedback, fewer blocked interactions, smaller first loads.
- Do not regress accessibility, clarity, or above-the-fold usefulness in the name of raw scores.
- Use progressive loading and virtualization where they fit the real data shape.

## Finish line

The interface should benchmark better, but more importantly it should feel meaningfully faster in the hands of real users.
