# React web overlay for `frontend-web`

Use this overlay when the web task is primarily a React application concern rather than a Next.js delivery concern.

## Reach for this overlay when

- the UI is a client-rendered React app,
- a design system or component library is the main work surface,
- routing, state, and data synchronization live mostly in the browser,
- the task is about reusable components, interaction models, or application shells.

## Working rules

- Keep state ownership simple: local state for local behavior, shared state only where coordination is real.
- Separate server state from UI state. Queries, mutations, invalidation, and optimistic updates need explicit ownership.
- Build component APIs that are stable, composable, and accessible before tuning visual polish.
- Keep routing, form state, validation, and asynchronous UI readable at the component boundary.
- Preserve semantic structure even in heavily componentized trees.

## Good fit decisions

- SPA or portal-style browser apps.
- Component-library work, dashboard flows, settings surfaces, and reusable interaction patterns.
- Incremental adoption inside larger browser platforms.

## Watchouts

- Avoid global state as a shortcut for prop design.
- Avoid deeply nested provider stacks without clear responsibility.
- Avoid performance regressions caused by unnecessary re-renders or oversized client bundles.
