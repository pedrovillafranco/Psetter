import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { JSDOM } from "jsdom";
import { assertStoreZip } from "../scripts/check-boundary.mjs";
import { artifactFileName } from "../scripts/release-provenance.mjs";
import { loadStoreOverlay } from "../scripts/store-overlay.mjs";

const extensionDir = fileURLToPath(new URL("../", import.meta.url));
const packageScript = path.join(extensionDir, "scripts", "package.mjs");
const version = JSON.parse(await readFile(path.join(extensionDir, "package.json"), "utf8")).version;

async function assertPageConnections(packageDir, expectedSources) {
  for (const name of ["popup.html", "demo.html"]) {
    const dom = new JSDOM(await readFile(path.join(packageDir, name), "utf8"));
    try {
      const policy = dom.window.document.querySelector('meta[http-equiv="Content-Security-Policy"]').content;
      const directives = policy.split(";").map((value) => value.trim().split(/\s+/));
      assert.deepEqual(directives.filter(([name]) => name === "connect-src"), [
        ["connect-src", ...expectedSources],
      ], `${name}: allow exactly the configured connection sources`);
      for (const directive of ["default-src", "script-src"])
        assert.deepEqual(directives.find(([name]) => name === directive), [directive, "'self'"]);
      assert.deepEqual(directives.find(([name]) => name === "object-src"), ["object-src", "'none'"]);
    } finally { dom.window.close(); }
  }
}

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
  remoteConfigKey: "psetterRemoteConfigV2",
  remoteConfigUrl: "${origin}/config/v2.json",
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
  const outputDir = await mkdtemp(path.join(tmpdir(), "psetter-store-package-output-"));
  try {
    const overlay = await loadStoreOverlay(overlayDir);
    assert.equal(overlay.feedbackOrigin, "https://store.example.invalid");

    for (const browser of ["chrome", "firefox"]) {
      const result = spawnSync(
        process.execPath,
        [
          packageScript,
          "--channel",
          "store",
          "--browser",
          browser,
          "--store-overlay",
          overlayDir,
          "--output-dir",
          outputDir,
        ],
        { cwd: extensionDir, encoding: "utf8" },
      );
      assert.equal(result.status, 0, `${browser}: ${result.stdout}\n${result.stderr}`);
      const artifact = path.join(outputDir, artifactFileName(version, "store", browser));
      await assertStoreZip(artifact, `Store ${browser} ZIP`, browser);
      const packageName = browser === "chrome" ? "psetter-store" : `psetter-${browser}-store`;
      await assertPageConnections(path.join(outputDir, packageName), ["'self'", overlay.feedbackOrigin]);
      const content = await readFile(path.join(outputDir, packageName, "content.js"), "utf8");
      const embeddedConfig = content.match(
        /globalThis\.__psetterConfig\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/u,
      );
      assert.ok(embeddedConfig, "Store content should embed runtime configuration");
      assert.match(embeddedConfig[1], /feedbackEnabled:!0/);
      assert.match(embeddedConfig[1], /feedbackHostPath:"feedback-host\.html"/);
      assert.match(content, /https:\/\/store\.example\.invalid/);
    }

    const wrongChannel = spawnSync(
      process.execPath,
      [packageScript, "--channel", "community", "--store-overlay", overlayDir],
      { cwd: extensionDir, encoding: "utf8" },
    );
    assert.notEqual(wrongChannel.status, 0);
    assert.match(`${wrongChannel.stdout}\n${wrongChannel.stderr}`, /only be used with --channel store/);
  } finally {
    await rm(overlayDir, { recursive: true, force: true });
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("community pages keep local-only connections after packaging", async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), "psetter-community-policy-"));
  try {
    for (const browser of ["chrome", "firefox"]) {
      const result = spawnSync(process.execPath, [packageScript, "--channel", "community",
        "--browser", browser, "--output-dir", outputDir], { cwd: extensionDir, encoding: "utf8" });
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      const packageName = browser === "chrome" ? "psetter-community" : "psetter-firefox-community";
      await assertPageConnections(path.join(outputDir, packageName), ["'self'"]);
    }
  } finally { await rm(outputDir, { recursive: true, force: true }); }
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

test("normal Store builds produce only stable unpacked browser directories", async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "psetter-store-build-fixture-"));
  const overlayDir = await createOverlay();
  try {
    const fixtureExtension = path.join(fixtureRoot, "psetter-extension");
    await cp(extensionDir, fixtureExtension, {
      recursive: true,
      filter: (source) => !["node_modules", "test"].includes(path.basename(source)),
    });
    await cp(path.resolve(extensionDir, "..", "package.json"), path.join(fixtureRoot, "package.json"));
    await symlink(path.join(extensionDir, "node_modules"), path.join(fixtureExtension, "node_modules"), "dir");
    for (const browser of ["chrome", "firefox"]) {
      const result = spawnSync(process.execPath, [
        path.join(fixtureExtension, "scripts", "package.mjs"),
        "--channel", "store", "--browser", browser, "--store-overlay", overlayDir,
      ], { cwd: fixtureExtension, encoding: "utf8" });
      assert.equal(result.status, 0, `${browser}: ${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /Built unpacked Store extension/);
      const packageName = browser === "chrome" ? "psetter-store" : "psetter-firefox-store";
      const manifest = JSON.parse(await readFile(path.join(fixtureRoot, "dist", packageName, "manifest.json"), "utf8"));
      assert.equal(manifest.version, version);
      assert.ok((await readdir(path.join(fixtureRoot, "dist", packageName))).includes("feedback-host.html"));
    }
    assert.deepEqual((await readdir(path.join(fixtureRoot, "dist"))).sort(), [
      "psetter-firefox-store", "psetter-store",
    ], "normal builds create no ZIP, staging, or intermediate build folders");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
    await rm(overlayDir, { recursive: true, force: true });
  }
});
