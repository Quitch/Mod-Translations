# CHANGELOG

## Unreleased

- A `root` option passed to `register` must now be a `coui://` URL. Any other value, such as a path or a number, is refused with a console error
- A mod can pass `languages` to `register` to name the translation files it ships, so the files it does not ship are no longer requested and no longer log an error on the CEF UI

## v1.1.0 - 2026-10-17

- A `root` option passed to `register` no longer needs a trailing slash
- A `root` option with a scheme other than `coui://`, such as `http://`, is now refused with a console error instead of being read

## v1.0.0 - 2026-09-09

- Initial release: a mod that registers with Mod Translations has its text shown in your language, and its translation replaces the game's own where both exist
