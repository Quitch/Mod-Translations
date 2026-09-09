"use strict";

// translations.js: what register() loads, in what order, into which i18next
// bucket, and every way a file or the engine can be missing without a throw.

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { createContext, loadScene } = require("../scripts/lib/scene-loader.js");
const { fakeI18n } = require("../scripts/lib/fake-i18n.js");
const { fakeXhr, json } = require("../scripts/lib/fake-xhr.js");

const ID = "com.example.mod";
const ABSENT = undefined;
const ROOT = "coui://ui/mods/" + ID + "/translations/";

function entries(map) {
  const out = {};
  Object.keys(map).forEach((key) => {
    out[key] = { message: map[key] };
  });
  return out;
}

function page(options) {
  const opts = options || {};
  // `i18n: ABSENT` leaves the global out; `null` puts a null there.
  const i18n = Object.hasOwn(opts, "i18n")
    ? opts.i18n
    : fakeI18n({ lng: opts.lng, store: opts.store, without: opts.without });
  const XMLHttpRequest = fakeXhr(opts.routes);
  const ctx = createContext({ i18n: i18n, XMLHttpRequest: XMLHttpRequest });
  loadScene(ctx, "global_mod_list");
  return {
    ctx: ctx,
    i18n: i18n,
    requests: XMLHttpRequest.requests,
    console: ctx.console.lines,
    api: ctx.ModTranslations,
  };
}

