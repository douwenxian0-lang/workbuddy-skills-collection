# AWS, Azure, and GCP overlay for `devops-platform`

Use this overlay when platform work is shaped by landing-zone structure, identity boundaries, network topology, governance controls, or environment-class expectations across AWS, Azure, or GCP.

## Scope

- the work depends on organization, account, subscription, folder, or project boundaries,
- IAM, service identity, network segmentation, or security controls shape deployment safety,
- logging, monitoring, and environment classes change how shared platform services should be laid out.

## Required concepts

- Model tenancy and ownership deliberately: AWS Organizations and accounts, Azure management groups and subscriptions, or GCP organizations, folders, and projects should separate shared services, security controls, and workload environments on purpose.
- Treat IAM as first-class architecture: prefer federated human access, workload identities, narrow roles, and explicit break-glass paths over long-lived shared credentials.
- Define network topology early: hub-and-spoke, shared VPC, ingress and egress control, private service connectivity, DNS ownership, and environment segmentation should reflect blast radius and team boundaries.
- Apply governance through first-party policy layers such as AWS SCPs and Config, Azure Policy, or GCP Org Policy so tagging, region limits, encryption defaults, and audit logging are enforced consistently.
- Keep baseline security controls plus logging and monitoring aligned across sandbox, non-production, and production so environment classes differ by approval and risk posture, not by undocumented drift.

## Watchouts

- Avoid flattening org, account, subscription, or project boundaries for short-term convenience; retrofitting separation later is expensive.
- Avoid internet-flat networks, shared admin roles, or manual policy exceptions that bypass audit trails and platform guardrails.
- Avoid treating dev, stage, and prod as names only; each environment class needs distinct access, quota, recovery, and change-control expectations.

## First-party anchors

- Use AWS landing-zone and Organizations guidance, Azure management group and Policy guidance, and GCP resource hierarchy and Org Policy guidance as the source of truth.
- Pair this overlay with `terraform-pulumi.md` when account bootstrap, shared networking, or guardrail rollout is implemented as infrastructure as code.
- Pair this overlay with `observability-sre.md` when platform telemetry and incident readiness are part of the target operating model.
