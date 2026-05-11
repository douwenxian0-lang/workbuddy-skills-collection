---
name: polish
description: Run a finishing pass that tightens spacing, alignment, interaction states, consistency, and release-readiness details before shipping.
argument-hint: "[target]"
user-invocable: true
---

# Polish

Use this flow after the feature already works and the remaining gap is quality, not core functionality.

## Preparation

1. Load `impeccable` first.
2. If design context is missing, run `impeccable teach`.
3. Check whether there is an existing audit or critique to anchor the pass.

## What to tighten

- alignment,
- spacing rhythm,
- typography consistency,
- color and token drift,
- hover, focus, active, disabled, loading, error, and success states,
- copy consistency,
- responsive rough edges,
- and obvious code-level polish debt that affects the UX.

## Working rules

- Align with the design system if one exists.
- Fix systematic issues at the system level rather than patching one screen at a time.
- Do not introduce new features while polishing.
- Re-check edge states and interrupted flows before calling it done.

## Finish line

The result should feel easier, cleaner, and more intentional without changing the product's underlying goal.
