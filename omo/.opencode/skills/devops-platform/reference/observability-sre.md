# Observability and SRE overlay for `devops-platform`

Use this overlay when runtime readiness depends on SLIs and SLOs, error budgets, burn-rate alerting, runbooks, incident response, or coordinated metrics, logs, and traces.

## Scope

- the team needs production telemetry that maps to real user impact,
- service health, release safety, or paging policy depends on SLO and error-budget thinking,
- incident response and toil reduction are part of the operational design, not follow-up cleanup.

## Required concepts

- Define a small set of user-visible SLIs first, then set SLOs and error-budget policy around them so alerts and release decisions tie back to customer impact.
- Use metrics, logs, and traces together with stable labels, correlation identifiers, and service ownership so incidents can move from symptom to cause quickly.
- Prefer multi-window, multi-burn-rate alerting for error-budget consumption and symptom-based paging over threshold spam on every internal metric.
- Keep runbooks, escalation paths, severity definitions, and incident communication expectations explicit so responders know the intended recovery path before an outage.
- Reduce toil on purpose: automate repetitive recovery steps, remove noisy alerts, and keep telemetry retention and sampling decisions aligned with investigation needs.

## Watchouts

- Avoid alerting on every component signal without proving user impact or ownership.
- Avoid dashboards without runbooks, traces without useful context, or SLOs that cannot actually be measured from available telemetry.
- Avoid accepting manual operational chores as permanent; repeated response work is usually a platform design input.

## First-party anchors

- Use first-party SRE and platform-monitoring conventions for SLIs, SLOs, error budgets, runbooks, and incident review as the source of truth.
- Pair this overlay with `docker-kubernetes-ci-cd.md` when rollout gates, probes, or runtime health checks need to line up with observability signals.
- Pair this overlay with `github-actions-argo.md` when promotion or rollback decisions depend on post-deploy health evidence.
