# Persona-based design testing

Use two or three personas that best match the interface type.

## Alex — impatient power user

Looks for shortcuts, hates forced onboarding, and expects efficient flows.

Red flags:

- no keyboard path,
- slow unskippable motion,
- one-item-at-a-time workflows,
- redundant confirmations.

## Jordan — confused first-timer

Needs obvious next steps, clear labels, and reassurance.

Red flags:

- icon-only navigation,
- jargon,
- unclear completion feedback,
- missing help.

## Sam — accessibility-dependent user

Relies on keyboard flow, semantics, focus visibility, and strong contrast.

Red flags:

- missing focus states,
- click-only interactions,
- unlabeled controls,
- meaning conveyed only by color.

## Riley — deliberate stress tester

Pushes edge cases, interruption, long strings, and broken-state recovery.

Red flags:

- silent failure,
- broken empty states,
- lost progress on refresh,
- inconsistent behavior across similar flows.

## Casey — distracted mobile user

Uses the interface one-handed, with interruptions and limited patience.

Red flags:

- top-heavy controls,
- no state persistence,
- tiny tap targets,
- too much typing where selection would do.

## Interface-to-persona guide

- marketing or landing pages: Jordan, Riley, Casey
- dashboards and admin tools: Alex, Sam
- checkout and transactional flows: Casey, Riley, Jordan
- onboarding: Jordan, Casey
- data-heavy tools: Alex, Sam

If `.impeccable.md` contains a strong audience profile, add one project-specific persona only when it clarifies a real product risk.
