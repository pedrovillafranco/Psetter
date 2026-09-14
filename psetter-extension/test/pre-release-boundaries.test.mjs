import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const extensionDir = new URL("../", import.meta.url);
const extensionPath = fileURLToPath(extensionDir);
const rootPath = path.resolve(extensionPath, "..");

test("settings stay local and page messaging does not broadcast extension state", async () => {
  const [popup, runtime] = await Promise.all([
    readFile(new URL("popup.js", extensionDir), "utf8"),
    readFile(new URL("src/content-runtime.js", extensionDir), "utf8"),
  ]);

  assert.doesNotMatch(popup, /storage\.sync/);
  assert.doesNotMatch(runtime, /storage\.sync/);
  assert.doesNotMatch(runtime, /broadcastSettings|broadcastRemoteConfig/);
  assert.doesNotMatch(
    runtime,
    /postMessage\(\s*\{\s*target:\s*["']psetter-settings-update["'][^)]{0,240}\},\s*["']\*["']\s*\)/,
  );
  assert.doesNotMatch(
    runtime,
    /postMessage\(\s*\{\s*target:\s*["']psetter-remote-config-update["'][^)]{0,240}\},\s*["']\*["']\s*\)/,
  );
  assert.match(runtime, /targetOrigin:\s*t\.origin/);
});

test("production packaging keeps only runtime-required icon assets", async () => {
  const packageScript = await readFile(new URL("scripts/package.mjs", extensionDir), "utf8");

  assert.match(packageScript, /const releaseDirectories = \["vendor"\]/);
  assert.match(packageScript, /icons\/icon128\.png/);
  assert.doesNotMatch(packageScript, /"privacy\.html"/);
  assert.doesNotMatch(packageScript, /releaseDirectories = \["icons"/);
});

test("the generated production content bundle excludes QA snapshot code", async () => {
  const content = await readFile(new URL("content.js", extensionDir), "utf8");

  assert.doesNotMatch(
    content,
    /getQaSnapshot|page_url|raw_latex|visible_psetter_text|PsetterQaHarness|qaTests|qaWait/,
  );
});

test("the release surface has only public and Store packages", async () => {
  const [rootPackage, extensionPackage, packageScript] = await Promise.all([
    readFile(path.join(rootPath, "package.json"), "utf8"),
    readFile(path.join(extensionPath, "package.json"), "utf8"),
    readFile(new URL("scripts/package.mjs", extensionDir), "utf8"),
  ]);

  assert.doesNotMatch(rootPackage, /package:dev/);
  assert.doesNotMatch(extensionPackage, /package:dev/);
  assert.doesNotMatch(packageScript, /--dev|Psetter Dev|psetter-dev|popup-dev/);
});

test("release preparation runs every test before reproducibility verification", async () => {
  const script = await readFile(new URL("scripts/prepare-release.mjs", extensionDir), "utf8");
  const syntaxCheck = script.indexOf('path.join(scriptDir, "check.mjs")');
  const completeTests = script.indexOf('["--test", ...testFiles]');
  const reproducibility = script.indexOf('path.join(scriptDir, "check-reproducible.mjs")');

  assert.match(script, /readdir\(testDir\)/);
  assert.match(script, /endsWith\("\.test\.mjs"\)/);
  assert.doesNotMatch(script, /remote-config\.test\.mjs/);
  assert.ok(syntaxCheck >= 0);
  assert.ok(completeTests > syntaxCheck);
  assert.ok(reproducibility > completeTests);
});
