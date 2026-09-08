"use strict";

// modinfo.json: one global_mod_list script, present on disk, loaded ahead of
// every consumer, and the release metadata agrees with the changelog.

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  MOD_ROOT,
  REPO_ROOT,
  couiToFsPath,
  modinfo,
  sceneFiles,
} = require("../scripts/lib/scene-loader.js");

const info = modinfo();

function shipped(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? shipped(full) : [full];
  });
}

describe("modinfo scenes", () => {
  it("ship exactly one global_mod_list script", () => {
    assert.deepEqual(info.scenes, {
      global_mod_list: [
        "coui://ui/mods/com.pa.quitch.modtranslations/translations.js",
      ],
    });
  });

  it("name only files that exist", () => {
    for (const entry of sceneFiles("global_mod_list")) {
      assert.equal(fs.existsSync(couiToFsPath(entry)), true, entry);
    }
  });

  it("load every shipped file", () => {
    const referenced = new Set(sceneFiles("global_mod_list").map(couiToFsPath));
    for (const file of shipped(MOD_ROOT)) {
      assert.equal(referenced.has(file), true, path.relative(REPO_ROOT, file));
    }
  });
});

describe("modinfo release metadata", () => {
  it("is a client mod that loads before the default priority", () => {
    // Community Mods sorts by priority ascending; consumers keep the default
    // 100 or higher so this script runs first. See design.md.
    assert.equal(info.context, "client");
    assert.equal(typeof info.priority, "number");
    assert.equal(info.priority < 100, true);
  });

  it("keeps the published identifier prefix", () => {
    assert.match(info.identifier, /^com\.pa\.quitch\.modtranslations(-dev)?$/);
  });

  it("has a changelog heading for its version, or an Unreleased one", () => {
    const changelog = fs.readFileSync(
      path.join(REPO_ROOT, "CHANGELOG.md"),
      "utf8"
    );
    const first = /^## (.*)$/m.exec(changelog);

    assert.notEqual(first, null);
    assert.equal(
      first[1] === "Unreleased" ||
        first[1].startsWith("v" + info.version + " "),
      true,
      first[1]
    );
  });
});
