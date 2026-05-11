# Flutter overlay for `mobile-app`

Use this overlay when the app is a Flutter codebase and the task centers on widget composition, rendering consistency, and cross-platform delivery from Dart.

## Reach for this overlay when

- the app already uses Flutter,
- a custom design system or rich animated interface is important,
- platform adaptation needs to happen inside a shared widget tree.

## Working rules

- Keep the widget tree readable and feature-scoped.
- Use explicit state ownership and predictable async boundaries.
- Separate design tokens, layout primitives, and business logic from screen orchestration.
- Treat platform adaptation, input handling, and accessibility semantics as built-in requirements.
- Test for jank on list-heavy and animation-heavy paths.

## Watchouts

- Avoid oversized widget compositions with unclear responsibility.
- Avoid overloading one state-management approach for every problem.
- Avoid platform mimicry that ignores native expectations on either OS.
