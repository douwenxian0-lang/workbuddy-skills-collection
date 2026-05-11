# E2E browser example

Use this example when you need a compact shape for browser-driven flow validation. It stays harness-friendly on purpose, so it works with Playwright, browser automation helpers, or another equivalent runner.

## Example goal

Validate sign-in, a core CRUD flow, and one failure path on a staging build.

## Example structure

1. Open the app and confirm the expected page state.
2. Sign in with a known test account.
3. Complete the main happy path from start to saved result.
4. Exercise one edge or failure path, such as invalid input, expired auth, or a server error state.
5. Confirm the UI feedback, stored result, and route protection behavior.

## Example evidence

- URL or environment under test.
- Screenshots or snapshots for entry, success, and failure states.
- Short notes on browsers and viewports covered.
- Console or network notes only when they explain a failure.

## Example findings format

| Flow | Result | Evidence |
| --- | --- | --- |
| Sign in | Pass | Dashboard loaded and protected routes became available |
| Create record | Pass | New item appeared in the list and persisted after refresh |
| Invalid submission | Pass | Inline validation blocked save and explained the error |

Compare release decisions against `../../quality-gates.md` and use the other examples in this folder when accessibility, performance, or full release readiness also matter.
