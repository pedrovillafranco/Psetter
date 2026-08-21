import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";
import { assertPublicTree, assertPublicZip } from "../scripts/check-boundary.mjs";
import { artifactFileName } from "../scripts/release-provenance.mjs";

const extensionDir = fileURLToPath(new URL("../", import.meta.url));
const rootDir = path.resolve(extensionDir, "..");

test("public extension inputs contain no store infrastructure leaks", async () => {
  await assertPublicTree(extensionDir, "public extension inputs");
  const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
  assert.equal(manifest.background?.service_worker, "background.js");
  assert.equal(existsSync(path.join(extensionDir, "background.js")), true);
  assert.deepEqual(manifest.host_permissions, ["https://*.mitx.mit.edu/*"]);
  assert.equal(manifest.web_accessible_resources.some((entry) =>
    entry.resources.some((resource) => resource.startsWith("feedback-host.")),
  ), false);
  assert.equal(existsSync(path.join(extensionDir, "feedback-host.html")), false);
  assert.equal(existsSync(path.join(extensionDir, "feedback-host.css")), false);
  assert.equal(existsSync(path.join(extensionDir, "feedback-host.js")), false);
});

test("community packaging performs a ZIP-level boundary scan", async () => {
  const packageScript = await readFile(path.join(extensionDir, "scripts", "package.mjs"), "utf8");
  assert.match(packageScript, /assertPublicZip\(archive,\s*["']community ZIP/);
  const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
  const archive = path.join(rootDir, "dist", artifactFileName(manifest.version, "community"));
  if (existsSync(archive)) await assertPublicZip(archive, "community ZIP");
});

test("community runtime configuration has no hosted service endpoints", async () => {
  const config = await readFile(path.join(extensionDir, "runtime-config.js"), "utf8");
  assert.match(config, /remoteConfigUrl:\s*["']["']/);
  assert.match(config, /feedbackPageUrl:\s*["']["']/);
  assert.match(config, /feedbackPageOrigin:\s*["']["']/);
  assert.match(config, /feedbackEnabled:\s*false/);
});

test("community popup feedback is unavailable without making a hosted request", async () => {
  const [html, runtimeConfig, remoteConfig, popup] = await Promise.all([
    readFile(path.join(extensionDir, "popup.html"), "utf8"),
    readFile(path.join(extensionDir, "runtime-config.js"), "utf8"),
    readFile(path.join(extensionDir, "remote-config.js"), "utf8"),
    readFile(path.join(extensionDir, "popup.js"), "utf8"),
  ]);
  const dom = new JSDOM(html, {
    url: "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/popup.html",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  let fetchCalls = 0;
  let tabCreates = 0;
  dom.window.fetch = async () => {
    fetchCalls += 1;
    throw new Error("community popup must not fetch hosted feedback");
  };
  dom.window.chrome = {
    runtime: {
      getManifest: () => ({ version: "0.1.1" }),
      getURL: (value = "") => `chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/${value}`,
    },
    storage: { local: { async get() { return {}; }, async set() {} } },
    tabs: {
      async query() { return [{ id: 1 }]; },
      async sendMessage() { throw new Error("no MITx page"); },
      async create() { tabCreates += 1; },
    },
  };
  try {
    dom.window.eval(runtimeConfig);
    dom.window.eval(remoteConfig);
    dom.window.eval(popup);
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    const feedback = dom.window.document.querySelector("#feedbackLink");
    assert.equal(feedback.hidden, true);
    feedback.click();
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    assert.equal(fetchCalls, 0);
    assert.equal(tabCreates, 0);
  } finally {
    dom.window.close();
  }
});
