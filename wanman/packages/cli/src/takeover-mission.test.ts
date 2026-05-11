import { describe, expect, it } from 'vitest'
import type { ProjectIntent, ProjectProfile } from './takeover-project.js'
import { buildMissionSeeds, buildTakeoverKickoffPayload } from './takeover-mission.js'

function makeProfile(overrides: Partial<ProjectProfile> = {}): ProjectProfile {
  return {
    path: '/repo',
    languages: ['typescript'],
    packageManagers: ['pnpm'],
    frameworks: ['react'],
    ci: ['github-actions'],
    testFrameworks: ['vitest'],
    hasReadme: true,
    hasClaudeMd: false,
    hasDocs: true,
    issueTracker: 'github',
    githubRemote: 'git@github.com:test/repo.git',
    readmeExcerpt: '# Repo',
    codeRoots: ['apps', 'packages'],
    packageScripts: ['build', 'test'],
    ...overrides,
  }
}

function makeIntent(overrides: Partial<ProjectIntent> = {}): ProjectIntent {
  return {
    projectName: 'Acme',
    summary: 'Acme project summary',
    canonicalDocs: [
      {
        path: 'README.md',
        kind: 'readme',
        title: 'README',
        excerpt: 'Intro',
        headings: ['Overview'],
        score: 10,
      },
      {
        path: 'docs/roadmap.md',
        kind: 'roadmap',
        title: 'Roadmap',
        excerpt: 'Roadmap',
        headings: ['Now'],
        score: 9,
      },
    ],
    roadmapDocs: [
      {
        path: 'docs/roadmap.md',
        kind: 'roadmap',
        title: 'Roadmap',
        excerpt: 'Roadmap',
        headings: ['Now'],
        score: 9,
      },
    ],
    codeRoots: ['packages/runtime', 'packages/cli'],
    packageScripts: ['build', 'test'],
    strategicThemes: ['ship user value'],
    mission: 'Ship the next externally valuable improvements.',
    ...overrides,
  }
}

describe('buildMissionSeeds', () => {
  it('builds roadmap, readiness, and docs/feedback seeds for a repo-aware project', () => {
    const seeds = buildMissionSeeds(makeProfile(), makeIntent())

    expect(seeds).toHaveLength(3)
    expect(seeds[0]).toMatchObject({
      title: 'Advance roadmap-backed product delivery',
      priority: 10,
      sources: ['docs/roadmap.md'],
    })
    expect(seeds[1]?.title).toBe('Protect release readiness and verification')
    expect(seeds[2]?.title).toBe('Keep docs and feedback aligned with implementation')
  })

  it('keeps the seed set minimal when the project lacks readiness and feedback signals', () => {
    const seeds = buildMissionSeeds(
      makeProfile({
        ci: [],
        testFrameworks: [],
        hasReadme: false,
        hasDocs: false,
        issueTracker: 'none',
        packageScripts: [],
      }),
      makeIntent({
        canonicalDocs: [{
          path: 'notes/project.md',
          kind: 'notes',
          title: 'Project',
          excerpt: 'Notes',
          headings: [],
          score: 5,
        }],
        roadmapDocs: [],
        packageScripts: [],
      }),
    )

    expect(seeds).toHaveLength(1)
    expect(seeds[0]?.title).toBe('Advance roadmap-backed product delivery')
    expect(seeds[0]?.sources).toEqual(['notes/project.md'])
  })
})

describe('buildTakeoverKickoffPayload', () => {
  it('anchors kickoff around initiatives, capsules, and roadmap value', () => {
    const payload = buildTakeoverKickoffPayload(makeIntent())

    expect(payload).toContain('Takeover kickoff for Acme.')
    expect(payload).toContain('initiative board')
    expect(payload).toContain('change capsule')
    expect(payload).toContain('roadmap')
  })
})
