---
name: critique
description: Review UI and UX quality from a design perspective using anti-slop checks, usability heuristics, cognitive-load analysis, and persona-based red flags.
argument-hint: "[area]"
user-invocable: true
---

# Critique

Use this flow when the goal is design judgment rather than raw implementation or technical QA.

## Preparation

1. Load `impeccable` first.
2. If design context is missing, run `impeccable teach`.
3. Confirm what the target interface is trying to help the user accomplish.
4. Load these local references:
   - `reference/cognitive-load.md`
   - `reference/heuristics-scoring.md`
   - `reference/personas.md`

## Two-pass review

### Pass A: design-director review

Review the interface for:

- anti-slop tells,
- hierarchy and clarity,
- composition and rhythm,
- copy tone,
- emotional fit,
- state design,
- and overall usability.

### Pass B: deterministic checks where available

If the `impeccable` CLI is available in the environment, run its detector and include those findings.

If the CLI is not available, perform an explicit manual anti-pattern sweep using the umbrella `impeccable` rules and say so in the report.

## Report shape

- Design health score out of 40 using Nielsen heuristics
- Anti-pattern verdict
- Overall impression
- What is working
- Priority issues ordered by impact
- Persona red flags
- Minor observations
- Questions or decisions that would most improve the next pass

Each priority issue should include:

- severity (`P0` to `P3`),
- what is wrong,
- why it matters,
- and which follow-up flow fits best.

## Persona handling

Select the two or three personas that best match the interface type. If `.impeccable.md` contains a concrete audience, add a project-specific persona only when the context clearly supports it.

## Next-step behavior

If the findings clearly point to action, recommend a short sequence such as `typeset`, `colorize`, `adapt`, and `polish`.

If the critique reveals unresolved product-direction questions, ask only the targeted questions that matter for the next pass.
