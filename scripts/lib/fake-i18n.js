"use strict";

// i18next 1.7.1 as the shipped file sees it: `lng()`, `exists(key)` walking the
// fallback chain ("de-AT" -> "de" -> "dev"), and `addResourceBundle(lng, ns, res)`
// extending the flat store the game's native tables were loaded into. `store`
// is `{ lang: { key: "text" } }`. Any method can be dropped with `without` to
// assert the missing-engine path.

function chain(lng) {
  const languages = [];
  if (typeof lng === "string" && lng) {
    languages.push(lng);
    const dash = lng.indexOf("-");
    if (dash > 0) {
      languages.push(lng.substring(0, dash));
    }
  }
  languages.push("dev");
  return languages;
}

function fakeI18n(options) {
  const opts = options || {};
  const store = {};
  Object.keys(opts.store || {}).forEach((lang) => {
    store[lang] = Object.assign({}, opts.store[lang]);
  });
  const bundles = [];
  const i18n = {
    store: store,
    bundles: bundles,
    lng: () => opts.lng,
    exists: (key) =>
      chain(opts.lng).some(
        (lang) => store[lang] && Object.hasOwn(store[lang], key)
      ),
    addResourceBundle: (lng, ns, res) => {
      bundles.push({ lng: lng, ns: ns, res: Object.assign({}, res) });
      store[lng] = Object.assign(store[lng] || {}, res);
    },
    // What loc() would show after the bundles landed.
    t: (key) => {
      for (const lang of chain(opts.lng)) {
        if (store[lang] && Object.hasOwn(store[lang], key)) {
          return store[lang][key];
        }
      }
      return key;
    },
  };
  (opts.without || []).forEach((name) => {
    delete i18n[name];
  });
  return i18n;
}

module.exports = { fakeI18n };
