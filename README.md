# Mod Translations

Planetary Annihilation loads its translations natively, from the game's own locale folder,
before any mod script runs. A mod cannot add a file there without replacing one of the
game's files. So no mod ships translations today. A mod's text is either English or
whatever a past game patch happened to bundle for it.

Mod Translations is a client mod. It lets any mod ship its own translation files, and the
game's stock `loc()` shows them. Where the mod's file and the game's tables both have an
entry, the game shows the mod's text. So the community can correct a shipped translation
without waiting for a game patch.

## For players

Enable it alongside a mod that uses it. Your language is the one set in the game's
Settings. If a mod has no file for your language, its text stays in English, as before.
Mod Translations does nothing on its own.

## For mod authors

1. Put one JSON file per language at `ui/mods/<your mod id>/translations/<lang>.json`.
   `<lang>` is a folder name from the game's `ui/main/_i18n/locales/` (`de`, `fr`,
   `zh-CN`, ...). The file has the same shape as the game's own tables, so you can hand it
   to the game's maintainers unchanged:

   ```json
   {
     "Lucky Commander": { "message": "Glückspilz-Kommandant" },
     "Reroll Tech": { "message": "Tech neu würfeln" }
   }
   ```

   The key is the English text exactly as it appears after `!LOC:` in your source. An
   `en-US.json` is a good place for a catalogue of every key with a `description` for
   translators. The loader never reads it. English keys are the source text, so English
   wording changes in your code, not in a file.

2. Ship one small script that registers your mod:

   ```js
   if (window.ModTranslations) {
     window.ModTranslations.register("<your mod id>");
   }
   ```

   List it under `scenes.global_mod_list` in your `modinfo.json`, and in no scene list:

   ```json
   "scenes": {
     "global_mod_list": ["coui://ui/mods/<your mod id>/translations.js"]
   }
   ```

   A `global_mod_list` script runs on every page before the game's own scene code. That
   is the only place early enough. Before any scene-list script runs, the game translates
   its static HTML, builds its scene model, and caches some `loc()` results. A
   registration from a scene list therefore leaves the text the game translated first in
   English. That includes any of the game's own strings your file corrects.

   `register` reads the file for the player's locale and then the file for its base
   language (`de-AT`, then `de`). It merges them into the game's translation store and
   returns `{ id, language, languages, added, replaced, invalid, ok }`. A second call on
   the same page returns the cached result. Pass `{ root: "coui://..." }` as a second
   argument if your files live elsewhere. The guard keeps your mod working when Mod
   Translations is not installed. Your text is then English.

3. The loader applies these rules:

   - An entry needs a non-empty string `message`.
   - A key that contains `;;` or `::` can never resolve, so the loader skips it.
   - An entry in the exact-locale file beats the base-language file.
   - A key your file shares with the game's tables takes your text.
   - English locales load nothing.

4. Add Mod Translations to your `modinfo.json` `dependencies`, so Community Mods installs
   it with your mod. Give your mod a `priority` above 50. Community Mods loads mods in
   ascending `priority` order (the default is 100), and Mod Translations uses 50. With a
   lower or equal value, your global script can run before `window.ModTranslations`
   exists, and your text stays in English.

### When two mods translate the same key

The last mod to register a key wins. Each `register` call writes its entries over whatever
is already in the game's translation store. So a key that two mods both ship ends up with
the text of the mod that registered later. The register order is the `global_mod_list`
order, which is how Community Mods sorts mods: ascending `priority`. A mod with a higher
`priority` number registers later and takes the key. The result's `replaced` count includes
keys taken from other mods as well as from the game's tables.

To make sure the game shows your text:

- Give your mod a higher `priority` than the mod you need to beat. Community Mods orders
  two mods on the same number, not you, so pick a distinct value.
- Only ship keys you mean to override. A shared key is usually a shared English string,
  such as a unit name. If both mods translate it the same way, the order does not matter.
  If they differ, the higher-priority mod's reading wins everywhere the key appears,
  including in the other mod's text.

See [docs/design.md](docs/design.md) for the mechanism and what it cannot do.

## Requirements

- Planetary Annihilation: TITANS
- Community Mods

## Licence

[MIT](LICENSE)
