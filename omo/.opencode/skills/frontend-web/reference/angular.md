# Angular overlay for `frontend-web`

Use this overlay when the web task lives in Angular and standalone components, DI boundaries, router structure, or form architecture shape the solution.

## Reach for this overlay when

- standalone components, directives, and pipes are the main composition model,
- signals, services, or reactive forms drive the feature behavior,
- router configuration, guards, or lazy-loaded routes define the application structure,
- dependency injection and structured feature boundaries matter more than ad hoc component state.

## Working rules

- Prefer standalone components and route-level feature composition for new work instead of rebuilding module-heavy structure by default.
- Use signals for local and derived view state, and keep async service or RxJS ownership explicit where server data or existing streams already live.
- Keep dependency injection deliberate: inject services at clear feature boundaries and avoid turning every concern into a global singleton.
- Let router configuration, lazy loading, and layout shells define feature boundaries instead of hiding major flows behind template conditionals.
- Use Reactive Forms first when validation, async submission, or dynamic controls matter, and keep validators plus recovery states visible to the user.

## Good fit decisions

- Admin, settings, and line-of-business flows with dense validation and form logic.
- Route-heavy applications that need lazy-loaded feature separation and predictable DI boundaries.
- Angular teams relying on structured templates, signals, and service-driven coordination.

## Watchouts

- Avoid mixing template-driven and reactive forms inside the same user flow.
- Avoid promoting local interaction state into shared services when a component or signal boundary is enough.
- Avoid eager-loading large feature areas that should stay behind router boundaries.
