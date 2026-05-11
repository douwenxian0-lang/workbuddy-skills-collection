# Workflow Catalog

This catalog is the human-readable registry for the four frozen flagship workflows declared in `.opencode/reference/capability-matrix.json`. It keeps the validated surface deliberately narrow: the bundle can expose broad pack and overlay coverage, but only these four workflows are reserved for current `validated` public claims.

## Catalog rules

1. The flagship workflow set is frozen to exactly four IDs.
2. The catalog mirrors the manifest IDs exactly.
3. The workflow proof-contract docs live under `.opencode/reference/workflows/`.
4. README `supported now` summaries may cite only manifest entries whose support level is `validated`.

## Frozen flagship workflows

### `frontend-product-delivery`

- dominant bucket: `web/mobile UI`
- primary route: `frontend-web`
- adjacent pack rule: add `architecture-integration` when contracts, auth, or shared cross-stack boundaries dominate; add the owning backend pack only when request shape or auth behavior changes are in scope
- built-in helper fit: `frontend-ui-ux`, `Explore`, `review-work`
- support tier: `validated`
- proof contract: `.opencode/reference/workflows/frontend-product-delivery.md`

### `backend-service-delivery`

- dominant bucket: `backend/API`
- primary route: the owning backend pack (`backend-node`, `backend-python`, `backend-jvm`, `backend-dotnet`, or `backend-go`)
- adjacent pack rule: add `architecture-integration` for contract or cross-service boundary work; add `database-engineering` or `security-engineering` when storage or auth risk becomes first-class
- built-in helper fit: `Oracle`, `Context7`, `Librarian`, `review-work`
- support tier: `validated`
- proof contract: `.opencode/reference/workflows/backend-service-delivery.md`

### `cloud-release-readiness`

- dominant bucket: `QA/deployment`
- primary route: `devops-platform`
- adjacent pack rule: add `qa-validation` for evidence and release-risk checks; add `security-engineering` when runtime hardening or identity posture is central
- built-in helper fit: `Prometheus`, `Oracle`, `Context7`, `review-work`
- support tier: `validated`
- proof contract: `.opencode/reference/workflows/cloud-release-readiness.md`

### `ai-data-product-delivery`

- dominant bucket: `data/security`
- primary route: `data-ml-platform`
- adjacent pack rule: add `architecture-integration` when model-serving or product contracts span multiple surfaces; add `database-engineering` when storage, retrieval, or lineage boundaries dominate
- built-in helper fit: `Context7`, `Librarian`, `Oracle`, `review-work`
- support tier: `validated`
- proof contract: `.opencode/reference/workflows/ai-data-product-delivery.md`

## Workflow doc contract

Each workflow file under `.opencode/reference/workflows/` is a compact proof contract that declares:

1. its primary route,
2. its adjacent pack rule,
3. its built-in helper fit,
4. its support-tier boundary,
5. and its evidence path contract.

That keeps the catalog compact while preserving a stable inventory the workflow docs can elaborate without changing the frozen four-workflow set.
