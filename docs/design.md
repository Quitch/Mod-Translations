# Design

## Why a mod cannot ship translations on its own

`loc("!LOC:text")` looks the English text up in i18next (`ui/main/shared/js/localization.js`)
and returns the key when nothing is found, so English always survives. The tables it looks
in are loaded **natively**, before any JS runs: every `*.json` under
`ui/main/_i18n/locales/<lang>/` is merged into one flat map per language and handed to
i18next as `i18n_data.strings`. A client mod that ships a file at one of those paths
shadows the same-named stock table wholesale, taking the game's own strings with it. So the
only translations a mod has are the ones a game patch happened to bundle for it, and those
cannot be corrected from outside.

## Mechanism

`translations.js` runs from `global_mod_list`, and a consumer calls
`window.ModTranslations.register("<id>")` once per page, from a `global_mod_list`
script of its own. The call:

1. Reads `i18n.lng()` and builds the fallback chain the same way i18next does:
   `"de-AT"` gives `["de-AT", "de"]`, `"fr"` gives `["fr"]`.
2. For each entry in the chain, unless the chain ends in English, reads
   `coui://ui/mods/<id>/translations/<lang>.json` with a synchronous XHR.
3. Collects `{ key: message }` from every file that parsed, with the more specific file
   winning a shared key.
4. Calls `i18n.addResourceBundle(lng, "translation", additions)`, which **extends** the
   flat map the native tables were loaded into, overwriting existing keys.

Stock `loc()`, `locTree()`, `<loc>` tags and the `tooltip` knockout binding all read that
map, so the consumer's strings resolve everywhere without the consumer changing a call.

### Boot order

`boot_suffix.js` runs `locInit()` before `loadMods(global_mod_list)`; scene mod scripts
load after; `locUpdateDocument()` runs at `document.ready`. A `global_mod_list` script
therefore sees an initialised i18next and runs before every consumer. Mutating `i18n_data`
at that point does nothing: i18next copied it during `locInit`, which is why the bundle
goes through i18next's own API.

The consumer's registration has to come from `global_mod_list` as well. Two stock
readers of the store run before any scene-list script: `locUpdateDocument()` translates
the static HTML, `<loc>` tags and knockout templates at `document.ready`, and the stock
scene's model constructor calls `loc()` eagerly and caches the result in plain
`ko.computed`s and one-time assignments (`gw_play.js` does this for every star's
description). Text translated there keeps whatever the store held at the time, so a
consumer that registered from a scene list saw its own HTML and scripts translated, while
a stock string it corrected, or a stock template showing one of its keys, stayed on the
game's text or in English for the life of the page. Observed 2026-09-09 on `gw_play` in
zh-CN: the consumer's bundle landed about 430 ms after the star descriptions were built.
A registration from `global_mod_list` precedes both readers.

Community Mods sorts mods by `priority` ascending (default 100) and injects
`ui_mod_list.js` into every panel, so this script runs once per page in every scene and
sub-panel. A `global_mod_list` script is never also in a scene list, and the server-mod
merge is a union, so nothing loads it twice on one page; no double-load guard exists and
none is needed. `modinfo.json` sets `priority` 50 so it runs before any consumer that keeps
the default. Consumers register from the same list, in the same ascending order, so the
"last registration wins" rule across mods follows `priority` directly.

### Why synchronous

The consumer's scene scripts call `loc()` in the same tick as `register()`, from their own
top-level code and from knockout templates bound at `document.ready`. An asynchronous read
would land after most of the page had rendered in English. `helpers.js` `loadScript` uses a
synchronous XHR on `coui://` for the game's own mod scripts and treats
`status > 200 && != 304` as failure; the same read and the same test are used here.

## File contract

`ui/mods/<id>/translations/<lang>.json`, inside the consumer's own namespace so the id in
the path is the string passed to `register()` and nothing is shared between mods.
`register(id, { root })` accepts another `coui://` prefix for a mod that keeps its files
elsewhere.

The shape is PA's own, `{ "English key": { "message": "…" } }`, so a file can be given
to the game's maintainers unchanged. Extra properties such as `description` are ignored by
the loader. An entry is skipped and counted `invalid` when its `message` is not a non-empty
string, or its key is empty or contains `;;` or `::` (i18next's namespace and key
separators; such a key can never resolve).

