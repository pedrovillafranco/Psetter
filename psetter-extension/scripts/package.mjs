import { createWriteStream } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { assertPublicZip, assertPublicTree, assertStoreZip } from "./check-boundary.mjs";
import { parseBrowserTarget, renderManifest } from "./browser-target.mjs";
import { artifactFileName, parseReleaseChannel, readArgument } from "./release-provenance.mjs";
import { loadStoreOverlay } from "./store-overlay.mjs";

const require = createRequire(import.meta.url);
const yazl = require("yazl");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(scriptDir, "..");
const rootDir = path.resolve(extensionDir, "..");
const argv = process.argv.slice(2);
const browser = parseBrowserTarget(argv);
const releaseChannel = parseReleaseChannel(argv);
const storeOverlayPath = readArgument(argv, "--store-overlay");
const outputDirArgument = readArgument(argv, "--output-dir");
const outputDir = outputDirArgument ? path.resolve(outputDirArgument) : null;
if (releaseChannel !== "store" && storeOverlayPath !== null) {
  throw new Error("A Store overlay may only be used with --channel store.");
}
const storeOverlay = releaseChannel === "store" ? await loadStoreOverlay(storeOverlayPath) : null;
const buildChannel = "production";
const manifestPath = path.join(extensionDir, "manifest.json");
const sourceManifest = JSON.parse(await readFile(manifestPath, "utf8"));
const targetManifest = renderManifest(sourceManifest, { browser, storeOverlay });
const packageName = browser === "chrome" ? `psetter-${releaseChannel}` : `psetter-${browser}-${releaseChannel}`;
const distDir = path.join(rootDir, "dist");
const packageDir = outputDir
  ? path.join(outputDir, packageName)
  : releaseChannel === "store"
    ? path.join(distDir, packageName)
    : path.join(distDir, "staging", packageName);
const archiveDir = outputDir ?? (releaseChannel === "community" ? path.join(distDir, "staging") : null);
const archive = archiveDir
  ? path.join(archiveDir, artifactFileName(sourceManifest.version, releaseChannel, browser))
  : null;
const fixedZipDate = new Date("1980-01-01T00:00:00.000Z");

