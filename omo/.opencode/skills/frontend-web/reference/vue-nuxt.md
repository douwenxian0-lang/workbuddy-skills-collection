# Vue/Nuxt overlay for `frontend-web`

Use this overlay when the web work lives in a Vue or Nuxt codebase and SFC structure, Composition API, or route-level server behavior dominates the task.

## Reach for this overlay when

- the feature is authored as Vue single-file components with Composition API and composables,
- Nuxt pages, layouts, or route middleware shape the user flow,
- data fetching needs to stay SSR-safe across server and browser execution,
- head metadata or runtime config changes are part of the feature behavior.

## Working rules

- Keep single-file components cohesive and prefer Composition API for new logic so rendering, state, and side effects stay readable at the component boundary.
- Move reusable fetch, state, and side-effect logic into composables; keep shared state ownership explicit instead of hiding it in ad hoc globals.
- In Nuxt, make data loading server-safe by default with first-party route-aware fetch surfaces, and gate browser-only behavior behind clear client checks.
- Let pages and layouts own route structure, nested shells, and route-level metadata rather than scattering those concerns across leaf components.
- Use first-party Nuxt conventions for head management and runtime config instead of raw `document`, `window`, or loose environment access.

## Good fit decisions

- Server-rendered or SEO-sensitive Vue apps that still need interactive product flows.
- Nuxt applications with nested layouts, route middleware, or runtime-config-driven behavior.
- Component-heavy surfaces where composables coordinate forms, queries, or shared interaction rules.

## Watchouts

- Avoid mixing Options API, Composition API, and global state shortcuts inside the same feature without a clear boundary.
- Avoid browser-only APIs during SSR paths unless they are guarded deliberately.
- Avoid composables that hide where data is fetched, cached, or mutated.
