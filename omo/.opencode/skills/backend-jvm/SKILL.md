---
name: backend-jvm
description: Deliver Java and Kotlin backends across Spring Boot, Quarkus, and Ktor while keeping contracts, validation, auth, and concurrency models explicit.
---

# Backend JVM

Use this pack for JVM backend work: Java or Kotlin APIs, service modules, auth flows, transactional business logic, background execution, and backend delivery patterns that live in the broader JVM ecosystem.

Defer first-pass route choice and lane selection to `../../reference/routing-matrix.md`.

This is the general JVM backend pack for the repo. Use the overlays in `reference/` to tune decisions for Spring Boot or the Quarkus and Ktor family while keeping the shared quality bar for contracts, validation, documentation, and service behavior intact.

## Setup posture

- Prefer modernizing, refining, or extending an existing project in place.
- Treat scaffold, `create`, `init`, or `new` flows as greenfield-only and explicit-request-only. Defer to `.opencode/reference/project-setup-policy.md`.

## Core focus

- Design request and response contracts that remain stable across controllers, resources, serializers, and clients.
- Keep validation, exception mapping, and error contracts explicit instead of spreading them across annotations and filters without a clear owner.
- Choose authentication and authorization flows deliberately: session, token, OAuth2, service credentials, filters, interceptors, or policy layers.
- Be explicit about transaction boundaries, thread usage, blocking versus reactive paths, and background execution.
- Keep API documentation, health signals, and operational expectations visible at the service edge.

## Shared JVM backend standards

- Keep controllers or resources thin and move orchestration and business rules into testable services.
- Use DTOs, request models, and bean validation or equivalent schema checks at the transport boundary.
- Decide early whether the service is blocking, reactive, coroutine-driven, or hybrid, and keep that model consistent.
- Keep persistence, transaction scope, idempotency, and retry behavior readable where the service model touches the database or other services.
- Publish OpenAPI or equally strong API documentation for shared endpoints and integration surfaces.
- Make auth filters, policy checks, and role handling explicit enough that failures and permissions are easy to trace.

## Default workflow

1. Inspect the codebase's framework, language mix, dependency injection model, and concurrency model.
2. Choose the closest overlay from `reference/spring-boot.md` or `reference/quarkus-ktor.md`.
3. Define contracts, validation, auth flow, transaction boundaries, and thread or coroutine behavior before broad implementation.
4. Implement request handling, service logic, and documentation together so the runtime model stays coherent.
5. Run `review-work` after substantial backend changes.

## Collaboration in this repo

- Use `Explore` before editing so the new work follows local service, package, and handler conventions.
- Use `Librarian` or `Context7` when framework behavior, security configuration, or serialization details need a source-of-truth check.
- Pair with `architecture-integration` when service boundaries, client contracts, or cross-service ownership are the real hard part.

## Overlays

- `reference/spring-boot.md` for Spring MVC or WebFlux services, Spring Security, transaction-heavy business logic, and annotation-driven enterprise delivery.
- `reference/quarkus-ktor.md` for Quarkus or Ktor services where lower overhead, native-friendly builds, or Kotlin coroutine-first delivery shapes the backend.

## Guardrails

- Do not mix blocking, reactive, and coroutine paths casually just because the framework allows it.
- Do not let annotation sprawl hide validation, auth, or transaction behavior.
- Do not leak persistence entities or framework internals into every outward contract.
