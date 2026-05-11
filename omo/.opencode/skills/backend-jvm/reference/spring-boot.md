# Spring Boot overlay for `backend-jvm`

Use this overlay when the JVM backend is primarily a Spring Boot service and Spring MVC, WebFlux, Spring Security, or transaction-heavy service patterns define the implementation.

## Reach for this overlay when

- the codebase already uses Spring Boot starters and annotation-driven composition,
- controllers, services, repositories, and configuration classes are the dominant structure,
- the service relies on Spring Security, Spring Data, or conventional enterprise integration patterns.

## Working rules

- Keep controllers thin and move transaction ownership, orchestration, and retry decisions into the service layer.
- Use request DTOs and bean validation at the transport edge so malformed inputs fail clearly and consistently.
- Decide whether the service is Spring MVC or WebFlux first, then keep the threading and I/O model coherent.
- Keep security configuration, role or policy checks, and exception-to-response mapping easy to trace.
- Use OpenAPI tooling and problem-detail style error contracts so the API surface stays documented under change.
- Be explicit about transaction scope, persistence boundaries, and idempotent write paths.

## Watchouts

- Avoid field injection, oversized service classes, and controller methods that become orchestration dumps.
- Avoid mixing blocking repositories into reactive request paths without deliberate isolation.
- Avoid letting entity models become the public API contract by accident.
