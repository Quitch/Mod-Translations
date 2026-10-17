# Testing

## Commands

- `npm test` — runs every `test/*.test.js` under Node's built-in runner (`node --test`).
- `npm run test:coverage` — the same, with a coverage table for `ui/**` and
  `coverage/lcov.info` for SonarCloud. It fails under 80% line coverage.
- `node --test test/translations.test.js` — runs one file.
  `--test-name-pattern="<pattern>"` narrows the run to one test.
- `npm run verify` — the full pre-submit gate, tests included. CI
  (`.github/workflows/ci.yml`) runs exactly this.

There is no third-party runner, assertion library or coverage tool. `node:test`,
`node:assert/strict` and `--experimental-test-coverage` are all of it. The tests add one
devDependency, lodash 3.9.3, the version the game ships. It stands in for the global `_`.

## How the shipped file is loaded

`translations.js` is an IIFE that takes `window` as its root. It reads the engine (`i18n`,
`XMLHttpRequest`, `_`, `console`) as bare globals, exactly as a PA page provides them.
`scripts/lib/scene-loader.js` reproduces that. A test builds one plain object as its
`window` and puts the fakes it needs on it. Then `loadScene(ctx, "global_mod_list")` runs
the file inside `(function (window) { with (window) { … } })` in the current realm. The
wrapper shares the file's first line, so stack traces and the coverage report use the
file's own line numbers.

Consequences worth knowing:

- **A test never touches Node's globals.** Every engine object lives on the test's own
  `window`, so nothing needs restoring between tests. Building a new window resets the
  registration cache.
- **A missing engine global is a `ReferenceError`, not `undefined`**, as in the game.
  `translations.js` reads `root.i18n` as a property, so an absent `i18n` takes the
  `{ ok: false }` path rather than throwing. `test/translations.test.js` pins both the
  absent and the `null` shape.

## The fakes

`scripts/lib/`:

- `fake-i18n.js` — `lng()`, `exists(key)` and `addResourceBundle(lng, ns, res)`.
  `exists` walks the fallback chain (`de-AT` → `de` → `dev`). `addResourceBundle` extends
  a flat per-language store, as i18next 1.7.1 does. `bundles` records every call. `t(key)`
  reads the store back the way `loc()` would. `without: ["exists"]` drops a method, to
  assert the missing-engine path.
- `fake-xhr.js` — `XMLHttpRequest` over a `url -> { status, text } | { throws }` table.
  An unrouted URL is a 404 with an empty body, so a fixture cannot drift from what the
  code asks for. `XMLHttpRequest.requests` records `{ url, async }` per request. That is
  how the tests pin the synchronous read.
- `scene-loader.js` — also exports `fakeConsole`. The console keeps only the first
  argument per line, as PA's log does.

## Conventions

- A test file is named for the shipped file it loads. `modinfo.test.js` covers the
  manifest and release metadata.
- New or changed logic gets a test in the same file.
- Genuinely untestable code goes into `sonar.coverage.exclusions` with a rationale,
  never into an assertionless test. Today nothing shipped is excluded.

## What tests cannot cover

Nothing here starts PA. Each fake encodes an assumption about the engine that only the
game can confirm:

- whether `coui://` answers a missing file with a 404, a status 0, or a throw
- whether `addResourceBundle` really lands in the store `loc()` reads
- whether a `global_mod_list` script runs before every consumer in every panel

The verification list at the end of [design.md](design.md) is that check.
