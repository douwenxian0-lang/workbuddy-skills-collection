---
name: backend-python
description: Deliver Python backends across async FastAPI and Django or Flask service styles while keeping API design, validation, auth, and service behavior explicit.
---

# Backend Python

Use this pack for Python backend work: REST APIs, service layers, auth flows, async I/O, model-serving edges, background work, and backend delivery patterns that live in the Python ecosystem.

Defer first-pass route choice and lane selection to `../../reference/routing-matrix.md`.

This is the general Python backend pack for the repo. Use the overlays in `reference/` to tune decisions for FastAPI or the Django and Flask family while preserving the same expectations for contracts, validation, documentation, and production behavior.

## Setup posture

- Prefer modernizing, refining, or extending an existing project in place.
- Treat scaffold, `create`, `init`, or `new` flows as greenfield-only and explicit-request-only. Defer to `.opencode/reference/project-setup-policy.md`.

## Core focus

- Design API contracts that are easy to reason about from schema model to handler to service layer.
- Keep request and response validation explicit with typed models, serializers, or forms that fit the framework.
- Choose authentication and authorization flows deliberately: OAuth2, JWTs, sessions, service credentials, or scoped policies.
- Be intentional about async behavior, database session lifecycle, background tasks, and queue boundaries.
- Keep documentation, configuration, and operational visibility close to the backend surface.

## Shared Python backend standards

- Keep type hints, schema models, and domain boundaries readable instead of letting framework shortcuts blur them together.
- Separate API models from persistence models when that separation protects contract stability and security.
- Use explicit validation at every external boundary and keep sensitive fields filtered out of outward-facing models.
- Publish OpenAPI or equally clear endpoint documentation for shared services and public APIs.
- Choose async because the workload benefits from it, not because the framework makes it available.
- Make auth, permission checks, token refresh, and background processing visible in the code path rather than implied by defaults.

## Default workflow

1. Inspect the existing package layout, schema approach, and runtime model.
2. Choose the closest overlay from `reference/fastapi.md` or `reference/django-flask.md`.
3. Define the contract surface, validation rules, auth flow, and sync or async behavior before expanding the service layer.
4. Implement handlers, service boundaries, and documentation together so the backend remains understandable under change.
5. Run `review-work` after substantial backend changes.

## Collaboration in this repo

- Use `Explore` before editing so the new work follows local module and service patterns.
- Use `Librarian` or `Context7` for framework docs, protocol details, and library tradeoffs.
- Pair with `architecture-integration` when the task is really about service boundaries, client contracts, or cross-system coordination.

## Overlays

- `reference/fastapi.md` for async-first APIs, Pydantic models, dependency-driven auth, and SQLAlchemy or async service patterns.
- `reference/django-flask.md` for Django or Flask services where batteries-included app structure or explicit extension-based composition shapes the backend.

## Guardrails

- Do not force every Python backend into one async pattern when the runtime and workload do not need it.
- Do not leak ORM entities, request objects, or framework globals across the whole service layer.
- Do not let framework convenience hide contract drift, weak validation, or unsafe auth behavior.
