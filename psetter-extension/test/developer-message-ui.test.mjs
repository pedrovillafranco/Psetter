import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const extensionDir = new URL("../", import.meta.url);

test("developer message surfaces are local, text-only, and explicitly dismissible", async () => {
  const [popup, popupScript, runtime, styles, theme] = await Promise.all([
    readFile(new URL("popup.html", extensionDir), "utf8"),
    readFile(new URL("popup.js", extensionDir), "utf8"),
    readFile(new URL("src/content-runtime.js", extensionDir), "utf8"),
    readFile(new URL("content.css", extensionDir), "utf8"),
    readFile(new URL("content-theme.css", extensionDir), "utf8"),
  ]);

  assert.match(popup, /id="developerMessageNotice"/);
  assert.match(popup, /id="developerMessagePanel"/);
  assert.match(popup, /id="developerMessageClose"/);
  assert.match(popup, /id="developerMessagePrevious"/);
  assert.match(popup, /id="developerMessageProgress"/);
  assert.match(popup, /id="developerMessageNext"/);
  assert.match(popup, /id="developerMessageDismiss"/);
  assert.match(popupScript, /developerMessageReadId/);
  assert.match(popupScript, /textContent = message\.text/);
  assert.match(popupScript, /developerMessageDismiss/);
  assert.doesNotMatch(popupScript, /innerHTML/);
  assert.match(runtime, /developerMessageReadId/);
  assert.match(runtime, /developerMessageReadIds/);
  assert.match(runtime, /R\("p", "pset-math-developer-message-text", message\.text\)/);
  assert.match(runtime, /pset-math-developer-message-nav/);
  assert.match(runtime, /pset-math-developer-message-dismiss/);
  assert.doesNotMatch(runtime, /developerMessage.*innerHTML/s);
  assert.match(styles, /\.pset-math-developer-message-panel/);
  assert.match(styles, /\.pset-math-developer-message-button/);
  assert.match(theme, /chrome-extension:\/\/__MSG_@@extension_id__\/vendor\/font\/InterVariable\.woff2/);
  assert.match(theme, /url\("vendor\/font\/InterVariable\.woff2"\)/);
});

test("popup queues multiple notifications through the existing read and dismiss controls", async () => {
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
  const third = {
    id: "notice-3",
    title: "Third notice",
    text: "Third text",
    signature: "- Pedro",
  };
  const remoteConfig = {
    developerMessages: [first, second, third],
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
  let storageChanged;
  let remoteConfigLoadCount = 0;
  window.chrome = {
    runtime: {
      getManifest: () => ({ version: "0.1.4" }),
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
      onChanged: {
        addListener(listener) { storageChanged = listener; },
      },
    },
  };
  window.eval(runtimeConfig);
  window.__psetterRemoteConfig = {
    defaults: remoteConfig,
    load: async () => {
      remoteConfigLoadCount += 1;
      return remoteConfig;
    },
    readDeveloperMessageReadId: async () => null,
    readDeveloperMessageReadIds: async () => [],
    developerMessageReadKey: "developerMessageReadId",
    developerMessageReadIdsKey: "developerMessageReadIds",
    developerNotificationTokenKey: "psetterDeveloperNotificationToken",
    normalizeDeveloperMessageReadId: (value) => value,
    normalizeDeveloperMessageReadIds: (value) => value,
    isVersionBelow: () => false,
    isDeveloperMessageUnread: (message, readIds) => !readIds.includes(message.id),
    dismissDeveloperMessage: async () => true,
  };
  try {
    window.eval(popupScript);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(remoteConfigLoadCount, 1);
    await storageChanged(
      { psetterDeveloperNotificationToken: { newValue: "local-token" } },
      "local",
    );
    assert.equal(remoteConfigLoadCount, 2, "changing the local token refreshes the popup feed");
    const open = window.document.querySelector("#developerMessageOpen");
    const close = window.document.querySelector("#developerMessageClose");
    const previous = window.document.querySelector("#developerMessagePrevious");
    const next = window.document.querySelector("#developerMessageNext");
    const dismiss = window.document.querySelector("#developerMessageDismiss");
    const panel = window.document.querySelector("#developerMessagePanel");
    assert.equal(open.hidden, false);
    open.click();
    assert.equal(panel.hidden, false);
    assert.equal(window.document.querySelector("#developerMessageTitle").textContent, first.title);
    assert.equal(window.document.querySelector("#developerMessageProgress").textContent, "1 of 3");

    close.click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(panel.hidden, true);
    assert.equal(open.hidden, false, "closing does not dismiss the notification");
    open.click();
    assert.equal(window.document.querySelector("#developerMessageTitle").textContent, first.title);
    assert.equal(window.document.querySelector("#developerMessageProgress").textContent, "1 of 3");
    assert.equal(previous.disabled, true);
    assert.equal(next.disabled, false);
    next.click();
    assert.equal(window.document.querySelector("#developerMessageTitle").textContent, second.title);
    assert.equal(window.document.querySelector("#developerMessageProgress").textContent, "2 of 3");

    dismiss.click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(open.hidden, false, "undismissed notifications remain queued");
    open.click();
    assert.equal(window.document.querySelector("#developerMessageTitle").textContent, third.title);
    assert.equal(window.document.querySelector("#developerMessageProgress").textContent, "3 of 3");
  } finally {
    dom.window.close();
  }
});
