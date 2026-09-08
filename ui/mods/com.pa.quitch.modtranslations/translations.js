// Loads a mod's own translation files into the game's i18next store so stock
// loc() resolves them. Runs once per page from global_mod_list, before any scene
// script, so every consumer finds window.ModTranslations. See design.md.
(function (root) {
  var NAMESPACE = "translation";
  var SEPARATORS = /;;|::/;
  var registered = {};

  function engine() {
    var i18n = root.i18n;
    if (
      !i18n ||
      !_.isFunction(i18n.lng) ||
      !_.isFunction(i18n.exists) ||
      !_.isFunction(i18n.addResourceBundle)
    ) {
      return null;
    }
    return i18n;
  }

  // Most specific first, the order i18next falls back in: "de-AT" before "de".
  function chain(lng) {
    if (!_.isString(lng) || !lng) {
      return [];
    }
    var languages = [lng];
    var dash = lng.indexOf("-");
    if (dash > 0) {
      languages.push(lng.substring(0, dash));
    }
    return languages;
  }

  function isEnglish(languages) {
    return (
      languages.length > 0 &&
      languages[languages.length - 1].toLowerCase() === "en"
    );
  }

  function fileUrl(rootUrl, lang) {
    return rootUrl + lang + ".json";
  }

  // Synchronous on purpose: the consumer's scene scripts call loc() right after
  // this returns. Same sync coui:// read as the game's own loadScript. See
  // design.md.
  function fetchJson(src) {
    var xhr = new XMLHttpRequest();
    var text;
    try {
      xhr.open("GET", src, false);
      xhr.send();
      if (xhr.status > 200 && xhr.status !== 304) {
        return { missing: true };
      }
      text = xhr.responseText;
    } catch (e) {
      return { missing: true };
    }
    if (!_.isString(text) || !_.trim(text)) {
      return { missing: true };
    }
    try {
      return { data: JSON.parse(text) };
    } catch (e) {
      return { error: e };
    }
  }

  function collect(data, i18n, additions, result) {
    if (!_.isPlainObject(data)) {
      return false;
    }
    _.forOwn(data, function (entry, key) {
      var message = entry && entry.message;
      if (!_.isString(message) || !message || !key || SEPARATORS.test(key)) {
        result.invalid += 1;
        return;
      }
      if (_.has(additions, key)) {
        return;
      }
      additions[key] = message;
      result.added += 1;
      if (i18n.exists(key)) {
        result.replaced += 1;
      }
    });
    return true;
  }

  function fail(message) {
    console.error("[ModTranslations] " + message);
    return { ok: false };
  }

  root.ModTranslations = {
    register: function (id, options) {
      if (!_.isString(id) || !id) {
        return fail("register needs a mod identifier");
      }
      if (_.has(registered, id)) {
        return registered[id];
      }
      var i18n = engine();
      if (!i18n) {
        return fail("i18n is not initialised; " + id + " not registered");
      }
      var language = i18n.lng();
      var languages = chain(language);
      var rootUrl =
        (options && _.isString(options.root) && options.root) ||
        "coui://ui/mods/" + id + "/translations/";
      var additions = {};
      var result = {
        id: id,
        language: language,
        languages: [],
        added: 0,
        replaced: 0,
        invalid: 0,
        ok: true,
      };

      if (!isEnglish(languages)) {
        _.forEach(languages, function (lang) {
          var url = fileUrl(rootUrl, lang);
          var file = fetchJson(url);
          if (file.missing) {
            return;
          }
          if (file.error) {
            console.error(
              "[ModTranslations] " + url + " is not valid JSON: " + file.error
            );
            return;
          }
          if (!collect(file.data, i18n, additions, result)) {
            console.error(
              "[ModTranslations] " + url + " must hold a JSON object of entries"
            );
            return;
          }
          result.languages.push(lang);
        });
      }

      if (result.added > 0) {
        i18n.addResourceBundle(language, NAMESPACE, additions);
      }

      registered[id] = result;
      // One string: PA's log keeps only the first console argument.
      console.log(
        "[ModTranslations] " +
          id +
          " " +
          language +
          " " +
          JSON.stringify({
            languages: result.languages,
            added: result.added,
            replaced: result.replaced,
            invalid: result.invalid,
          })
      );
      return result;
    },
    languages: function () {
      var i18n = engine();
      return i18n ? chain(i18n.lng()) : [];
    },
    registered: function () {
      return _.mapValues(registered, function (result) {
        var copy = _.clone(result);
        copy.languages = result.languages.slice();
        return copy;
      });
    },
  };
})(window);
