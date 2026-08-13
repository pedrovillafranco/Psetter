import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const extensionDir = new URL("../", import.meta.url);

test("local demo uses packaged production code without broader site access", async () => {
  const [html, popupScript, packageScript, runtime, manifest] = await Promise.all([
    readFile(new URL("demo.html", extensionDir), "utf8"),
    readFile(new URL("popup.js", extensionDir), "utf8"),
    readFile(new URL("scripts/package.mjs", extensionDir), "utf8"),
    readFile(new URL("src/content-runtime.js", extensionDir), "utf8"),
    readFile(new URL("manifest.json", extensionDir), "utf8").then(JSON.parse),
  ]);

  assert.match(html, /vendor\/jquery\.min\.js/);
  assert.match(html, /vendor\/mathquill\.min\.js/);
  assert.match(html, /content\.js/);
  assert.match(html, /demo\.js/);
  assert.doesNotMatch(html, /<script[^>]+https?:/i);
  assert.match(popupScript, /getURL\?\.\("demo\.html"\)/);
  assert.match(packageScript, /"demo\.html"/);
  assert.match(runtime, /location\.pathname === "\/demo\.html"/);
  assert.match(runtime, /function recordSafeTermCombination\(e = 1\) \{\s*if \(psetterIsPackagedDemo\) return Promise\.resolve\(\);/);
  assert.match(runtime, /if \(!psetterIsPackagedDemo\) this\.refreshRemoteConfig\(\)/);
  assert.deepEqual(manifest.host_permissions, [
    "https://*.mitx.mit.edu/*",
    "https://feedback.psetter.villafran.co/*",
  ]);
});
