# SwiftUI overlay for `mobile-app`

Use this overlay when the task lives in a native Apple mobile app or shared Apple-platform SwiftUI surface.

## Reach for this overlay when

- iOS-first product quality matters more than cross-platform code sharing,
- the app depends on Apple-native interactions, lifecycle, or frameworks,
- accessibility, motion, and platform feel should align tightly with Human Interface Guidelines.

## Working rules

- Keep data flow unambiguous between view state, model state, and async tasks.
- Use navigation, sheets, alerts, focus, and toolbar patterns that feel native on Apple platforms.
- Treat typography, spacing, safe areas, and dynamic type as core layout constraints.
- Build for lifecycle changes, resume behavior, and permission-driven flows.
- Keep concurrency, task cancellation, and loading state explicit.

## Watchouts

- Avoid forcing web mental models onto SwiftUI screens.
- Avoid hidden side effects inside view updates.
- Avoid animation and navigation patterns that fight system expectations.
