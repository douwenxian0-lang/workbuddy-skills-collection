# FastAPI overlay for `backend-python`

Use this overlay when the Python backend is a FastAPI or ASGI service and async I/O, typed request models, or dependency-based composition drive the implementation.

## Reach for this overlay when

- the service already uses FastAPI, Starlette, or another ASGI-first stack,
- Pydantic models define the public contract,
- database access, external integrations, or streaming behavior benefit from async execution.

## Working rules

- Keep request and response models explicit with Pydantic so validation, serialization, and docs come from the same contract surface.
- Keep `async def` for I/O-heavy paths and treat blocking work as something to isolate in worker processes, task queues, or other off-path mechanisms.
- Make auth dependencies, token handling, scopes, and permission checks easy to trace through the route layer.
- Keep session lifecycle, transaction boundaries, and connection-pool behavior obvious when using AsyncSession or other async drivers.
- Use background tasks, queues, or streaming responses deliberately instead of stretching one handler to do everything.
- Keep automatic OpenAPI output accurate by aligning schema models, status codes, and error responses with the real behavior.

## Watchouts

- Avoid blocking the event loop with CPU-heavy work or sync client libraries hidden inside async handlers.
- Avoid returning ORM objects directly when outward schemas need stability or redaction.
- Avoid vague session and transaction ownership that makes async failures hard to reason about.
