# React Native overlay for `mobile-app`

Use this overlay when the app is built with React Native or Expo and the task needs shared JavaScript or TypeScript delivery across iOS and Android.

## Reach for this overlay when

- the repo uses Expo or React Native,
- shared business logic and component code matter more than fully separate native apps,
- device APIs, navigation, and release workflows are managed from one cross-platform stack.

## Working rules

- Keep navigation ownership explicit: routes, nested stacks, tabs, modals, and deep links.
- Separate server state, local UI state, and device state.
- Treat native modules, permissions, secure storage, notifications, and background tasks as architectural decisions.
- Budget for cold start, memory pressure, and list performance on mid-range devices.
- Respect platform differences in gestures, typography, navigation patterns, and permission prompts.

## Watchouts

- Avoid hiding platform-specific behavior behind abstractions that nobody can debug.
- Avoid overusing global state when route-level or feature-level ownership is enough.
- Avoid shipping browser-style layouts directly into mobile shells.