const { buildContent } = await import("./build.mjs");
await assertPublicTree(extensionDir, "public extension inputs");
const storeBuildDir = storeOverlay ? await mkdtemp(path.join(tmpdir(), "psetter-store-build-")) : null;
try {
  const builtContentPath = await buildContent({
    runtimeConfigPath: storeOverlay ? path.join(storeOverlay.directory, "runtime-config.js") : null,
    outputPath: storeOverlay ? path.join(storeBuildDir, "content-store.js") : null,
  });
  const productionContent = await readFile(builtContentPath, "utf8");
  if (
    /getQaSnapshot|page_url|raw_latex|visible_psetter_text|PsetterQaHarness|qaTests|qaWait/.test(
      productionContent,
    )
  ) {
    throw new Error("Production content bundle contains development-only QA snapshot code.");
  }
  await rm(packageDir, { recursive: true, force: true });
  await mkdir(packageDir, { recursive: true });

  const releaseFiles = [
    "manifest.json",
    "content.js",
    "content.css",
    "content-theme.css",
    "popup.html",
    "popup.css",
    "popup.js",
    "background.js",
    "runtime-config.js",
    "remote-config.js",
    "demo.html",
    "demo.css",
    "demo.js",
    "THIRD_PARTY_NOTICES.txt",
  ];
  const releaseDirectories = ["vendor"];
  const releaseIconFiles = [
    "icons/icon16.png",
    "icons/icon32.png",
    "icons/icon48.png",
    "icons/icon128.png",
    "icons/psetter-px-logo-white.svg",
  ];

  for (const file of releaseFiles) {
    const sourcePath = file === "content.js" ? builtContentPath : path.join(extensionDir, file);
    await cp(sourcePath, path.join(packageDir, file));
  }
  if (storeOverlay) {
    for (const file of ["feedback-host.html", "feedback-host.css", "feedback-host.js"]) {
      await writeFile(path.join(packageDir, file), storeOverlay.files[file], "utf8");
    }
    await writeFile(path.join(packageDir, "runtime-config.js"), storeOverlay.files["runtime-config.js"], "utf8");
  }
  await writeFile(path.join(packageDir, "manifest.json"), `${JSON.stringify(targetManifest, null, 2)}\n`, "utf8");
  for (const directory of releaseDirectories) {
    await cp(path.join(extensionDir, directory), path.join(packageDir, directory), {
      recursive: true,
    });
  }
  for (const file of releaseIconFiles) {
    await cp(path.join(extensionDir, file), path.join(packageDir, file));
  }

  for (const relativePath of ["runtime-config.js", "content.js"]) {
    const outputPath = path.join(packageDir, relativePath);
    const source = await readFile(outputPath, "utf8");
    const transformed = source.replaceAll("__PSETTER_BUILD_CHANNEL__", buildChannel);
    if (transformed.includes("__PSETTER_BUILD_CHANNEL__")) {
      throw new Error(`Unresolved build channel in ${relativePath}`);
    }
    await writeFile(outputPath, transformed, "utf8");
  }

  const popupPath = path.join(packageDir, "popup.html");
  const popupSource = await readFile(popupPath, "utf8");
  const devBlockPattern = /\s*<!-- PSETTER_DEV_START -->[\s\S]*?<!-- PSETTER_DEV_END -->/;
  const devScriptPattern = /\s*<!-- PSETTER_DEV_SCRIPT_START -->[\s\S]*?<!-- PSETTER_DEV_SCRIPT_END -->/;
  if (devBlockPattern.test(popupSource) || devScriptPattern.test(popupSource)) {
    throw new Error("Production popup contains removed development-only markup.");
  }
  await writeFile(popupPath, popupSource, "utf8");

  // Host permissions do not override an extension page's own CSP. Add only
  // the validated overlay origin; community pages keep their local policy.
  for (const page of ["popup.html", "demo.html"]) {
    const pagePath = path.join(packageDir, page);
    const source = await readFile(pagePath, "utf8");
    if ((source.match(/connect-src 'self'(?=;)/g) ?? []).length !== 1) {
      throw new Error(`Expected one local connect-src directive in ${page}.`);
    }
    const policy = storeOverlay
      ? `connect-src 'self' ${storeOverlay.feedbackOrigin}`
      : "connect-src 'self'";
    await writeFile(pagePath, source.replace("connect-src 'self'", policy), "utf8");
  }

  await normalizeTextFiles(packageDir);

  if (archive) {
    await rm(archive, { force: true });
    await createDeterministicZip(packageDir, archive);
    if (releaseChannel === "store") await assertStoreZip(archive, "Store ZIP", browser);
    else await assertPublicZip(archive, "community ZIP");
    console.log(`Packaged production extension at ${archive}`);
  } else {
    console.log(`Built unpacked Store extension at ${packageDir}`);
  }
} finally {
  if (storeBuildDir) await rm(storeBuildDir, { recursive: true, force: true });
}

async function normalizeTextFiles(directory) {
  const textExtensions = new Set([".css", ".html", ".js", ".json", ".svg", ".txt"]);
  for (const file of await listFiles(directory)) {
    if (!textExtensions.has(path.extname(file.relativePath).toLowerCase())) {
      continue;
    }
    const source = await readFile(file.absolutePath, "utf8");
    const normalized = source.replace(/\r\n?/g, "\n");
    if (normalized !== source) {
      await writeFile(file.absolutePath, normalized, "utf8");
    }
  }
}

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath, relativePath)));
    } else if (entry.isFile()) {
      files.push({ absolutePath, relativePath });
    }
  }
  return files;
}

async function createDeterministicZip(directory, destination) {
  const zip = new yazl.ZipFile();
  for (const file of await listFiles(directory)) {
    const content = await readFile(file.absolutePath);
    zip.addBuffer(content, file.relativePath, {
      mtime: fixedZipDate,
      mode: 0o100644,
      compress: true,
    });
  }
  zip.end({ forceZip64Format: false });
  await pipeline(zip.outputStream, createWriteStream(destination));
}
