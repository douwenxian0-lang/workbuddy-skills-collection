---
name: architecture-integration
description: Shape cross-stack architecture, API contracts, authentication flow, and integration boundaries for harness-native delivery.
---

# Architecture Integration

Use this pack for cross-stack design work where the hard part is not one screen or one endpoint, but the system shape between them. Defer first-pass route choice and lane selection to `.opencode/reference/routing-matrix.md`.

## Core focus

- Define API contracts before implementation drift sets in.
- Make ownership and integration boundaries explicit across UI, services, data, and external dependencies.
- Choose authentication and authorization flows that fit the product shape, client mix, and trust boundaries.
- Frame performance architecture early: caching layers, latency budgets, data movement, streaming, background work, and observability.

## Default working stance

1. Start from the dominant request and the non-negotiable constraints.
2. Map actors, data flow, and system boundaries before naming frameworks or libraries.
3. Write down the contract surface: inputs, outputs, failure modes, versioning, and ownership.
4. Stress-test authentication flow across browsers, devices, background jobs, and third-party integrations.
5. Stress-test performance architecture across peak paths, cache invalidation, concurrency, and operational visibility.
6. Hand implementation to the adjacent pack that owns the next layer of detail.

## Architecture questions to answer

### API contracts

- What is the authoritative contract surface: REST, GraphQL, RPC, events, or a deliberate hybrid?
- Which fields, error shapes, idempotency rules, and pagination semantics are stable enough to publish?
- Where do runtime validation, generated types, and backward compatibility belong?

### Integration boundaries

- Which service or client owns orchestration, validation, retries, and transformation logic?
- Where do external providers enter the system, and how are failures isolated?
- Which flows are synchronous, asynchronous, or eventually consistent?

### Authentication flow

- Which identity model is in play: session, token, federated login, service credentials, or device-bound auth?
- Where are refresh, expiry, revocation, and role or policy checks enforced?
- How do mobile, browser, server-to-server, and background workflows differ?

### Performance architecture

- What are the latency-sensitive paths?
- Which work belongs at the edge, in the client, in the service layer, or off the request path entirely?
- What should be cached, streamed, precomputed, queued, or rate-limited?

## Deliverable shape

Produce a compact architecture note that leaves the team with:

- a boundary map,
- a contract summary,
- an authentication flow summary,
- performance assumptions and budgets,
- and the open risks that still need validation.

## Collaboration in this repo

- Use `Prometheus` when the architecture change needs a stepwise plan.
- Use `Explore` or `Librarian` before making assumptions about existing boundaries or contracts.
- Use `Oracle` when authentication, correctness, or large tradeoffs deserve a hard challenge pass.
- Pair with `frontend-web` or `mobile-app` when the contract is user-facing.
- Add the runtime-specific backend pack when service implementation details matter.
- Run `review-work` after substantial architecture-driven implementation.

## Guardrails

- Prefer explicit boundaries over implied coordination.
- Keep contracts small, versionable, and easy to test.
- Design auth around real trust boundaries instead of framework defaults.
- Treat performance as an architectural property, not a late-stage patch.
