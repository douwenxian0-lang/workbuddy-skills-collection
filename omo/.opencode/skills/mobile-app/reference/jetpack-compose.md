# Jetpack Compose overlay for `mobile-app`

Use this overlay when the task belongs to a native Android app or an Android-first mobile surface.

## Reach for this overlay when

- Android-specific performance, navigation, or platform behaviors dominate,
- the codebase uses Compose and Material 3 patterns,
- lifecycle-aware state and platform integrations need Android-native handling.

## Working rules

- Keep state hoisted and unidirectional unless there is a strong reason not to.
- Make navigation, saved state, permissions, and background work explicit.
- Respect Android window sizes, system bars, input modes, and accessibility settings.
- Use Compose semantics, previews, and theming intentionally rather than as decoration.
- Watch recomposition cost on list-heavy, animated, or data-rich screens.

## Watchouts

- Avoid coupling composables directly to data sources or side effects.
- Avoid web-style spacing and typography that ignore Android density and motion expectations.
- Avoid fragile navigation or permission handling hidden in UI glue code.
