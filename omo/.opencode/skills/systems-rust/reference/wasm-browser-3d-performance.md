# WASM browser 3D performance overlay for `systems-rust`

Use this overlay only when browser-3D work already belongs to `frontend-web` and measured runtime pressure justifies a narrow Rust/WASM escalation path.

## Scope

- Escalation-only lane for browser-3D workloads where geometry generation, simulation, parsing, or other compute-heavy paths have become measured bottlenecks.
- Keep scene ownership, engine integration, and browser-3D product decisions under `frontend-web`; use this overlay for the hot path, not the whole feature surface.

## Required concepts

- Geometry, simulation, and compute boundaries: move dense math, mesh processing, parsing, or simulation loops across the boundary only when the browser-side profile shows sustained pressure in those paths.
- JS/WASM transfer costs: prefer coarse-grained buffers and stable typed layouts, because many small boundary hops or copy-heavy marshaling can erase the expected throughput win.
- Startup and binary-size constraints: budget download, compile, and instantiate cost before choosing WASM, especially for cold-start scenes and lower-end devices.
- Off-main-thread boundaries: pair WASM with Workers when main-thread contention is the actual bottleneck, but keep message passing, shared-memory assumptions, and scheduling overhead explicit.

## Watchouts

- Do not use this overlay as the default route for browser 3D; it exists only after profiling shows a browser-side bottleneck that `frontend-web` alone should not absorb.
- Do not push engine object graphs, React component state, or render-loop orchestration through the WASM boundary.
- Do not claim a performance win before measuring transfer overhead, binary/startup cost, worker coordination, and end-to-end frame-time impact.

## First-party anchors

- `../../../reference/web-3d-support-model.md`
- `../../../reference/capability-matrix.json`
