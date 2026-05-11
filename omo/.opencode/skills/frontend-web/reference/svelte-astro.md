# Svelte/Astro overlay for `frontend-web`

Use this overlay when the web task lives in Svelte or Astro and the delivery model depends on clear hydration boundaries instead of a fully hydrated browser app.

## Reach for this overlay when

- Svelte 5 runes and component-local reactivity define the implementation shape,
- Astro pages, layouts, content routes, or server islands define the app shell,
- `client:*` directives or partial hydration decisions are the critical runtime choice,
- framework interop inside an Astro route is required and needs deliberate boundaries.

## Working rules

- Keep Svelte components small and let runes express local state, derived values, and effects close to the markup instead of rebuilding hook-style abstractions.
- In Astro, default to server-rendered or static output and hydrate only the smallest island that truly needs browser execution.
- Make runtime boundaries explicit: pages and layouts own route data, interactive islands own local behavior, and server islands stay server-only when possible.
- Keep framework interop narrow and intentional so each island has a clear owner and hydration contract.
- Reach for first-party Astro conventions such as content collections, client directives, and server islands before writing custom delivery glue.

## Good fit decisions

- Content-heavy or marketing surfaces with isolated interactive widgets.
- Migration paths where multiple UI frameworks need to coexist without hydrating the whole page.
- Svelte features that benefit from concise, component-local state and rendering logic.

## Watchouts

- Avoid hydrating an entire page when one widget or form needs interactivity.
- Avoid sharing fragile browser state across island or framework boundaries.
- Avoid mixing legacy Svelte patterns into a runes-based feature without a clear compatibility boundary.
