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
   the base-language file; a key your file shares with the game's tables, or with another
   mod registered earlier, takes your text. English locales load nothing.

4. Once Mod Translations is on the community mod index, list it in your `modinfo.json`
   `dependencies` so Community Mods installs it with your mod.

See [docs/design.md](docs/design.md) for the mechanism and what it cannot do.

## Requirements

- Planetary Annihilation: TITANS
- Community Mods

## Licence

[CC BY 4.0](LICENSE)