`en-US.json` is the natural catalogue: every key with a translator note. It is never
loaded. English keys are the source text, so English wording changes in the consumer's
code, and the catalogue is the largest file, which every English-locale player would pay
for in every scene for no effect. The rejected alternative was loading it so a mod could
"correct" its English through the file; that hides the real wording from the source and
from every other translator.

## Override semantics

The mod's entry replaces PA's. `addResourceBundle` extends the store, and `i18n.exists`
is consulted only to count `replaced` for the log line. The point is that the community
can fix a shipped translation without waiting for a game patch; the cost is that a stale
mod entry can mask a later improvement in the game's own table, so a consumer should keep
a list of its overrides and review it each release.

Across mods, a later registration overwrites an earlier one for the same key. Both carry
the same English text, so either is acceptable.

## Cost

The framework script is about 4 KB and runs in every panel. A registration is one or two
synchronous reads of the consumer's files (tens of KB for a large mod) on every panel,
including the uberbar and the live-game sub-panels; English locales read nothing. The two
icon-atlas panels boot with `i18n.lng()` equal to `en` whatever the setting (observed
2026-09-09), so they fetch the consumer's script and read no file. Measured 2026-09-09 with
a 27 KB zh-CN file on the game panel: the script fetch is about 15 ms and the file read
about 15 ms, both inside the global `loadMods` window, which grew from about 30 ms to about
75 ms; the same work left the scene list, so the page's total did not change. A consumer cannot reduce that by registering in fewer scenes, since a scene-list
registration is too late (see "Boot order"). If the reads show in a page's timing, the
lever is the file: keep it to the keys the stock code needs early and ship the rest
another way, which is a consumer decision, not a framework change.

## Failure table

| Situation                                                      | Behaviour                                                             |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| Bad `id` (not a non-empty string)                              | `console.error`, `{ ok: false }`, nothing cached                      |
| `i18n` absent or missing `lng`/`exists`/`addResourceBundle`    | `console.error` naming the id, `{ ok: false }`, nothing cached        |
| `i18n.lng()` not a string                                      | `ok: true`, nothing requested                                         |
| English locale (`en`, `en-US`)                                 | `ok: true`, nothing requested, `languages: []`                        |
| File missing (404, status 0 with empty body, or thrown `send`) | Skipped silently                                                      |
| File is not valid JSON                                         | One `console.error` naming the URL; the rest of the chain still loads |
| File is JSON but not an object                                 | One `console.error` naming the URL; language not listed               |
| Entry invalid                                                  | Counted in `invalid`, not added                                       |
| Same id registered twice on one page                           | Cached result returned, no request                                    |

`register` never throws. Each registration logs one line, a single string because PA's log
keeps only the first console argument:
`[ModTranslations] <id> <lng> {"languages":[…],"added":n,"replaced":n,"invalid":n}`.

## What it cannot do

- Translate a mod that does not use `!LOC:` keys. Only text that goes through `loc()` or
  the `<loc>` / `tooltip` paths resolves.
- Change the locale list. `<lang>` must be a folder PA ships under `_i18n/locales/`.
- Load anything asynchronously, or after the scene rendered.
- Reach a page that has no `global_mod_list` injection.

## In-game verification

Nothing here starts PA. These are the checks a change to `translations.js` needs, with a
consumer mod enabled from `client_mods`:

1. Settings → Language → a non-English locale (or `localStorage.locale = '"de"'` over
   CDP). The consumer's text is translated **and** the game's own labels on the same
   screen are still translated. The log shows one `[ModTranslations]` line per page
   (every panel, not only the consumer's scenes), ahead of the scene's own scripts, with
   the expected `added`; no `LOCEXCEPTION!`, no console errors.
2. Add one entry to the consumer's file for a key PA already ships and confirm the mod's
   text shows and `replaced` counts 1; remove it afterwards. Pick a key the stock scene
   translates before any scene script runs (a `<loc>` tag in the stock HTML, or a value
   the stock model caches at construction), since that is the case a scene-list
   registration cannot reach.
3. A regional locale (`de-AT`): `ModTranslations.languages()` returns the chain and
   the registration's `languages` lists only the files that exist (`["de"]`).
4. English: `languages: []`, no request, text identical to before.
5. Mod Translations disabled: the consumer works with English text and no error.
6. Grep the PA log directory for `LOCEXCEPTION` and `ModTranslations`.

A missing file on `coui://` comes back as HTTP 404 with a one-byte body (observed
2026-09-09 requesting `de-AT.json`; a present file returns 200). The other two shapes
stay handled in case another engine build differs.
