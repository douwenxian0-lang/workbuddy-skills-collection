# Next.js overlay for `frontend-web`

Use this overlay when the web work lives inside a Next.js codebase or when App Router, server rendering, or cache policy decisions dominate the task.

## Reach for this overlay when

- the UI lives in `app/` or another Next.js routing surface,
- server components and client components need clear boundaries,
- route-level data loading, streaming, or cache invalidation matter,
- forms, actions, or auth flows depend on server execution.

## Working rules

- Keep server components default-first and add client components only where interactivity or browser-only APIs require them.
- Make data ownership explicit: route loader, server action, cache layer, or client query cache.
- Keep loading and error boundaries route-aware and user-readable.
- Treat image handling, font loading, script usage, and partial prerendering as product-performance decisions, not afterthoughts.
- Be explicit about cache invalidation and revalidation. Hidden cache behavior creates debugging debt fast.

## Good fit decisions

- Server-rendered content, SEO-sensitive routes, or low-latency first paint.
- Hybrid pages where static shells and dynamic islands coexist.
- Auth flows that benefit from server checks at the route edge.

## Watchouts

- Avoid pushing stateful browser UI into server components just because it is possible.
- Avoid duplicating the same fetch or validation rules in both server and client layers.
- Avoid vague caching strategy. Choose one deliberately and document it.
