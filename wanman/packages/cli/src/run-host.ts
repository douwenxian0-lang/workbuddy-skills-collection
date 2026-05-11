import type { RunOptions } from '@wanman/host-sdk'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  runExecutionSession,
  type ProjectRunSpec,
  type RunExecutionBindings,
} from './execution-session.js'
import { resolveRequestedProjectDir } from './run-orchestrator.js'

export function detectProjectDir(dir = process.cwd()): string | null {
  const configPath = path.join(dir, 'agents.json')
  return fs.existsSync(configPath) ? dir : null
}

export type HostRunBindings = RunExecutionBindings

export async function runGoal(
  goal: string,
  opts: RunOptions,
  spec: ProjectRunSpec = {},
  bindings: HostRunBindings = {},
): Promise<void> {
  const resolvedProjectDir = resolveRequestedProjectDir(opts.projectDir)

  await runExecutionSession(goal, { ...opts, projectDir: resolvedProjectDir }, {
    ...spec,
    projectDir: spec.projectDir ?? detectProjectDir(resolvedProjectDir ?? process.cwd()) ?? undefined,
  }, bindings)
}
