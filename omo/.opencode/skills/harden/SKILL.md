---
name: harden
description: "Make interfaces production-ready by covering error handling, empty states, onboarding, i18n, overflow, and other real-world edge cases."
argument-hint: "[target]"
user-invocable: true
---

# Harden

Use this flow when the happy path works but the interface still breaks under messy data, failure states, or first-time-user conditions.

## Preparation

1. Load `impeccable` first.
2. If design context is missing, run `impeccable teach`.
3. Review `../impeccable/reference/responsive-design.md`, `../impeccable/reference/interaction-design.md`, and `../impeccable/reference/ux-writing.md`.
4. Identify the most likely edge cases for the target feature before changing anything.

## What to test

- empty, loading, success, permission, and error states,
- long text, truncated labels, zoom, and dense or missing data,
- onboarding and first-run moments,
- internationalization, RTL, and text-expansion pressure,
- slow networks, retries, and interrupted or concurrent actions.

## Rules

- Design for real inputs, not demo data.
- Preserve user progress when validation or network failures happen.
- Do not assume English string lengths, mouse-only usage, or perfect connectivity.
- Edge states need the same quality bar as the happy path.

## Finish line

The feature should stay understandable, resilient, and visually coherent when reality gets messy.
