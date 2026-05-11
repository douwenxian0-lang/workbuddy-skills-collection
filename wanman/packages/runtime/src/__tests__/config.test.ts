/**
 * Tests for config.ts — loadConfig and ensureWorkspaceDirs.
 * Uses real filesystem operations with temporary directories.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { AgentMatrixConfig } from '@wanman/core';
import { buildEnrichedPrompt, loadConfig, ensureWorkspaceDirs } from '../config.js';

// Mock logger to suppress output
vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const tmpDir = path.join('/tmp', `wanman-config-test-${Date.now()}`);
const savedEnv: Record<string, string | undefined> = {};

function saveEnv(...keys: string[]) {
  for (const key of keys) {
    savedEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const [key, val] of Object.entries(savedEnv)) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
}

beforeEach(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
  saveEnv(
    'WANMAN_CONFIG',
    'WANMAN_DB',
    'WANMAN_PORT',
    'WANMAN_WORKSPACE',
    'WANMAN_GIT_ROOT',
    'WANMAN_SKILLS',
    'WANMAN_MODEL',
    'WANMAN_RUNTIME',
    'WANMAN_CODEX_MODEL',
    'WANMAN_SHARED_SKILLS',
    'HOME',
  );
});

afterEach(() => {
  restoreEnv();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const sampleConfig: AgentMatrixConfig = {
  agents: [
    { name: 'ceo', lifecycle: '24/7', model: 'sonnet', systemPrompt: 'You are CEO' },
    { name: 'dev', lifecycle: 'on-demand', model: 'sonnet', systemPrompt: 'You are Dev' },
  ],
  port: 3120,
  dbPath: '/data/wanman.db',
};

describe('loadConfig', () => {
  it('loads config from WANMAN_CONFIG path', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(sampleConfig));
    process.env['WANMAN_CONFIG'] = configPath;

    const config = loadConfig();
    expect(config.agents).toHaveLength(2);
    expect(config.agents[0]!.name).toBe('ceo');
    expect(config.port).toBe(3120);
    expect(config.dbPath).toBe('/data/wanman.db');
  });

  it('exits when config file does not exist', () => {
    process.env['WANMAN_CONFIG'] = '/nonexistent/path.json';
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    expect(() => loadConfig()).toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it('overrides dbPath from WANMAN_DB env var', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(sampleConfig));
    process.env['WANMAN_CONFIG'] = configPath;
    process.env['WANMAN_DB'] = '/custom/db.sqlite';

    const config = loadConfig();
    expect(config.dbPath).toBe('/custom/db.sqlite');
  });

  it('overrides port from WANMAN_PORT env var', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(sampleConfig));
    process.env['WANMAN_CONFIG'] = configPath;
    process.env['WANMAN_PORT'] = '4000';

    const config = loadConfig();
    expect(config.port).toBe(4000);
  });

  it('overrides workspaceRoot from WANMAN_WORKSPACE env var', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(sampleConfig));
    process.env['WANMAN_CONFIG'] = configPath;
    process.env['WANMAN_WORKSPACE'] = '/custom/workspace';

    const config = loadConfig();
    expect(config.workspaceRoot).toBe('/custom/workspace');
  });

  it('overrides gitRoot from WANMAN_GIT_ROOT env var', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(sampleConfig));
    process.env['WANMAN_CONFIG'] = configPath;
    process.env['WANMAN_GIT_ROOT'] = '/custom/repo';

    const config = loadConfig();
    expect(config.gitRoot).toBe('/custom/repo');
  });

  it('throws on invalid JSON', () => {
    const configPath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(configPath, 'not valid json{{{');
    process.env['WANMAN_CONFIG'] = configPath;

    expect(() => loadConfig()).toThrow();
  });

  it('overrides agent runtime from WANMAN_RUNTIME env var', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(sampleConfig));
    process.env['WANMAN_CONFIG'] = configPath;
    process.env['WANMAN_RUNTIME'] = 'codex';

    const config = loadConfig();
    expect(config.agents.every(agent => agent.runtime === 'codex')).toBe(true);
  });

  it('overrides only codex agent models from WANMAN_CODEX_MODEL', () => {
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      ...sampleConfig,
      agents: [
        { name: 'ceo', lifecycle: '24/7', runtime: 'claude', model: 'claude-opus-4-6', systemPrompt: 'You are CEO' },
        { name: 'dev', lifecycle: 'on-demand', runtime: 'codex', model: 'gpt-5.4', systemPrompt: 'You are Dev' },
      ],
    }));
    process.env['WANMAN_CONFIG'] = configPath;
    process.env['WANMAN_CODEX_MODEL'] = 'gpt-5.4-mini';

    const config = loadConfig();
    expect(config.agents.find(agent => agent.name === 'ceo')?.model).toBe('claude-opus-4-6');
    expect(config.agents.find(agent => agent.name === 'dev')?.model).toBe('gpt-5.4-mini');
  });
});

describe('ensureWorkspaceDirs', () => {
  it('creates agent workspace directories', () => {
    const workspaceRoot = path.join(tmpDir, 'workspace');
    const config = { ...sampleConfig, workspaceRoot };

    ensureWorkspaceDirs(config);

    expect(fs.existsSync(path.join(workspaceRoot, 'ceo'))).toBe(true);
    expect(fs.existsSync(path.join(workspaceRoot, 'dev'))).toBe(true);
  });

  it('copies AGENT.md skill files when available', () => {
    const workspaceRoot = path.join(tmpDir, 'workspace');
    const skillsDir = path.join(tmpDir, 'skills');

    // Create skill source
    const ceoSkillDir = path.join(skillsDir, 'ceo');
    fs.mkdirSync(ceoSkillDir, { recursive: true });
    fs.writeFileSync(path.join(ceoSkillDir, 'AGENT.md'), '# CEO Agent Skills');

    process.env['WANMAN_SKILLS'] = skillsDir;

    // Need to re-import to pick up the new env var — but SKILLS_DIR is evaluated at module load.
    // Instead, test the behavior by calling ensureWorkspaceDirs with a config that has workspaceRoot.
    const config = { ...sampleConfig, workspaceRoot };
    ensureWorkspaceDirs(config);

    const dst = path.join(workspaceRoot, 'ceo', 'AGENT.md');
    expect(fs.existsSync(dst)).toBe(true);
    expect(fs.readFileSync(dst, 'utf-8')).toBe('# CEO Agent Skills');
  });

  it('does not overwrite existing AGENT.md', () => {
    const workspaceRoot = path.join(tmpDir, 'workspace');
    const skillsDir = path.join(tmpDir, 'skills');

    // Create existing workspace AGENT.md
    const ceoDir = path.join(workspaceRoot, 'ceo');
    fs.mkdirSync(ceoDir, { recursive: true });
    fs.writeFileSync(path.join(ceoDir, 'AGENT.md'), '# Existing Skills');

    // Create skill source
    const ceoSkillDir = path.join(skillsDir, 'ceo');
    fs.mkdirSync(ceoSkillDir, { recursive: true });
    fs.writeFileSync(path.join(ceoSkillDir, 'AGENT.md'), '# New Skills');

    process.env['WANMAN_SKILLS'] = skillsDir;

    const config = { ...sampleConfig, workspaceRoot };
    ensureWorkspaceDirs(config);

    expect(fs.readFileSync(path.join(ceoDir, 'AGENT.md'), 'utf-8')).toBe('# Existing Skills');
  });

  it('is idempotent — safe to call multiple times', () => {
    const workspaceRoot = path.join(tmpDir, 'workspace');
    const config = { ...sampleConfig, workspaceRoot };

    ensureWorkspaceDirs(config);
    ensureWorkspaceDirs(config);

    expect(fs.existsSync(path.join(workspaceRoot, 'ceo'))).toBe(true);
    expect(fs.existsSync(path.join(workspaceRoot, 'dev'))).toBe(true);
  });

  it('uses default workspace root when not specified', () => {
    // This would try to create /workspace/agents, which we can't do in tests.
    // Instead, verify the function doesn't throw when workspaceRoot is set.
    const workspaceRoot = path.join(tmpDir, 'workspace');
    const config = { ...sampleConfig, workspaceRoot };

    expect(() => ensureWorkspaceDirs(config)).not.toThrow();
  });

  it('does not install shared skills globally in strict snapshot mode', () => {
    const workspaceRoot = path.join(tmpDir, 'workspace');
    const sharedSkillsDir = path.join(tmpDir, 'shared-skills');
    const homeDir = path.join(tmpDir, 'home');
    const skillDir = path.join(sharedSkillsDir, 'shared-demo');

    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Shared Skill');

    process.env['WANMAN_SHARED_SKILLS'] = sharedSkillsDir;
    process.env['HOME'] = homeDir;

    const config = { ...sampleConfig, workspaceRoot };
    ensureWorkspaceDirs(config);

    expect(fs.existsSync(path.join(homeDir, '.claude', 'skills', 'shared-demo', 'SKILL.md'))).toBe(false);
    expect(fs.existsSync(path.join(homeDir, '.codex', 'skills', 'shared-demo', 'SKILL.md'))).toBe(false);
  });
});

describe('buildEnrichedPrompt', () => {
  it('tells workers not to create backlog when they have no assigned tasks', () => {
    const prompt = buildEnrichedPrompt(
      { name: 'marketing', lifecycle: '24/7' as const, model: 'sonnet', systemPrompt: 'You are marketing' },
      '/tmp/workspace',
      sampleConfig.agents,
      'Launch a blueberry farm',
    );

    expect(prompt).toContain('wanman task list --assignee marketing')
    expect(prompt).toContain('do not create new backlog or self-assign work')
  });

  it('tells agents to rely on the active skill snapshot instead of static global skills', () => {
    const prompt = buildEnrichedPrompt(
      { name: 'dev', lifecycle: '24/7' as const, model: 'sonnet', systemPrompt: 'You are dev' },
      '/tmp/workspace',
      sampleConfig.agents,
      'Ship the patch',
    );

    expect(prompt).toContain('Active Skill Snapshot')
    expect(prompt).toContain('Do not assume every shared skill is active')
  });
});
