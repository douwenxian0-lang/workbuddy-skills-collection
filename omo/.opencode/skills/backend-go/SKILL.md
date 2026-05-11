---
name: backend-go
description: Deliver Go backends with clear handler, service, auth, validation, and concurrency patterns across Gin, Echo, and Fiber style services.
---

# Backend Go

Use this pack for Go backend work: HTTP APIs, service boundaries, auth middleware, background workers, streaming paths, and operationally focused backend delivery in the Go ecosystem.

Defer first-pass route choice and lane selection to `../../reference/routing-matrix.md`.

This is the general Go backend pack for the repo. Use the overlay in `reference/gin-echo-fiber.md` to tune decisions for common Go web frameworks while preserving the same expectations for contracts, validation, documentation, and concurrency safety.

## Setup posture

- Prefer modernizing, refining, or extending an existing project in place.
- Treat scaffold, `create`, `init`, or `new` flows as greenfield-only and explicit-request-only. Defer to `.opencode/reference/project-setup-policy.md`.

## Core focus

- Design JSON, HTTP, and service contracts that are readable from handler to domain logic to client.
- Keep request validation, response shaping, and error mapping explicit instead of burying them in ad hoc helper code.
- Choose authentication and authorization flows deliberately: sessions, JWTs, service credentials, middleware checks, or policy gates.
- Treat goroutines, worker pools, streaming, and queue consumers as architectural choices with ownership and cancellation rules.
- Keep documentation, health checks, and graceful shutdown behavior visible at the service edge.

## Shared Go backend standards

- Keep handlers thin and move durable business rules into services or packages that are not coupled to framework context objects.
- Pass `context.Context` through downstream calls so deadlines, cancellation, auth context, and tracing stay intact.
- Use explicit validation and binding rules for inbound payloads, query params, and headers.
- Make timeouts, retries, idempotency, and background worker ownership visible wherever the service touches external systems.
- Publish OpenAPI or equally clear API docs for shared endpoints instead of relying on handler names and comments alone.
- Keep concurrency readable: every goroutine, channel, and shared state path should have an owner and a shutdown story.

## Default workflow

1. Inspect the existing router, middleware, package boundaries, and deployment assumptions.
2. Choose the Go framework overlay in `reference/gin-echo-fiber.md`.
3. Define contracts, validation, auth flow, context propagation, and concurrency behavior before widening the implementation.
4. Implement handlers, service calls, and docs together so operations and correctness stay aligned.
5. Run `review-work` after substantial backend changes.

## Collaboration in this repo

- Use `Explore` before editing so the new work matches local package, middleware, and service patterns.
- Use `Librarian` or `Context7` when framework APIs, transport details, or library tradeoffs need a source-of-truth check.
- Pair with `architecture-integration` when the task is mainly about boundaries, integration contracts, or multi-service coordination.

## Overlays

- `reference/gin-echo-fiber.md` for common Go HTTP frameworks, middleware chains, request binding, and performance-sensitive API delivery.

## Guardrails

- Do not start goroutines without clear ownership, cancellation, and shutdown behavior.
- Do not let framework context objects become the domain model.
- Do not hide timeout, retry, or auth behavior inside helper functions that make request flow impossible to follow.
