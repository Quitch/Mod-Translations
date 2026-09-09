# Design

## Why a mod cannot ship translations on its own

`loc("!LOC:text")` looks the English text up in i18next (`ui/main/shared/js/localization.js`).
It returns the key when it finds nothing, so English always survives. The tables it looks
in load **natively**, before any JS runs. The engine merges every `*.json` under
`ui/main/_i18n/locales/<lang>/` into one flat map per language and hands it to i18next as
`i18n_data.strings`. A client mod that ships a file at one of those paths shadows the
same-named stock table wholesale, and takes the game's own strings with it. So the only
translations a mod has are the ones a game patch happened to bundle for it, and nobody can
correct those from outside.

## Mechanism

`translations.js` runs from `global_mod_list`. A consumer calls
`window.ModTranslations.register("<id>")` once per page, from a `global_mod_list`
script of its own. The call:

1. Reads `i18n.lng()` and builds the fallback chain the same way i18next does:
   `"de-AT"` gives `["de-AT", "de"]`, `"fr"` gives `["fr"]`.
2. Reads `coui://ui/mods/<id>/translations/<lang>.json` with a synchronous XHR for each
   entry in the chain, unless the chain ends in English.
3. Collects `{ key: message }` from every file that parsed. The more specific file wins a
   shared key.
4. Calls `i18n.addResourceBundle(lng, "translation", additions)`. This **extends** the
   flat map that the native tables loaded into, and overwrites existing keys.

Stock `loc()`, `locTree()`, `<loc>` tags and the `tooltip` knockout binding all read that
map. So the consumer's strings resolve everywhere, and the consumer changes no call.

### Boot order

`boot_suffix.js` runs `locInit()` before `loadMods(global_mod_list)`. Scene mod scripts
load after that. `locUpdateDocument()` runs at `document.ready`. A `global_mod_list`
script therefore sees an initialised i18next and runs before every consumer. Mutating
`i18n_data` at that point does nothing, because i18next copied it during `locInit`. That
is why the bundle goes through i18next's own API.

The consumer's registration also has to come from `global_mod_list`. Two stock readers of
the store run before any scene-list script:

- `locUpdateDocument()` translates the static HTML, `<loc>` tags and knockout templates
  at `document.ready`.
- The stock scene's model constructor calls `loc()` eagerly and caches the result in
  plain `ko.computed`s and one-time assignments. `gw_play.js` does this for every star's
  description.

Text translated there keeps whatever the store held at the time. So a consumer that
registered from a scene list saw its own HTML and scripts translated. But a stock string
it corrected, or a stock template that shows one of its keys, stayed on the game's text or
in English for the life of the page. Observed 2026-09-09 on `gw_play` in zh-CN: the
consumer's bundle landed about 430 ms after the star descriptions were built. A
registration from `global_mod_list` precedes both readers.

Community Mods sorts mods by `priority` ascending (default 100) and injects
`ui_mod_list.js` into every panel. So this script runs once per page in every scene and
sub-panel. A `global_mod_list` script is never also in a scene list, and the server-mod
merge is a union, so nothing loads it twice on one page. No double-load guard exists, and
none is needed. `modinfo.json` sets `priority` 50, so the script runs before any consumer
that keeps the default. Consumers register from the same list, in the same ascending
order. So the "last registration wins" rule across mods follows `priority` directly.

### Why synchronous

The consumer's scene scripts call `loc()` in the same tick as `register()`, from their own
top-level code and from knockout templates bound at `document.ready`. An asynchronous read
would land after most of the page had rendered in English. `helpers.js` `loadScript` uses
a synchronous XHR on `coui://` for the game's own mod scripts, and treats
`status > 200 && != 304` as failure. This mod uses the same read and the same test.

## File contract

The files live at `ui/mods/<id>/translations/<lang>.json`, inside the consumer's own
namespace. So the id in the path is the string passed to `register()`, and mods share
nothing. `register(id, { root })` accepts another `coui://` prefix for a mod that keeps
its files elsewhere.

