# Docker, Kubernetes, and CI/CD overlay for `devops-platform`

Use this overlay when delivery is shaped by container image flow, Kubernetes rollout behavior, runtime probes, or clear CI versus CD boundaries.

## Reach for this overlay when

- the team builds and publishes Docker images,
- Kubernetes is the deployment target or the closest deployment model,
- release safety depends on rollout status, health checks, or artifact promotion.

## Working rules

- Build, test, scan, tag, and publish container images in a repeatable flow that produces immutable artifacts ready for promotion.
- Prefer versioned tags and digests so the deployed artifact is unambiguous across environments.
- Treat CI as the path that validates code, runs tests, performs scans, and publishes artifacts; treat CD as the path that promotes approved artifacts and applies declarative deployment changes.
- Use Kubernetes Deployments, rollout status, and rollout history deliberately so rollout and rollback behavior is observable.
- Configure readiness, liveness, and startup probes to reflect real service health instead of masking slow starts or broken dependencies.
- Keep runtime secret handling outside the image: mount secrets at deploy time, scope service accounts narrowly, and avoid baking credentials into the container.
- Use staged rollout thinking where risk is meaningful: progressive delivery, health-based promotion, and explicit rollback triggers.

## Watchouts

- Avoid mutable `latest` tags, hand-tuned live containers, or undocumented environment drift.
- Avoid CI jobs that both build artifacts and silently mutate production state with long-lived credentials.
- Avoid probe settings or rollout policies that cause crash loops, hide failed startups, or make rollback slower than recovery needs.
