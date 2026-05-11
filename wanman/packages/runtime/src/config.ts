/**
 * Config loading and workspace setup — extracted from entrypoint.ts for testability.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { AgentDefinition, AgentMatrixConfig } from '@wanman/core';
import { createLogger } from './logger.js';

const log = createLogger('config');

/** Load agent matrix config from JSON file or env var. */
export function loadConfig(): AgentMatrixConfig {
  const configPath = process.env['WANMAN_CONFIG']
    || '/opt/wanman/agents.json';

  if (!fs.existsSync(configPath)) {
    log.error('config not found', { path: configPath });
    process.exit(1);
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  // Resolve ${ENV_VAR} patterns in config (e.g. "${DB9_TOKEN}" → actual env value)
  const resolved = raw.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] || '');
  const config = JSON.parse(resolved) as AgentMatrixConfig;

  // Override from env
  if (process.env['WANMAN_DB']) {
    config.dbPath = process.env['WANMAN_DB'];
  }
  if (process.env['WANMAN_PORT']) {
    config.port = parseInt(process.env['WANMAN_PORT'], 10);
  }
  if (process.env['WANMAN_WORKSPACE']) {
    config.workspaceRoot = process.env['WANMAN_WORKSPACE'];
  }
  if (process.env['WANMAN_GIT_ROOT']) {
    config.gitRoot = process.env['WANMAN_GIT_ROOT'];
  }
  // Override model for all agents (e.g. WANMAN_MODEL=qwen/qwen3.5-35b-a3b for local LLM)
  if (process.env['WANMAN_MODEL']) {
    const model = process.env['WANMAN_MODEL'];
    for (const agent of config.agents) {
      agent.model = model;
    }
    log.info('model override', { model });
  }
  if (process.env['WANMAN_RUNTIME']) {
    const runtime = process.env['WANMAN_RUNTIME'] === 'codex' ? 'codex' : 'claude';
    for (const agent of config.agents) {
      agent.runtime = runtime;
    }
    log.info('runtime override', { runtime });
  }
  if (process.env['WANMAN_CODEX_MODEL']) {
    const codexModel = process.env['WANMAN_CODEX_MODEL'];
    let updated = 0;
    for (const agent of config.agents) {
      const effectiveRuntime = agent.runtime === 'codex' ? 'codex' : 'claude';
      if (effectiveRuntime !== 'codex') continue;
      agent.model = codexModel;
      updated += 1;
    }
    log.info('codex model override', { model: codexModel, agents: updated });
  }

  // Disable brain when WANMAN_NO_BRAIN=1 (web app uses D1 instead)
  if (process.env['WANMAN_NO_BRAIN'] === '1') {
    config.brain = undefined;
    log.info('brain disabled via WANMAN_NO_BRAIN');
  }

  // Ensure brain.dbName is not empty (fallback when WANMAN_BRAIN_NAME env var is unset)
  if (config.brain && !config.brain.dbName) {
    config.brain.dbName = 'wanman-brain-local';
  }

  return config;
}

/** Ensure workspace directories exist for all agents and copy skill files. */
export function ensureWorkspaceDirs(config: AgentMatrixConfig): void {
  const root = config.workspaceRoot || '/workspace/agents';
  const skillsDir = process.env['WANMAN_SKILLS'] || '/opt/wanman/skills';
  for (const agent of config.agents) {
    const dir = path.join(root, agent.name);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log.info('created workspace', { agent: agent.name, dir });
    }

    // Copy AGENT.md skill file into the agent workspace if available
    const skillSrc = path.join(skillsDir, agent.name, 'AGENT.md');
    const skillDst = path.join(dir, 'AGENT.md');
    if (fs.existsSync(skillSrc) && !fs.existsSync(skillDst)) {
      fs.copyFileSync(skillSrc, skillDst);
      log.info('copied skill file', { agent: agent.name, src: skillSrc });
    }
  }

  // Fix workspace ownership for agent user
  const agentUser = process.env['WANMAN_AGENT_USER'];
  if (agentUser && process.getuid?.() === 0) {
    try {
      execSync(`chown -R ${agentUser}:${agentUser} ${root}`, { stdio: 'pipe' });
      log.info('fixed workspace ownership', { user: agentUser, path: root });
    } catch (err) {
      log.warn('failed to chown workspace', { user: agentUser, error: (err as Error).message });
    }
  }

}

/**
 * Build an enriched system prompt for agents using external LLMs.
 *
 * Weaker models (Qwen etc.) need more explicit instructions than Claude:
 * - CEO: needs agent roster + task create command examples
 * - Workers: need step-by-step task execution flow with command examples
 *
 * File locations are provided as pointers (not inlined) to minimize token cost.
 */
