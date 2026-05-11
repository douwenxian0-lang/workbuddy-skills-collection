# Rollback, promotion, and feature flags overlay for `release-engineering`

Use this overlay when release safety depends on promotion stages, rollback readiness, feature-flag control, and the separation between shipping an artifact and exposing new behavior.

## Scope

- the release path includes draft, prerelease, canary, staged, or stable promotion steps,
- rollback decisions depend on version compatibility, data shape, configuration drift, or user-impact telemetry,
- feature flags or kill switches control exposure after an artifact has been published or deployed.

## Required concepts

- Define promotion gates explicitly: what evidence, approvals, telemetry, or compatibility checks move a release from draft to prerelease to stable should be visible before the first cut.
- Keep rollback paths attached to the release unit, including version selection, config reversal, flag state, migration constraints, and who owns the decision when something degrades.
- Use feature flags deliberately: each flag should have an owner, intent, expected lifetime, rollout plan, and kill-switch behavior rather than becoming a permanent hidden fork.
- Separate deploy from exposure so an artifact can land safely before a risky path is enabled, and so rollback choices are not confused with flag flips or environment promotion.

## Watchouts

- Avoid one-way migrations, irreversible config changes, or external dependency upgrades without a staged promotion and rollback story.
- Avoid promotion policies that depend on intuition alone when telemetry, QA evidence, or customer-impact signals should drive the decision.
- Avoid feature-flag sprawl where stale flags, hidden dependencies, or undocumented defaults make rollback harder instead of easier.

## First-party anchors

- Pair this overlay with `../../devops-platform/SKILL.md` when rollout mechanics, environment gates, or deployment-controller behavior dominate the release path.
- Pair this overlay with `../../qa-validation/SKILL.md` when promotion or rollback thresholds depend on explicit release-readiness evidence.