describe("register", () => {
  it("requests the exact locale then its base, synchronously, from the mod's own folder", () => {
    const fixture = page({
      lng: "de-AT",
      routes: {
        [ROOT + "de-AT.json"]: json(entries({ Colour: "Farbe (AT)" })),
        [ROOT + "de.json"]: json(entries({ Colour: "Farbe", Mods: "Mods" })),
      },
    });

    const result = fixture.api.register(ID);

    assert.deepEqual(fixture.requests, [
      { url: ROOT + "de-AT.json", async: false },
      { url: ROOT + "de.json", async: false },
    ]);
    assert.deepEqual(result.languages, ["de-AT", "de"]);
    assert.equal(result.ok, true);
  });

  it("reads from options.root when given", () => {
    const fixture = page({
      lng: "fr",
      routes: {
        "coui://ui/mods/elsewhere/fr.json": json(entries({ Mods: "Mods" })),
      },
    });

    const result = fixture.api.register(ID, {
      root: "coui://ui/mods/elsewhere/",
    });

    assert.deepEqual(fixture.requests, [
      { url: "coui://ui/mods/elsewhere/fr.json", async: false },
    ]);
    assert.equal(result.added, 1);
  });

  it("adds the missing trailing slash to options.root", () => {
    const fixture = page({
      lng: "fr",
      routes: {
        "coui://ui/mods/elsewhere/loc/fr.json": json(entries({ Mods: "Mods" })),
      },
    });

    const result = fixture.api.register(ID, {
      root: "coui://ui/mods/elsewhere/loc",
    });

    assert.deepEqual(fixture.requests, [
      { url: "coui://ui/mods/elsewhere/loc/fr.json", async: false },
    ]);
    assert.equal(result.added, 1);
  });

  it("adds every valid key as a flat string in the current locale, replacing the game's own", () => {
    const fixture = page({
      lng: "de",
      store: { de: { Commander: "Kommandant (PA)" } },
      routes: {
        [ROOT + "de.json"]: json(
          entries({ Commander: "Kommandant", "Lucky Commander": "Glückspilz" })
        ),
      },
    });

    const result = fixture.api.register(ID);

    assert.deepEqual(fixture.i18n.bundles, [
      {
        lng: "de",
        ns: "translation",
        res: { Commander: "Kommandant", "Lucky Commander": "Glückspilz" },
      },
    ]);
    assert.equal(fixture.i18n.t("Commander"), "Kommandant");
    assert.equal(result.added, 2);
    assert.equal(result.replaced, 1);
    assert.equal(result.invalid, 0);
    assert.deepEqual(result.languages, ["de"]);
  });

  it("lets the exact-locale entry beat the base entry for a shared key", () => {
    const fixture = page({
      lng: "de-AT",
      routes: {
        [ROOT + "de-AT.json"]: json(entries({ January: "Jänner" })),
        [ROOT + "de.json"]: json(entries({ January: "Januar", Mods: "Mods" })),
      },
    });

    const result = fixture.api.register(ID);

    assert.equal(fixture.i18n.bundles.length, 1);
    assert.equal(fixture.i18n.bundles[0].lng, "de-AT");
    assert.deepEqual(fixture.i18n.bundles[0].res, {
      January: "Jänner",
      Mods: "Mods",
    });
    assert.equal(result.added, 2);
  });

  it("treats a 404, a status 0 with an empty body, and a thrown send as no file", () => {
    for (const route of [
      undefined,
      { status: 0, text: "" },
      { throws: "coui:// refused" },
    ]) {
      const fixture = page({
        lng: "fr",
        routes: route ? { [ROOT + "fr.json"]: route } : {},
      });

      const result = fixture.api.register(ID);

      assert.deepEqual(fixture.i18n.bundles, []);
      assert.deepEqual(fixture.console.error, []);
      assert.deepEqual(result.languages, []);
      assert.equal(result.ok, true);
    }
  });

  it("reports malformed JSON once, naming the file, and still loads the rest of the chain", () => {
    const fixture = page({
      lng: "de-AT",
      routes: {
        [ROOT + "de-AT.json"]: { status: 200, text: "{ not json" },
        [ROOT + "de.json"]: json(entries({ Mods: "Mods" })),
      },
    });

    const result = fixture.api.register(ID);

    assert.equal(fixture.console.error.length, 1);
    assert.match(fixture.console.error[0], /de-AT\.json/);
    assert.deepEqual(result.languages, ["de"]);
    assert.equal(result.added, 1);
    assert.equal(result.ok, true);
  });

  it("rejects a file whose JSON is not an object", () => {
    for (const body of [[{ message: "x" }], '"text"', "42"]) {
      const fixture = page({
        lng: "fr",
        routes: {
          [ROOT + "fr.json"]: {
            status: 200,
            text: typeof body === "string" ? body : JSON.stringify(body),
          },
        },
      });

      const result = fixture.api.register(ID);

      assert.equal(fixture.console.error.length, 1);
      assert.match(fixture.console.error[0], /fr\.json/);
      assert.deepEqual(result.languages, []);
      assert.deepEqual(fixture.i18n.bundles, []);
    }
  });

  it("counts entries without a string message and keys with separators as invalid", () => {
    const fixture = page({
      lng: "fr",
      routes: {
        [ROOT + "fr.json"]: json({
          Good: { message: "Bon" },
          NoMessage: { description: "x" },
          Empty: { message: "" },
          Numeric: { message: 3 },
          Null: null,
          "ns;;key": { message: "a" },
          "a::b": { message: "b" },
          "": { message: "c" },
        }),
      },
    });

    const result = fixture.api.register(ID);

    assert.equal(result.added, 1);
    assert.equal(result.invalid, 7);
    assert.deepEqual(fixture.i18n.bundles[0].res, { Good: "Bon" });
    assert.deepEqual(fixture.console.error, []);
  });

  it("loads nothing for English", () => {
    for (const lng of ["en-US", "en"]) {
      const fixture = page({
        lng: lng,
        routes: { [ROOT + lng + ".json"]: json(entries({ Mods: "Mods" })) },
      });

      const result = fixture.api.register(ID);

      assert.deepEqual(fixture.requests, []);
      assert.deepEqual(fixture.i18n.bundles, []);
      assert.deepEqual(result.languages, []);
      assert.equal(result.language, lng);
      assert.equal(result.ok, true);
    }
  });

  it("returns the cached result on a second call without another request", () => {
    const fixture = page({
      lng: "fr",
      routes: { [ROOT + "fr.json"]: json(entries({ Mods: "Mods" })) },
    });

    const first = fixture.api.register(ID);
    const second = fixture.api.register(ID);

    assert.equal(second, first);
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.i18n.bundles.length, 1);
    assert.equal(fixture.console.log.length, 1);
  });

  it("lets the later of two mods sharing a key win, counted as replaced", () => {
    const other = "com.example.other";
    const otherRoot = "coui://ui/mods/" + other + "/translations/";
    const fixture = page({
      lng: "fr",
      routes: {
        [ROOT + "fr.json"]: json(entries({ Mods: "Mods (first)" })),
        [otherRoot + "fr.json"]: json(entries({ Mods: "Mods (second)" })),
      },
    });

    const first = fixture.api.register(ID);
    const second = fixture.api.register(other);

    assert.equal(first.replaced, 0);
    assert.equal(second.replaced, 1);
    assert.equal(fixture.i18n.t("Mods"), "Mods (second)");
  });

  it("refuses a bad id without caching it", () => {
    const fixture = page({ lng: "fr" });

    for (const id of [undefined, null, "", 42, {}]) {
      const result = fixture.api.register(id);
      assert.deepEqual(result, { ok: false });
    }

    assert.equal(fixture.console.error.length, 5);
    assert.deepEqual(fixture.api.registered(), {});
    assert.deepEqual(fixture.requests, []);
  });

  it("refuses when i18n is absent or incomplete, without caching or throwing", () => {
    const shapes = [
      { i18n: ABSENT },
      { i18n: null },
      { without: ["lng"] },
      { without: ["exists"] },
      { without: ["addResourceBundle"] },
    ];

    for (const shape of shapes) {
      const fixture = page(
        Object.assign(
          {
            lng: "fr",
            routes: { [ROOT + "fr.json"]: json(entries({ Mods: "Mods" })) },
          },
          shape
        )
      );

      const result = fixture.api.register(ID);

      assert.deepEqual(result, { ok: false });
      assert.equal(fixture.console.error.length, 1);
      assert.match(fixture.console.error[0], new RegExp(ID));
      assert.deepEqual(fixture.api.registered(), {});
      assert.deepEqual(fixture.requests, []);
    }
  });

  it("loads nothing when lng() is undefined", () => {
    const fixture = page({ lng: undefined });

    const result = fixture.api.register(ID);

    assert.equal(result.ok, true);
    assert.deepEqual(result.languages, []);
    assert.equal(result.language, undefined);
    assert.deepEqual(fixture.requests, []);
    assert.deepEqual(fixture.i18n.bundles, []);
  });

  it("logs one line per registration in PA's single-argument shape", () => {
    const fixture = page({
      lng: "de",
      store: { de: { Mods: "Mods" } },
      routes: {
        [ROOT + "de.json"]: json({
          Mods: { message: "Mods" },
          Bad: { message: 1 },
        }),
      },
    });

    fixture.api.register(ID);

    assert.deepEqual(fixture.console.log, [
      "[ModTranslations] " +
        ID +
        ' de {"languages":["de"],"added":1,"replaced":1,"invalid":1}',
    ]);
  });

  it("passes style codes and placeholders through verbatim", () => {
    const text = "[strong]__count__[/strong] Mods[br]{0} of {1}";
    const fixture = page({
      lng: "fr",
      routes: { [ROOT + "fr.json"]: json(entries({ Key: text })) },
    });

    fixture.api.register(ID);

    assert.equal(fixture.i18n.t("Key"), text);
  });
});

describe("languages", () => {
  it("returns the fallback chain for the current locale", () => {
    assert.deepEqual(page({ lng: "de-AT" }).api.languages(), ["de-AT", "de"]);
    assert.deepEqual(page({ lng: "fr" }).api.languages(), ["fr"]);
    assert.deepEqual(page({ lng: undefined }).api.languages(), []);
    assert.deepEqual(page({ i18n: ABSENT }).api.languages(), []);
  });
});

describe("registered", () => {
  it("returns copies keyed by id, not the cached objects", () => {
    const fixture = page({
      lng: "fr",
      routes: { [ROOT + "fr.json"]: json(entries({ Mods: "Mods" })) },
    });
    const result = fixture.api.register(ID);

    const snapshot = fixture.api.registered();

    assert.deepEqual(Object.keys(snapshot), [ID]);
    assert.deepEqual(snapshot[ID], result);
    assert.notEqual(snapshot[ID], result);
    assert.notEqual(snapshot[ID].languages, result.languages);
    snapshot[ID].languages.push("xx");
    assert.deepEqual(fixture.api.register(ID).languages, ["fr"]);
  });
});
