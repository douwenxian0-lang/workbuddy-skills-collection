import { describe, it, expect } from 'vitest'
import type { AgentMessage } from '@wanman/core'
import { generatePreamble, type PreambleInput } from '../preamble.js'
import type { Task } from '../task-pool.js'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-00000001',
    title: 'Test task',
    description: '',
    scope: { paths: [] },
    status: 'pending',
    priority: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    dependsOn: [],
    ...overrides,
  }
}

function makeMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    id: '1',
    from: 'ceo',
    to: 'dev',
    type: 'message',
    priority: 'normal',
    payload: 'Hello',
    timestamp: Date.now(),
    delivered: false,
    ...overrides,
  }
}

function makeInput(overrides: Partial<PreambleInput> = {}): PreambleInput {
  return {
    agentName: 'dev',
    tasks: [],
    recentMessages: [],
    loopNumber: 5,
    uptimeSeconds: 120,
    ...overrides,
  }
}

describe('generatePreamble', () => {
  it('should include loop number in header', () => {
    const result = generatePreamble(makeInput({ loopNumber: 42 }))
    expect(result).toContain('Loop #42')
  })

  it('should include run ID when provided', () => {
    const result = generatePreamble(makeInput({ runId: 'run-abc123' }))
    expect(result).toContain('run-abc123')
  })

  it('should format uptime in seconds', () => {
    const result = generatePreamble(makeInput({ uptimeSeconds: 30, runId: 'run-1' }))
    expect(result).toContain('30s')
  })

  it('should format uptime in minutes', () => {
    const result = generatePreamble(makeInput({ uptimeSeconds: 150, runId: 'run-1' }))
    expect(result).toContain('2m')
  })

  it('should format uptime in hours', () => {
    const result = generatePreamble(makeInput({ uptimeSeconds: 7500, runId: 'run-1' }))
    expect(result).toContain('2h5m')
  })

  it('should include steer reason when present', () => {
    const result = generatePreamble(makeInput({ steerReason: 'Urgent: budget overrun' }))
    expect(result).toContain('interrupted by a steer')
    expect(result).toContain('Urgent: budget overrun')
  })

  it('should show tasks assigned to the agent', () => {
    const result = generatePreamble(makeInput({
      tasks: [
        makeTask({ id: 'task-001', title: 'Research competitors', assignee: 'dev', status: 'in_progress' }),
        makeTask({ id: 'task-002', title: 'Write report', assignee: 'dev', status: 'pending' }),
      ],
    }))
    expect(result).toContain('Current Tasks')
    expect(result).toContain('Research competitors')
    expect(result).toContain('Write report')
    expect(result).toContain('🔄') // in_progress
    expect(result).toContain('⏳') // pending
  })

  it('should show pending tasks even if not assigned to agent', () => {
    const result = generatePreamble(makeInput({
      agentName: 'dev',
      tasks: [
        makeTask({ id: 'task-001', title: 'Unassigned task', status: 'pending' }),
      ],
    }))
    expect(result).toContain('Unassigned task')
  })

  it('should not show tasks assigned to other agents with non-pending status', () => {
    const result = generatePreamble(makeInput({
      agentName: 'dev',
      tasks: [
        makeTask({ id: 'task-001', title: 'Other agent task', assignee: 'finance', status: 'in_progress' }),
      ],
    }))
    expect(result).not.toContain('Other agent task')
  })

  it('should truncate tasks list to 10', () => {
    const tasks = Array.from({ length: 15 }, (_, i) =>
      makeTask({ id: `task-${i}`, title: `Task ${i}`, assignee: 'dev', status: 'pending' })
    )
    const result = generatePreamble(makeInput({ tasks }))
    expect(result).toContain('and 5 more tasks')
  })

  it('should show recent messages', () => {
    const result = generatePreamble(makeInput({
      recentMessages: [
        makeMessage({ from: 'ceo', payload: 'Start research' }),
        makeMessage({ from: 'finance', payload: 'Budget data ready' }),
      ],
    }))
    expect(result).toContain('Recent Messages')
    expect(result).toContain('ceo')
    expect(result).toContain('Start research')
    expect(result).toContain('finance')
  })

  it('should mark steer messages', () => {
    const result = generatePreamble(makeInput({
      recentMessages: [
        makeMessage({ from: 'ceo', priority: 'steer', payload: 'Stop current work' }),
      ],
    }))
    expect(result).toContain('[STEER]')
  })

  it('should truncate long message payloads', () => {
    const longPayload = 'x'.repeat(200)
    const result = generatePreamble(makeInput({
      recentMessages: [makeMessage({ payload: longPayload })],
    }))
    expect(result).toContain('...')
  })

  it('should handle object payloads', () => {
    const result = generatePreamble(makeInput({
      recentMessages: [makeMessage({ payload: { key: 'value' } })],
    }))
    expect(result).toContain('"key"')
  })

  it('should truncate messages to 5', () => {
    const msgs = Array.from({ length: 8 }, (_, i) =>
      makeMessage({ from: `agent-${i}`, payload: `msg ${i}` })
    )
    const result = generatePreamble(makeInput({ recentMessages: msgs }))
    // Should show agent-0 through agent-4 but not agent-5+
    expect(result).toContain('agent-4')
    expect(result).not.toContain('agent-5')
  })

  it('should produce empty sections when no data', () => {
    const result = generatePreamble(makeInput())
    expect(result).toContain('Loop #5')
    expect(result).not.toContain('Current Tasks')
    expect(result).not.toContain('Recent Messages')
  })

  it('should show all status emojis correctly', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'done', assignee: 'dev', status: 'done' }),
      makeTask({ id: 't2', title: 'failed', assignee: 'dev', status: 'failed' }),
      makeTask({ id: 't3', title: 'review', assignee: 'dev', status: 'review' }),
      makeTask({ id: 't4', title: 'assigned', assignee: 'dev', status: 'assigned' }),
      makeTask({ id: 't5', title: 'in_progress', assignee: 'dev', status: 'in_progress' }),
    ]
    const result = generatePreamble(makeInput({ tasks }))
    expect(result).toContain('✅')
    expect(result).toContain('❌')
    expect(result).toContain('🔍')
    expect(result).toContain('📋')
    expect(result).toContain('🔄')
  })
})
