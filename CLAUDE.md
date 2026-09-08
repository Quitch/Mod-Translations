# CLAUDE.md

## What this is

Mod Translations is a client mod for Planetary Annihilation: TITANS that lets other mods
ship their own translation files and have the game's stock `loc()` show them. It ships one
plain JS file loaded by the game's embedded Chrome 40 from `global_mod_list` — no build
step, only lint.

The base game install (a `media` folder under Steam's `.../Planetary Annihilation
Titans/`) is not part of this repo and lives at a different path on every machine. If it
is set up as an additional workspace root it will appear in the "Additional working
directories" list, and its own `CLAUDE.md` identifies it. Treat it as read-only
reference. Never edit anything there.

## Architecture

[`docs/design.md`](docs/design.md) is the single design document: why a mod cannot ship
translations on its own, the boot order that makes a `global_mod_list` script the right
place, the file contract, the mod-wins override rule, the failure table, and what cannot
be done from a client mod. Read it before changing anything.

The facts that shape the code:

- **The read is synchronous on purpose.** Consumers call `loc()` in the same tick as
  `register()`. An async read would land after the page rendered in English.
- **`addResourceBundle` is the only way in.** `i18n_data` is already copied by the time
  any mod script runs; mutating it does nothing.
- **English loads nothing.** English keys are the source text; the `en-US.json` catalogue
  is for translators and is never read by the loader.

## Constraints

Shipped `ui/**` must be ES5 / Chrome 40 safe: no `let`, arrow functions, template
literals or `class`. A parse error takes out the whole script, not the line.
`eslint.config.mjs` is the whitelist and is exhaustive — no entry means no. lodash is
3.9.3, so v4 names are absent.

## Comments

The code carries comments only where the code itself cannot explain something: base-game
or engine behaviour, a bug workaround, a dependency outside the mod, or a counter-intuitive
ordering. Past a line or two, a comment is documentation and belongs in
[`docs/design.md`](docs/design.md) instead; where that doc already covers the fact, the
comment is `See design.md.` and nothing more.

Verify a comment against the code before writing it. Every path, filename and identifier
it names must exist, and the claim must match the lines beside it — a confidently wrong
comment is worse than none.

Rejected alternatives and tuning history belong in the commit message. A comment states
the rule that holds now.

Never removed, because they are not prose: `eslint-disable` and `prettier-ignore`
directives.

## Verifying a change

`npm run verify` is the pre-submit gate: `lint:js`, `lint:md`, `format:check`,
`validate:json`, `test`. `npm run test:coverage` adds the coverage report and fails
under 80% lines; keep the shipped file measured rather than excluding it. The harness
runs it against faked engine globals — see [`docs/testing.md`](docs/testing.md).

Nothing here starts PA, and `verify` cannot catch what this mod actually does against the
real engine. Every behavioural claim needs the game loaded with a consumer mod enabled —
see the verification list at the end of [`docs/design.md`](docs/design.md). The PA log
directory under `%LOCALAPPDATA%\Uber Entertainment\Planetary Annihilation\log\` holds
the `[ModTranslations]` lines and any `LOCEXCEPTION!`.

## Release

`CHANGELOG.md` keeps an `## Unreleased` heading while work is in progress; a
`## v<version> - <date>` heading replaces it at release, and `test/modinfo.test.js`
accepts either. The working copy's identifier is `com.pa.quitch.modtranslations-dev`; the
`coui://` path and the `window.ModTranslations` global use the bare id, so the released
identifier is the bare id too.
