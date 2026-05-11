---
name: backend-dotnet
description: Deliver C# and .NET backends with explicit API, validation, auth, async, and operational patterns centered on ASP.NET Core.
---

# Backend .NET

Use this pack for .NET backend work: ASP.NET Core APIs, service layers, auth flows, background processing, data access, and server-side delivery patterns that live in the C# ecosystem.

Defer first-pass route choice and lane selection to `../../reference/routing-matrix.md`.

This is the general .NET backend pack for the repo. Use the overlay in `reference/aspnet-core.md` to tune decisions for controllers, minimal APIs, middleware pipelines, and hosted-service behavior while preserving the same quality bar for contracts, validation, documentation, and runtime clarity.

## Setup posture

- Prefer modernizing, refining, or extending an existing project in place.
- Treat scaffold, `create`, `init`, or `new` flows as greenfield-only and explicit-request-only. Defer to `.opencode/reference/project-setup-policy.md`.

## Core focus

- Design API contracts that are stable across controllers, minimal APIs, filters, and client integrations.
- Keep validation, model binding, and error responses explicit so failures are predictable.
- Choose authentication and authorization flows deliberately: cookies, JWTs, OAuth2, policy-based auth, claims, or service credentials.
- Treat async I/O, hosted services, queue consumers, and cancellation as part of the service design.
- Keep OpenAPI, health signals, and failure semantics visible at the backend edge.

## Shared .NET backend standards

- Keep endpoints thin and move orchestration plus business rules into services that are not coupled to transport or EF internals.
- Decide deliberately between controllers and minimal APIs based on surface area, reuse, and clarity.
- Use request models, validation rules, and `ProblemDetails`-style errors so contracts stay consistent under change.
- Keep dependency-injection lifetimes explicit and make background work, retries, and scheduled execution easy to trace.
- Honor `CancellationToken`, timeouts, and graceful shutdown expectations on I/O-heavy paths.
- Document shared APIs with OpenAPI and keep auth policies, claims, and role checks close to the endpoint surface.

## Default workflow

1. Inspect the current endpoint style, DI setup, and hosting model.
2. Choose the ASP.NET Core overlay in `reference/aspnet-core.md`.
3. Define contracts, validation, auth flow, background behavior, and cancellation boundaries before widening the implementation.
4. Implement endpoints, services, and docs together so runtime behavior stays legible.
5. Run `review-work` after substantial backend changes.

## Collaboration in this repo

- Use `Explore` before editing so the new work matches local endpoint, middleware, and service patterns.
- Use `Librarian` or `Context7` when framework APIs, auth configuration, or hosting behavior need a source-of-truth check.
- Pair with `architecture-integration` when the hard part is really service boundaries, contracts, or client coordination.

## Overlays

- `reference/aspnet-core.md` for controllers, minimal APIs, middleware pipelines, endpoint filters, EF-adjacent services, and hosted background work.

## Guardrails

- Do not leak EF entities, request objects, or framework-specific state through the whole service layer.
- Do not ignore cancellation, retry, and graceful shutdown semantics on long-running paths.
- Do not let DI lifetime mistakes turn background or request behavior into production-only bugs.
