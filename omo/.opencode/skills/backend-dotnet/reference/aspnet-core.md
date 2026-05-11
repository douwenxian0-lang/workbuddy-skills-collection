# ASP.NET Core overlay for `backend-dotnet`

Use this overlay when the .NET backend is an ASP.NET Core service and controllers, minimal APIs, middleware, or hosted background services shape the implementation.

## Reach for this overlay when

- the service already uses ASP.NET Core,
- endpoint style, middleware ordering, and DI lifetimes are central to correctness,
- authentication, authorization policies, and OpenAPI output live close to the request pipeline.

## Working rules

- Choose controllers or minimal APIs deliberately, then keep conventions consistent across the service.
- Use request models plus DataAnnotations, FluentValidation, or equally explicit validation at the transport boundary.
- Standardize on `ProblemDetails` or a similarly stable error contract so clients do not guess at failure shapes.
- Keep middleware, endpoint filters, auth policies, and claims checks readable in the request path.
- Pass `CancellationToken` through I/O-heavy services and background operations that can be interrupted.
- Use hosted services, queues, and scheduled work deliberately when jobs should leave the hot request path.

## Watchouts

- Avoid singleton or static patterns that accidentally capture scoped dependencies.
- Avoid leaking EF tracking entities directly into outward contracts.
- Avoid hiding meaningful behavior in middleware order that only one person on the team understands.
