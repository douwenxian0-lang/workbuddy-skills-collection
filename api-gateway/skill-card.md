## Description: <br>
Connect to external services through Maton-managed API routes. <br>

This skill is ready for commercial/non-commercial use. <br>

## Publisher: <br>
[byungkyu](https://clawhub.ai/user/byungkyu) <br>

### License/Terms of Use: <br>
MIT-0 <br>


## Use Case: <br>
External users and developers use this skill to route user-approved API calls through Maton to connected third-party services after confirming the target app, account, and task. <br>

### Deployment Geography for Use: <br>
Global <br>

## Known Risks and Mitigations: <br>
Risk: The skill can route access to external accounts through sensitive credentials and OAuth connections. <br>
Mitigation: Install only when Maton and the connected services are trusted, use least-privilege scopes, verify the exact connection and resource before each action, and delete connections when the task is complete. <br>
Risk: Write, sharing, purchasing, billing, messaging, publishing, scheduling, or deletion actions can create external side effects. <br>
Mitigation: Require explicit user confirmation before non-GET, sharing, or other high-impact actions, including the connection ID, endpoint path, request body, and expected outcome. <br>
Risk: API keys or OAuth tokens could be exposed through logs, prompts, shared files, command output, or tool results. <br>
Mitigation: Never print or echo MATON_API_KEY or OAuth tokens, verify only whether credentials are present, and rotate credentials immediately if exposure is suspected. <br>


## Reference(s): <br>
- [ClawHub API Gateway Skill Page](https://clawhub.ai/byungkyu/api-gateway) <br>
- [Maton Homepage](https://maton.ai) <br>
- [Maton API Reference](https://www.maton.ai/docs/api-reference) <br>
- [Maton CLI Manual](https://cli.maton.ai/manual) <br>
- [API Gateway Skill Source](SKILL.md) <br>


## Skill Output: <br>
**Output Type(s):** [guidance, shell commands, code, configuration, API calls] <br>
**Output Format:** [Markdown with inline shell, Python, JavaScript, and HTTP examples] <br>
**Output Parameters:** [1D] <br>
**Other Properties Related to Output:** [Outputs may include routed API endpoints, request bodies, CLI commands, connection guidance, and safety checks for user-approved external-service actions.] <br>

## Skill Version(s): <br>
1.0.124 (source: server release metadata) <br>

## Ethical Considerations: <br>
Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment. <br>
