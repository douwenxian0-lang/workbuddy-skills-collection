# Django and Flask overlay for `backend-python`

Use this overlay when the Python backend is primarily a Django or Flask service and the codebase is shaped more by app modules, request hooks, serializers, or extension wiring than by an async-first ASGI stack.

## Reach for this overlay when

- the service already uses Django, Django REST Framework, Flask, or a Flask extension stack,
- the team values batteries-included admin, ORM, auth, or serializer support,
- a lighter WSGI or hybrid ASGI service is a better fit than an async-first API surface.

## Working rules

- Keep view, route, or blueprint logic thin and move durable business rules into services, domain modules, or application-layer helpers.
- Be explicit about validation boundaries: serializers, forms, schema libraries, or request parsing should make the contract readable.
- Choose the auth model deliberately: sessions, token auth, JWT, CSRF-aware browser flows, or API-only credentials should match the client surface.
- Keep background work and scheduled jobs outside request handlers when retries, email, media, or batch processing enter the system.
- Document APIs with DRF schema generation, Flask-compatible OpenAPI tooling, or equally explicit contract docs instead of relying on tribal knowledge.
- Be honest about sync and async boundaries when modern Django async handlers or async-capable extensions appear in the codebase.

## Watchouts

- Avoid monolithic app modules that mix models, routes, serializers, admin wiring, and domain logic in one place.
- Avoid extension sprawl or global state that makes Flask services difficult to test and reason about.
- Avoid assuming browser-oriented defaults are automatically correct for service-to-service or mobile API clients.
