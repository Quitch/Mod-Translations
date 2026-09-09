# Mod Translations

Planetary Annihilation loads its translations natively, before any mod script runs, from
the game's own locale folder. A mod cannot add a file there without replacing one of the
game's, so no mod ships translations today: a mod's text is either English or whatever a
past game patch happened to bundle for it.

Mod Translations is a client mod that lets any mod ship its own translation files and have
the game's stock `loc()` show them. Where the mod's file and the game's tables both have an
entry, the mod's text is shown, so a shipped translation can be corrected by the community
without waiting for a game patch.

## For players

Enable it alongside a mod that uses it. Your language is whatever the game's Settings has.
If a mod has no file for your language, its text stays in English, as before. Mod
Translations does nothing on its own.

## For mod authors

1. Put one JSON file per language at `ui/mods/<your mod id>/translations/<lang>.json`,
   where `<lang>` is a folder name from the game's `ui/main/_i18n/locales/` (`de`, `fr`,
   `zh-CN`, ...). The file has the same shape as the game's own tables, so it can be handed
   to the game's maintainers unchanged:

   ```json
   {
     "Lucky Commander": { "message": "Glückspilz-Kommandant" },
     "Reroll Tech": { "message": "Tech neu würfeln" }
   }
   ```

   The key is the English text exactly as it appears after `!LOC:` in your source. An
   `en-US.json` is a good place for a catalogue of every key with a `description` for
   translators. It is never loaded: English keys are the source text, so English wording
   changes in your code, not in a file.

2. Register once per scene, at the top of each scene's first script:

   ```js
   if (window.ModTranslations) {
     window.ModTranslations.register("<your mod id>");
   }
   ```

   `register` reads the file for the player's locale and then its base language (`de-AT`,
   then `de`), merges them into the game's translation store, and returns
   `{ id, language, languages, added, replaced, invalid, ok }`. A second call in the same
   scene returns the cached result. Pass `{ root: "coui://..." }` as a second argument if
   your files live elsewhere. The guard keeps your mod working when Mod Translations is not
   installed; your text is then English.

3. Rules the loader applies: an entry needs a non-empty string `message`; a key containing
   `;;` or `::` can never resolve and is skipped; an entry in the exact-locale file beats
   the base-language file; a key your file shares with the game's tables takes your text.
   English locales load nothing.

4. Add Mod Translations to your `modinfo.json` `dependencies` so Community Mods installs
   it with your mod, and give your mod a `priority` above 50. Community Mods loads mods in
   ascending `priority` order (the default is 100) and Mod Translations uses 50, so a
   lower or equal value can run your scene script before `window.ModTranslations` exists
   and your text stays in English.

### When two mods translate the same key

The last mod to register a key wins. Each `register` call writes its entries over whatever
is already in the game's translation store, so a key that two mods both ship ends up with
the text of the mod that registered later. The register order in a scene is the order
Community Mods runs the scene scripts, which is ascending `priority`: a mod with a higher
`priority` number registers later and takes the key. The result's `replaced` count includes
keys taken from other mods as well as from the game's tables.

To make sure your text is the one shown:

- Give your mod a higher `priority` than the mod you need to beat. Two mods on the same
  number are ordered by Community Mods, not by you, so pick a distinct value.
- Register in every scene where the key is shown. A mod that registers only in
  `live_game` cannot override a key in `new_game`, whatever its priority.
- Only ship keys you mean to override. A shared key is usually a shared English string such
  as a unit name; if both mods translate it the same way the order does not matter, and if
  they differ the higher-priority mod's reading wins everywhere the key appears, including
  in the other mod's text.

See [docs/design.md](docs/design.md) for the mechanism and what it cannot do.

## Requirements

- Planetary Annihilation: TITANS
- Community Mods

## Licence

[MIT](LICENSE)