The shape is PA's own, `{ "English key": { "message": "…" } }`, so a consumer can give a
file to the game's maintainers unchanged. The loader ignores extra properties such as
`description`. The loader skips an entry and counts it `invalid` when its `message` is
not a non-empty string, or its key is empty or contains `;;` or `::`. Those are i18next's
namespace and key separators, so such a key can never resolve.

`en-US.json` is the natural catalogue: every key with a translator note. The loader never
reads it. English keys are the source text, so English wording changes in the consumer's
code. The catalogue is also the largest file, and every English-locale player would pay
for it in every scene for no effect. The rejected alternative was to load it so a mod
could "correct" its English through the file. That hides the real wording from the source
and from every other translator.

## Override semantics

The mod's entry replaces PA's. `addResourceBundle` extends the store. The loader consults
`i18n.exists` only to count `replaced` for the log line. The point is that the community
can fix a shipped translation without waiting for a game patch. The cost is that a stale
mod entry can mask a later improvement in the game's own table. So a consumer should keep
a list of its overrides and review it each release.

Across mods, a later registration overwrites an earlier one for the same key. Both carry
the same English text, so either is acceptable.

## Cost

The framework script is about 4 KB and runs in every panel. A registration is one or two
synchronous reads of the consumer's files on every panel, including the uberbar and the
live-game sub-panels. A large mod's files are tens of KB. English locales read nothing.
The two icon-atlas panels boot with `i18n.lng()` equal to `en` whatever the setting
(observed 2026-09-09), so they fetch the consumer's script and read no file.

Measured 2026-09-09 with a 27 KB zh-CN file on the game panel: the script fetch is about
15 ms and the file read about 15 ms. Both sit inside the global `loadMods` window, which
grew from about 30 ms to about 75 ms. The same work left the scene list, so the page's
total did not change. A consumer cannot reduce that by registering in fewer scenes, since
a scene-list registration is too late (see "Boot order"). If the reads show in a page's
timing, the lever is the file. Keep it to the keys the stock code needs early, and ship
the rest another way. That is a consumer decision, not a framework change.

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

`register` never throws. Each registration logs one line, as a single string, because
PA's log keeps only the first console argument:
`[ModTranslations] <id> <lng> {"languages":[…],"added":n,"replaced":n,"invalid":n}`.

## What it cannot do

- Translate a mod that does not use `!LOC:` keys. Only text that goes through `loc()` or
  the `<loc>` / `tooltip` paths resolves.
- Change the locale list. `<lang>` must be a folder PA ships under `_i18n/locales/`.
- Load anything asynchronously, or after the scene rendered.
- Reach a page that has no `global_mod_list` injection.

## In-game verification

Nothing here starts PA. A change to `translations.js` needs these checks, with a consumer
mod enabled from `client_mods`:

1. Set Settings → Language to a non-English locale (or set `localStorage.locale = '"de"'`
   over CDP). The consumer's text is translated **and** the game's own labels on the
   same screen are still translated. The log shows one `[ModTranslations]` line per page
   (every panel, not only the consumer's scenes), ahead of the scene's own scripts, with
   the expected `added`. There is no `LOCEXCEPTION!` and no console error.
2. Add one entry to the consumer's file for a key PA already ships. Confirm that the
   mod's text shows and `replaced` counts 1. Remove the entry afterwards. Pick a key the
   stock scene translates before any scene script runs (a `<loc>` tag in the stock HTML,
   or a value the stock model caches at construction). That is the case a scene-list
   registration cannot reach.
3. Use a regional locale (`de-AT`). `ModTranslations.languages()` returns the chain, and
   the registration's `languages` lists only the files that exist (`["de"]`).
4. Use English. `languages` is `[]`, there is no request, and the text is identical to
   before.
5. Disable Mod Translations. The consumer works with English text and no error.
6. Grep the PA log directory for `LOCEXCEPTION` and `ModTranslations`.

A missing file on `coui://` comes back as HTTP 404 with a one-byte body, and a present
file returns 200 (observed 2026-09-09 requesting `de-AT.json`). The loader still handles
the other two shapes in case another engine build differs.
