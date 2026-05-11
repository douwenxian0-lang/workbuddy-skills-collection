# Laravel, Symfony, and Rails overlay for `php-ruby-platform`

Use this overlay when the PHP or Ruby task is shaped by Laravel, Symfony, or Rails conventions around routing, validation, dependency injection, ORM usage, jobs or queues, and framework testing.

## Reach for this overlay when

- the codebase already uses Laravel, Symfony, or Rails,
- route definitions, request validation, service containers, or background jobs are central to the change,
- framework conventions strongly influence how the application is organized.

## Working rules

- Keep routes, controllers, and actions thin so the request boundary is easy to trace.
- Use framework-native validation and authorization mechanisms deliberately instead of scattering checks through views or helpers.
- Make service or container boundaries readable so dependency injection, facades, or autowiring do not hide ownership.
- Keep ORM data access explicit, including transactions, eager loading, query scopes, and serialization behavior.
- Treat jobs, queues, and mailers as failure-aware workflows with idempotency, retry rules, and tests that match framework conventions.

## Watchouts

- Avoid hiding business behavior inside model callbacks, observers, or convenience traits that obscure execution order.
- Avoid letting container magic or global helpers turn dependencies into invisible shared state.
- Avoid shipping queue or job code without clear retry policy, transactional boundaries, and integration tests.
