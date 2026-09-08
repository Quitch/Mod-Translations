"use strict";

// XMLHttpRequest over a `url -> { status, text } | { throws }` table. An
// unrouted URL answers 404 with an empty body, so a fixture cannot drift from
// what the code asks for. Every request is recorded as `{ url, async }`.

function fakeXhr(routes) {
  const table = routes || {};
  const requests = [];

  function XMLHttpRequest() {
    this.status = 0;
    this.responseText = "";
  }
  XMLHttpRequest.prototype.open = function (method, url, async) {
    this.url = url;
    requests.push({ url: url, async: async });
  };
  XMLHttpRequest.prototype.send = function () {
    const route = table[this.url];
    if (!route) {
      this.status = 404;
      return;
    }
    if (route.throws) {
      throw new Error(
        typeof route.throws === "string" ? route.throws : "send failed"
      );
    }
    this.status = route.status === undefined ? 200 : route.status;
    this.responseText = route.text === undefined ? "" : route.text;
  };
  XMLHttpRequest.requests = requests;
  return XMLHttpRequest;
}

function json(value) {
  return { status: 200, text: JSON.stringify(value) };
}

module.exports = { fakeXhr, json };
