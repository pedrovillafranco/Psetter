import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const extensionDir = new URL("../", import.meta.url);
const extensionPath = fileURLToPath(extensionDir);
const rootPath = path.resolve(extensionPath, "..");

async function snapshotRepositoryFiles(directory, prefix = "") {
  const result = new Map();
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && [".git", "dist", "node_modules"].includes(entry.name)) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      const nested = await snapshotRepositoryFiles(absolutePath, relativePath);
      for (const [file, hash] of nested) result.set(file, hash);
    } else if (entry.isFile()) {
      const content = await readFile(absolutePath);
      result.set(relativePath, createHash("sha256").update(content).digest("hex"));
    }
  }
  return result;
}

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

test("the development package does not modify repository files", async () => {
  const before = await snapshotRepositoryFiles(rootPath);
  const result = spawnSync(
    process.execPath,
    [path.join(extensionPath, "scripts", "package.mjs"), "--dev"],
    { cwd: extensionPath, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const after = await snapshotRepositoryFiles(rootPath);
  assert.deepEqual(after, before);
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