export function buildEnrichedPrompt(
  agent: AgentDefinition,
  workspaceRoot: string,
  allAgents?: AgentDefinition[],
  goal?: string,
): string {
  const agentDir = `${workspaceRoot}/${agent.name}`;

  const isCeo = agent.name === 'ceo';

  // CEO gets agent roster + task creation examples
  // Workers get step-by-step task execution flow
  const protocol = isCeo
    ? buildCeoProtocol(agent, agentDir, workspaceRoot, allAgents)
    : buildWorkerProtocol(agent, agentDir, goal);

  const prompt = `${agent.systemPrompt}

# Mandatory Protocol

${protocol}

## Your File Locations

- Role guide: \`${agentDir}/AGENT.md\` ← **read this file first**
- Working directory: \`${agentDir}/\` (all outputs go in \`${agentDir}/output/\`)
- Shared skills are mounted at runtime via the **Active Skill Snapshot** section in your task prompt
- Do not assume every shared skill is active; only read the files explicitly listed in that snapshot

## Prohibited

- Do NOT use TodoWrite — use \`wanman task\` only
- Do NOT use Glob/ls to get messages — use \`wanman recv\` only
- Do NOT create directories under /home/`;

  log.info('enriched prompt built', { agent: agent.name, length: prompt.length });
  return prompt;
}

function buildCeoProtocol(
  agent: AgentDefinition,
  agentDir: string,
  workspaceRoot: string,
  allAgents?: AgentDefinition[],
): string {
  // Build agent roster from config
  const workers = (allAgents ?? []).filter(a => a.name !== 'ceo');
  const roster = workers.length > 0
    ? workers.map(a => `  - **${a.name}** (${a.lifecycle}): ${a.systemPrompt.slice(0, 80)}...`).join('\n')
    : '  (no workers configured)';

  return `You must execute the following steps in order after startup:

1. Run \`cat ${agentDir}/AGENT.md\` to read your full role guide
2. Run \`wanman recv\` to check for pending messages
3. Run \`wanman task list\` to view all current tasks

## Available Agents

${roster}

## Creating Tasks (required format)

\`\`\`bash
wanman task create "<title>" --assign <agent_name> --priority <1-5> [--path <file_or_dir>] [--pattern <dir_prefix>]
\`\`\`

Examples:
\`\`\`bash
wanman task create "Complete brand design proposal" --assign marketing --priority 1 --path apps/report-viewer/src
wanman task create "Research 5 competitor pricing strategies" --assign feedback --priority 1
wanman task create "Draft opening financial budget" --assign finance --priority 1
\`\`\`

**Important**: Tasks involving code, docs, or artifact files MUST include \`--path\` or \`--pattern\` to prevent multiple agents from modifying the same scope.

## Monitoring Progress

- View task status: \`wanman task list\`
- View task details: \`wanman task get <id>\`
- Nudge an agent: \`wanman send <agent_name> "Please complete task <id> soon"\`
- Ask the human for a decision: \`wanman send human --type decision "<question>"\`
- Report a human blocker: \`wanman send human --type blocker "<what is blocked and why>"\`
- View output: \`cat ${workspaceRoot}/<agent_name>/output/<filename>\`

## When 2/3+ Tasks Are Complete

Begin the review phase: read each agent's output files and check for data consistency (brand names, pricing, target segments, etc.).`;
}

function buildWorkerProtocol(agent: AgentDefinition, agentDir: string, goal?: string): string {
  const goalSection = goal
    ? `\n## Current Project Goal\n\n> ${goal}\n\nAll your work must revolve around this goal. For any context not explicitly stated in a task, refer to this goal.\n`
    : '';

  return `${goalSection}You must execute the following steps in order after startup — do not skip any:

1. Run \`cat ${agentDir}/AGENT.md\` to read your full role guide
2. Run \`wanman recv\` to check for pending messages
3. Run \`wanman task list --assignee ${agent.name}\` to view tasks assigned to you
4. If no tasks are assigned yet, do not create new backlog or self-assign work. Wait for CEO direction unless you are explicitly asked to decompose work.

## Complete Task Execution Flow

For each task assigned to you, strictly follow these steps:

\`\`\`bash
# Step 1: Mark as started
wanman task update <task-id> --status in_progress

# Step 2: Execute work, write results to a file
cat > ${agentDir}/output/<filename>.md << 'HEREDOC'
# Title
(your work content)
HEREDOC

# Step 3: Mark as done
wanman task done <task-id> "Completed. Output: output/<filename>.md"

# Step 4: Notify CEO
wanman send ceo "Task done: <task title>. Output: output/<filename>.md"
\`\`\`

**Important**: Every task must reach \`wanman task done\` to be considered complete. Do not stop at in_progress.

If you need a human answer, approval, or missing access during the task:

\`\`\`bash
wanman send human --type decision "<question for the human>"
wanman send human --type blocker "<what is blocked and why>"
\`\`\`

Prefer explicit \`--type decision|blocker\` when talking to \`human\`, so the product can render the right card.`;
}
