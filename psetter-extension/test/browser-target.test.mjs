import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { renderManifest } from "../scripts/browser-target.mjs";

const extensionDir = fileURLToPath(new URL("../", import.meta.url));
const sourceManifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));

test("browser manifests keep target-specific background configuration isolated", () => {
  const chrome = renderManifest(sourceManifest, { browser: "chrome" });
  assert.equal(chrome.minimum_chrome_version, "120");
  assert.deepEqual(chrome.background, { service_worker: "background.js" });
  assert.equal(chrome.browser_specific_settings, undefined);

  const firefox = renderManifest(sourceManifest, { browser: "firefox" });
  assert.equal(firefox.minimum_chrome_version, undefined);
  assert.deepEqual(firefox.background, { scripts: ["background.js"] });
  assert.deepEqual(firefox.browser_specific_settings?.gecko, {
    id: "psetter@villafran.co",
    strict_min_version: "128.0",
    data_collection_permissions: { required: ["none"] },
  });
});

test("Store manifest additions apply equally to both browser targets", () => {
  const overlay = { feedbackOrigin: "https://feedback.example.invalid" };
  for (const browser of ["chrome", "firefox"]) {
    const manifest = renderManifest(sourceManifest, { browser, storeOverlay: overlay });
    assert.ok(manifest.host_permissions.includes("https://feedback.example.invalid/*"));
    assert.ok(
      manifest.web_accessible_resources.some((entry) => entry.resources.includes("feedback-host.html")),
    );
  }
});
