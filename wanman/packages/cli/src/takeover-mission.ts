import type { ProjectIntent, ProjectProfile } from './takeover-project.js'

export interface MissionSeed {
  title: string
  goal: string
  summary: string
  priority: number
  sources: string[]
}

export function buildMissionSeeds(profile: ProjectProfile, intent: ProjectIntent): MissionSeed[] {
  const docs = intent.canonicalDocs.map(doc => doc.path)
  const roadmapDocs = intent.roadmapDocs.map(doc => doc.path)
  const codeRoots = intent.codeRoots.slice(0, 4)
  const seeds: MissionSeed[] = []

  seeds.push({
    title: 'Advance roadmap-backed product delivery',
    goal: `Ship the next externally valuable improvements for ${intent.projectName} based on roadmap, canonical docs, and core code roots.`,
    summary: `Maintain focus on real product delivery for ${intent.projectName}, not only local optimization of the takeover system.`,
    priority: 10,
    sources: roadmapDocs.length > 0 ? roadmapDocs : docs.slice(0, 4),
  })

  if (profile.ci.length > 0 || profile.testFrameworks.length > 0 || intent.packageScripts.length > 0) {
    seeds.push({
      title: 'Protect release readiness and verification',
      goal: 'Keep tests, CI, build, verification, and release paths healthy enough to support continuous delivery.',
      summary: 'Use CI, test suites, and package scripts as a continuous readiness surface, not a one-time cleanup checklist.',
      priority: 8,
      sources: [...new Set([...docs.slice(0, 2), ...codeRoots])],
    })
  }

  if (profile.hasReadme || profile.hasDocs || profile.issueTracker !== 'none') {
    seeds.push({
      title: 'Keep docs and feedback aligned with implementation',
      goal: 'Continuously fold README/docs drift and external or inferred feedback into the roadmap and backlog.',
      summary: 'Use docs, changelog, TODOs, and feedback signals to keep the mission anchored to user-visible outcomes.',
      priority: 7,
      sources: docs.slice(0, 6),
    })
  }

  return seeds.slice(0, 3)
}

export function buildTakeoverKickoffPayload(intent: ProjectIntent): string {
  return [
    `Takeover kickoff for ${intent.projectName}.`,
    'If the initiative board or backlog is empty, create the first 1-3 active initiatives and then the first 3-5 scoped tasks immediately.',
    'Every meaningful code task should reference an initiative and create a change capsule with branch + allowed paths + acceptance before branch work expands.',
    'Keep the backlog anchored to roadmap, docs, release readiness, and user-visible value.',
  ].join(' ')
}
