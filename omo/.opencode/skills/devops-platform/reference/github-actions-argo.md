# GitHub Actions and Argo overlay for `devops-platform`

Use this overlay when delivery design is shaped by GitHub Actions workflow boundaries, environment gates, and the handoff into Argo CD Applications or ApplicationSets for deployment reconciliation.

## Scope

- GitHub Actions owns validation, packaging, artifact publication, or declarative deployment updates,
- Argo CD owns reconciliation of Kubernetes application state through `Application` or `ApplicationSet`,
- promotion control depends on workflow permissions, approvals, sync policy, or environment-specific handoff rules.

## Required concepts

- Keep workflow triggers explicit and minimal: use `push`, `pull_request`, `workflow_call`, and `workflow_dispatch` deliberately, and narrow default token permissions so jobs only get the access they need.
- Prefer reusable workflows or composite actions for shared build, test, scan, and publish steps, and use protected environments or approval gates where artifact promotion crosses trust boundaries.
- Let GitHub Actions validate and publish the intended deployment input, then let Argo CD reconcile from the declared source of truth; avoid turning CI into an imperative cluster control path.
- Model Argo CD `Application` and `ApplicationSet` ownership, sync policy, prune and self-heal behavior, waves, and hooks intentionally so promotion behavior is reviewable.
- Keep promotion control explicit between environments: production should trace back to an approved artifact, reviewed configuration change, and visible deployment status.

## Watchouts

- Avoid long-lived cluster-admin credentials in Actions or jobs that mutate live clusters outside the declarative handoff.
- Avoid hidden trigger chains, opaque reusable workflow contracts, or ApplicationSets that fan out across environments without clear ownership.
- Avoid identical sync policy everywhere when staging and production need different approval, rollback, or drift-remediation behavior.

## First-party anchors

- Use GitHub Actions workflow, permissions, reusable-workflow, and environment-protection guidance plus Argo CD `Application`, `ApplicationSet`, and sync-policy guidance as the source of truth.
- Pair this overlay with `docker-kubernetes-ci-cd.md` when container artifact flow and rollout behavior dominate the release path.
- Pair this overlay with `terraform-pulumi.md` when plan, apply, or platform bootstrap approvals sit in the same delivery chain.
