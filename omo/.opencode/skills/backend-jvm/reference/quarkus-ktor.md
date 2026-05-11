# Quarkus and Ktor overlay for `backend-jvm`

Use this overlay when the JVM backend is either a Quarkus service or a Ktor application and the work is shaped by lower-overhead runtime behavior, native-friendly deployment, or Kotlin-first coroutine delivery.

## Reach for this overlay when

- the service already uses Quarkus or Ktor,
- fast startup, lean memory use, or native image friendliness matters,
- Kotlin coroutines or explicit request pipeline composition are central to the backend shape.

## Working rules

- Keep the concurrency model explicit: coroutines, reactive flows, worker threads, and blocking adapters need clear ownership.
- Make request validation, serialization, and auth behavior easy to trace through plugins, interceptors, or framework extensions.
- Keep DI and lifecycle rules visible, whether that means Quarkus CDI beans or Ktor application modules and plugins.
- Document API contracts and error shapes explicitly instead of assuming lighter frameworks need less contract discipline.
- Isolate blocking database or network work so the service does not quietly degrade under load.
- Treat startup hooks, health checks, and deployment assumptions as part of the backend contract.

## Watchouts

- Avoid copying Spring conventions blindly into Quarkus or Ktor codebases that want a different shape.
- Avoid mixing coroutine-based handlers with blocking libraries without clear boundaries.
- Avoid hiding contract rules inside plugin chains that new contributors cannot follow.
