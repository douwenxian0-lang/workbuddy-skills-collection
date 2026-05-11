# Accessibility example

Use this example when you need a compact WCAG-oriented validation shape for a browser feature or release check.

## Example goal

Review a critical user flow for keyboard use, semantic structure, focus behavior, labels, and assistive-technology signals before release.

## Example structure

1. Walk the full flow with keyboard-only navigation.
2. Check landmarks, heading order, form labels, error messaging, and visible focus.
3. Capture an accessibility tree or equivalent semantic snapshot on the highest-risk screens.
4. Review contrast-sensitive states, including alerts, badges, disabled states, and colored panels.
5. Record defects by impact, then decide whether the flow clears the shared gate in `../../quality-gates.md`.

## Example evidence

- Keyboard traversal notes.
- Accessibility snapshots for major screens or dialogs.
- Short contrast findings with affected UI states.
- Clear pass, fail, or blocked call for WCAG 2.1 AA readiness.

## Example findings format

| Check | Result | Evidence |
| --- | --- | --- |
| Keyboard order | Pass | Tabbing followed a logical order through form fields and actions |
| Labels and errors | Pass | Inputs had labels and invalid states announced clear guidance |
| Dialog focus | Fail | Focus escaped the modal after the second tab press |

Fix blocking issues before using this flow as release evidence.
