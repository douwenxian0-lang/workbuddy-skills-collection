# Gin, Echo, and Fiber overlay for `backend-go`

Use this overlay when the Go backend uses Gin, Echo, or Fiber and the work is shaped by explicit middleware chains, request binding, routing performance, or lightweight service delivery.

## Reach for this overlay when

- the service already uses one of these Go HTTP frameworks,
- request binding, middleware, and route grouping are central to the task,
- low-overhead API delivery and operational clarity matter more than heavy framework abstraction.

## Working rules

- Keep handlers thin and pass typed inputs plus `context.Context` into service methods that own the business logic.
- Make auth, rate limiting, tracing, and request logging visible in middleware composition instead of scattering them across handlers.
- Use explicit binding and validation rules so malformed input fails early and consistently.
- Standardize error mapping and response helpers so clients see one predictable contract across the service.
- Keep goroutine use deliberate when work leaves the request path, and wire graceful shutdown into background workers.
- Document routes with OpenAPI generation, annotations, or a maintained spec that stays close to the handler surface.

## Watchouts

- Avoid spawning goroutines from handlers without cancellation, backpressure, or lifecycle ownership.
- Avoid storing business-critical state only inside framework-specific context wrappers.
- Avoid hiding timeouts, retries, or transport-specific behavior so deeply that production debugging becomes guesswork.
