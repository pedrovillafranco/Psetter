import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const extensionDir = new URL("../", import.meta.url);

test("developer message surfaces are local, text-only, and dismissible", async () => {
  const [popup, popupScript, runtime, styles] = await Promise.all([
    readFile(new URL("popup.html", extensionDir), "utf8"),
    readFile(new URL("popup.js", extensionDir), "utf8"),
    readFile(new URL("src/content-runtime.js", extensionDir), "utf8"),
    readFile(new URL("content.css", extensionDir), "utf8"),
  ]);

  assert.match(popup, /id="developerMessageNotice"/);
  assert.match(popup, /id="developerMessagePanel"/);
  assert.match(popup, /id="developerMessageClose"/);
  assert.match(popup, /id="developerMessageProgress"/);
  assert.doesNotMatch(popup, /developerMessageDismiss/);
  assert.match(popupScript, /developerMessageReadId/);
  assert.match(popupScript, /textContent = message\.text/);
  assert.doesNotMatch(popupScript, /developerMessageDismiss/);
  assert.doesNotMatch(popupScript, /innerHTML/);
  assert.match(runtime, /developerMessageReadId/);
  assert.match(runtime, /developerMessageReadIds/);
  assert.match(runtime, /R\("p", "pset-math-developer-message-text", message\.text\)/);
  assert.doesNotMatch(runtime, /developerMessage.*innerHTML/s);
  assert.match(styles, /\.pset-math-developer-message-panel/);
  assert.match(styles, /\.pset-math-developer-message-button/);
});

test("popup queues two notifications through the existing read and dismiss controls", async () => {
  const [html, runtimeConfig, popupScript] = await Promise.all([
    readFile(new URL("popup.html", extensionDir), "utf8"),
    readFile(new URL("runtime-config.js", extensionDir), "utf8"),
    readFile(new URL("popup.js", extensionDir), "utf8"),
  ]);
  const first = {
    id: "notice-1",
    title: "First notice",
    text: "First text",
    signature: "- Pedro",
  };
  const second = {
    id: "notice-2",
    title: "Second notice",
    text: "Second text",
    signature: "- Pedro",
  };
  const remoteConfig = {
    developerMessages: [first, second],
    disabled: false,
    feedbackDisabled: true,
    minimumSupportedVersion: null,
    compatibilityWarning: null,
    maintenanceMessage: null,
    features: { contextSymbols: true, symbolSearch: true },
  };
  const dom = new JSDOM(html, {
    url: "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/popup.html",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const storage = {};
  window.chrome = {
    runtime: {
      getManifest: () => ({ version: "0.1.3" }),
      getURL: (value = "") => `chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/${value}`,
    },
    storage: {
      local: {
        async get(key) {
          if (typeof key === "string") return { [key]: storage[key] };
          return { ...storage };
        },
        async set(value) {
          Object.assign(storage, value);
        },
      },
      onChanged: { addListener() {} },
    },
  };
  window.eval(runtimeConfig);
  window.__psetterRemoteConfig = {
    defaults: remoteConfig,
    load: async () => remoteConfig,
    readDeveloperMessageReadId: async () => null,
    readDeveloperMessageReadIds: async () => [],
    developerMessageReadKey: "developerMessageReadId",
    developerMessageReadIdsKey: "developerMessageReadIds",
    normalizeDeveloperMessageReadId: (value) => value,
    normalizeDeveloperMessageReadIds: (value) => value,
    isVersionBelow: () => false,
    isDeveloperMessageUnread: (message, readIds) => !readIds.includes(message.id),
    dismissDeveloperMessage: async () => true,
  };
  try {
    window.eval(popupScript);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const open = window.document.querySelector("#developerMessageOpen");
    const close = window.document.querySelector("#developerMessageClose");
    const panel = window.document.querySelector("#developerMessagePanel");
    assert.equal(open.hidden, false);
    open.click();
    assert.equal(panel.hidden, false);
    assert.equal(window.document.querySelector("#developerMessageTitle").textContent, first.title);
    assert.equal(window.document.querySelector("#developerMessageProgress").textContent, "1 of 2");

    close.click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(panel.hidden, true);
    assert.equal(open.hidden, false, "second notification remains queued");
    open.click();
    assert.equal(window.document.querySelector("#developerMessageTitle").textContent, second.title);
    assert.equal(window.document.querySelector("#developerMessageProgress").textContent, "2 of 2");
  } finally {
    dom.window.close();
  }
});
