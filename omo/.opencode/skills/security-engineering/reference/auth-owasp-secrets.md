# Authentication, OWASP, and secrets overlay for `security-engineering`

Use this overlay when the task is shaped by login, session or token handling, authorization checks, secrets hygiene, or OWASP-style hardening requirements.

## Reach for this overlay when

- the system handles credentials, sessions, refresh tokens, or federated identity,
- MFA, passwordless, re-authentication, or TLS posture matters,
- secrets move through code, CI/CD, containers, or runtime infrastructure.

## Working rules

- Keep authentication and authorization separate. Define who the subject is, how identity is proven, and how permissions are enforced.
- Prefer strong credential handling: modern password hashing, safe comparison, rate limiting, lockout or throttling where appropriate, generic error messages, and secure recovery flows.
- Make session and token rules explicit: expiry, rotation, revocation, replay resistance, and re-authentication for sensitive actions or elevated risk events.
- Push toward MFA or passwordless and federated identity where the environment supports it, and keep TLS mandatory anywhere credentials or session material travels.
- Apply OWASP-style review across input validation, output encoding, CSRF and XSS exposure, injection paths, headers, and dependency risk.
- Manage secrets through their whole lifecycle: creation, storage, access control, rotation, revocation, expiration, and audit.
- In CI/CD and containers, prefer managed secrets, workload identity, or short-lived credentials over hardcoded values, checked-in files, or plaintext pipeline variables.
- Keep secret material out of logs, crash dumps, screenshots, copied shell history, and diagnostic output whenever feasible.

## Watchouts

- Avoid assuming JWTs remove the need for server-side revocation, session rules, or re-authentication.
- Avoid long-lived static secrets in build pipelines, container images, or shared environment files.
- Avoid user enumeration, overly detailed auth failures, and password-reset flows that leak account existence.
