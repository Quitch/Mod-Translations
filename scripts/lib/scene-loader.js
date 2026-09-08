"use strict";

// Runs the shipped IIFE the way a PA page does: one shared scope, `window` as
// the root, engine globals as bare identifiers. Each test builds its own window
// object, so module-level state (the registration cache) never leaks between
// tests. The file runs in this realm, inside `with (window)`, rather than in a
// vm context: a context has its own Object.prototype, and assert.deepEqual
// rejects objects built there. See docs/testing.md.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MOD_ROOT = path.join(
  REPO_ROOT,
  "ui",
  "mods",
  "com.pa.quitch.modtranslations"
);
const COUI_PREFIX = "coui://";

function modinfo() {
  return JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "modinfo.json"), "utf8")
  );
}

function couiToFsPath(entry) {
  if (!entry.startsWith(COUI_PREFIX)) {
    throw new Error("scene-loader: not a coui:// entry: " + entry);
  }
  return path.resolve(REPO_ROOT, entry.slice(COUI_PREFIX.length));
}

// PA keeps only the first console argument per line, and so does this.
function fakeConsole() {
  const lines = { log: [], error: [], warn: [] };
  return {
    lines: lines,
    log: (first) => lines.log.push(String(first)),
    error: (first) => lines.error.push(String(first)),
    warn: (first) => lines.warn.push(String(first)),
  };
}

// `stubs` are the engine globals the test supplies (i18n, XMLHttpRequest...).
// A stub given as undefined is left absent, which is how a test asserts the
// missing-engine path.
function createContext(stubs) {
  const ctx = {
    _: require("lodash"),
    console: fakeConsole(),
  };
  Object.keys(stubs || {}).forEach((name) => {
    if (stubs[name] === undefined) {
      delete ctx[name];
    } else {
      ctx[name] = stubs[name];
    }
  });
  ctx.window = ctx;
  return ctx;
}

// The wrapper shares the file's first line so every line number in a stack
// trace and the coverage report is the file's own.
const PRELUDE = "(function (window) { with (window) { ";
const POSTLUDE = "\n}})";

function loadFile(ctx, entry) {
  const fsPath = entry.startsWith(COUI_PREFIX)
    ? couiToFsPath(entry)
    : path.join(MOD_ROOT, entry);
  const source = fs.readFileSync(fsPath, "utf8");
  const run = vm.runInThisContext(PRELUDE + source + POSTLUDE, {
    filename: fsPath,
  });
  run(ctx);
  return ctx;
}

function sceneFiles(scene) {
  const files = modinfo().scenes[scene];
  if (!files) {
    throw new Error("scene-loader: modinfo.json has no scene " + scene);
  }
  return files;
}

function loadScene(ctx, scene) {
  for (const entry of sceneFiles(scene)) {
    loadFile(ctx, entry);
  }
  return ctx;
}

module.exports = {
  MOD_ROOT,
  REPO_ROOT,
  couiToFsPath,
  createContext,
  fakeConsole,
  loadFile,
  loadScene,
  modinfo,
  sceneFiles,
};
