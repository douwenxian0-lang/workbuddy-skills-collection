# Elixir, Phoenix, Scala, and Clojure overlay for `functional-platform`

Use this overlay when the functional-platform task is shaped by immutable data modeling, process or message concurrency, Phoenix application structure, Scala runtime choices, or Clojure's data-first service style.

## Reach for this overlay when

- the codebase already uses Elixir, Phoenix, Scala, or Clojure,
- supervision trees, actors, streams, effects, or message passing drive the application shape,
- runtime behavior matters as much as business logic structure.

## Working rules

- Model state transitions as immutable data transformations before choosing framework hooks or runtime abstractions.
- In Elixir, Erlang, and Phoenix, keep supervision trees, processes, mailboxes, and message boundaries visible enough to reason about failure and restart behavior.
- In Scala, make the effect runtime, actor model, stream topology, or blocking boundary explicit so threads and backpressure stay understandable.
- In Clojure, keep namespaces, specs or schema checks, and data transformation pipelines readable at the service edge.
- In Haskell and F#, preserve a pure core with a clear effect shell when side effects and orchestration enter the picture.

## Watchouts

- Avoid copying mutable service-layer patterns into runtimes built around immutable state and explicit effects.
- Avoid treating process or actor concurrency as interchangeable with ordinary thread pools.
- Avoid hiding data validation and dispatch inside macro-heavy or convention-heavy layers that obscure the real flow.
