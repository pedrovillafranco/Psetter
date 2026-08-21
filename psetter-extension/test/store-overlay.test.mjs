import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { assertStoreZip } from "../scripts/check-boundary.mjs";
import { loadStoreOverlay } from "../scripts/store-overlay.mjs";

const extensionDir = fileURLToPath(new URL("../", import.meta.url));
const rootDir = path.resolve(extensionDir, "..");
const packageScript = path.join(extensionDir, "scripts", "package.mjs");
const version = JSON.parse(await readFile(path.join(extensionDir, "package.json"), "utf8")).version;

async function createOverlay() {
  const directory = await mkdtemp(path.join(tmpdir(), "psetter-store-overlay-"));
  const origin = "https://store.example.invalid";
  await writeFile(
    path.join(directory, "runtime-config.js"),
    `globalThis.__psetterConfig = Object.freeze({
  settingsKey: "psetMathSettings",
  symbolsOpenKey: "psetMathSymbolsOpen",
  usageKey: "psetMathUsage",
  developerMessageReadKey: "psetterDeveloperMessageReadId",
  restoreHintKey: "psetterRestoreHintV1",
  remoteConfigKey: "psetterRemoteConfigV1",
  remoteConfigUrl: "${origin}/config/v1.json",
  remoteConfigTtlMs: 5 * 60 * 1000,
  feedbackPageUrl: "${origin}/feedback",
  feedbackPageOrigin: "${origin}",
  feedbackHostPath: "feedback-host.html",
  feedbackEnabled: true,
  buildChannel: "__PSETTER_BUILD_CHANNEL__",
  mitxHostname: "mitx.mit.edu",
});
`,
  );
  await writeFile(
    path.join(directory, "feedback-host.html"),
    '<link rel="stylesheet" href="feedback-host.css"><script src="feedback-host.js"></script>',
  );
  await writeFile(path.join(directory, "feedback-host.css"), "body { margin: 0; }");
  await writeFile(path.join(directory, "feedback-host.js"), `const origin = "${origin}";`);
  return directory;
}

test("Store overlay validation and packaging are explicit and isolated", async () => {
  const overlayDir = await createOverlay();
  try {
    const overlay = await loadStoreOverlay(overlayDir);
    assert.equal(overlay.feedbackOrigin, "https://store.example.invalid");

    const result = spawnSync(
      process.execPath,
      [packageScript, "--channel", "store", "--store-overlay", overlayDir],
      { cwd: extensionDir, encoding: "utf8" },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const artifact = path.join(rootDir, "dist", `psetter-v${version}-store.zip`);
    await assertStoreZip(artifact, "Store ZIP");
    const content = await readFile(path.join(rootDir, "dist", "psetter-store", "content.js"), "utf8");
    const embeddedConfig = content.match(
      /globalThis\.__psetterConfig\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/u,
    );
    assert.ok(embeddedConfig, "Store content should embed runtime configuration");
    assert.match(embeddedConfig[1], /feedbackEnabled:!0/);
    assert.match(embeddedConfig[1], /feedbackHostPath:"feedback-host\.html"/);
    assert.match(content, /https:\/\/store\.example\.invalid/);

    const wrongChannel = spawnSync(
      process.execPath,
      [packageScript, "--channel", "community", "--store-overlay", overlayDir],
      { cwd: extensionDir, encoding: "utf8" },
    );
    assert.notEqual(wrongChannel.status, 0);
    assert.match(`${wrongChannel.stdout}\n${wrongChannel.stderr}`, /only be used with --channel store/);
  } finally {
    await rm(overlayDir, { recursive: true, force: true });
  }
});

test("Store packaging rejects incomplete overlay directories", async () => {
  const overlayDir = await mkdtemp(path.join(tmpdir(), "psetter-store-overlay-incomplete-"));
  try {
    await writeFile(path.join(overlayDir, "runtime-config.js"), "{}");
    await assert.rejects(() => loadStoreOverlay(overlayDir), /missing feedback-host/);
  } finally {
    await rm(overlayDir, { recursive: true, force: true });
  }
});
