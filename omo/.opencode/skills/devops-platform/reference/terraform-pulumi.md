# Terraform and Pulumi overlay for `devops-platform`

Use this overlay when delivery safety depends on infrastructure state, backend and locking choices, provider or component boundaries, stack or workspace scoping, or drift handling.

## Scope

- the team provisions or updates cloud foundations through Terraform or Pulumi,
- backend, state, locking, provider, module, or component strategy determines release safety,
- environment scoping and drift recovery matter as much as the resource definitions themselves.

## Required concepts

- Use remote state and backend storage with encryption, versioning, and least-privilege access so plans and applies are reproducible and recoverable.
- Turn on locking or its cloud equivalent wherever the tool supports it; concurrent applies against the same stack or state are operational defects, not normal workflow.
- Keep provider configuration explicit and reusable building blocks clean: Terraform modules or Pulumi components should encode ownership boundaries instead of hiding shared side effects.
- Scope Terraform workspaces and Pulumi stacks to real environment or workload boundaries so state remains understandable; do not use them as a substitute for architecture.
- Treat drift as a signal: run plan or preview deliberately, import existing resources intentionally, and document emergency changes before they become invisible baseline differences.

## Watchouts

- Avoid local state files, ad hoc backend migration, or CI jobs that can write state without locking and audit visibility.
- Avoid splitting ownership of the same resource across multiple stacks, modules, or tools unless the interface is explicit and stable.
- Avoid workspace or stack sprawl that hides which team owns which environment, or using variable switches to make one state represent many unrelated targets.

## First-party anchors

- Use Terraform backend, state-locking, provider, and module conventions or Pulumi stack, backend, provider, and component conventions as the source of truth.
- Pair this overlay with `aws-azure-gcp.md` when the IaC layer is implementing landing zones, shared networking, or cloud governance controls.
- Pair this overlay with `github-actions-argo.md` when plan, preview, approval, and apply boundaries are part of the delivery chain.
