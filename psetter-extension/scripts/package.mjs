import { createWriteStream } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const yazl = require("yazl");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(scriptDir, "..");
const rootDir = path.resolve(extensionDir, "..");
const isDev = process.argv.includes("--dev");
const channel = isDev ? "dev" : "production";
const manifestPath = path.join(extensionDir, "manifest.json");
const sourceManifest = JSON.parse(await readFile(manifestPath, "utf8"));
const packageName = isDev ? "psetter-dev" : "psetter";
const packageDir = path.join(rootDir, "dist", packageName);
const archive = path.join(rootDir, "dist", `psetter-v${sourceManifest.version}.zip`);
const fixedZipDate = new Date("1980-01-01T00:00:00.000Z");

const { builtContentPath } = await import("./build.mjs");
if (!isDev) {
  const productionContent = await readFile(builtContentPath, "utf8");
  if (
    /getQaSnapshot|page_url|raw_latex|visible_psetter_text|PsetterQaHarness|qaTests|qaWait/.test(
      productionContent,
    )
  ) {
    throw new Error("Production content bundle contains development-only QA snapshot code.");
  }
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
  "runtime-config.js",
  "remote-config.js",
  "feedback-host.html",
  "feedback-host.css",
  "feedback-host.js",
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
if (isDev) {
  await cp(path.join(extensionDir, "popup-dev.js"), path.join(packageDir, "popup-dev.js"));
}
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
  const transformed = source.replaceAll("__PSETTER_BUILD_CHANNEL__", channel);
  if (transformed.includes("__PSETTER_BUILD_CHANNEL__")) {
    throw new Error(`Unresolved build channel in ${relativePath}`);
  }
  await writeFile(outputPath, transformed, "utf8");
}

const popupPath = path.join(packageDir, "popup.html");
const popupSource = await readFile(popupPath, "utf8");
const devBlockPattern = /\s*<!-- PSETTER_DEV_START -->[\s\S]*?<!-- PSETTER_DEV_END -->/;
const devScriptPattern = /\s*<!-- PSETTER_DEV_SCRIPT_START -->[\s\S]*?<!-- PSETTER_DEV_SCRIPT_END -->/;
if (isDev) {
  await writeFile(
    popupPath,
    popupSource
      .replaceAll("<!-- PSETTER_DEV_START -->", "")
      .replaceAll("<!-- PSETTER_DEV_END -->", "")
      .replaceAll("<!-- PSETTER_DEV_SCRIPT_START -->", "")
      .replaceAll("<!-- PSETTER_DEV_SCRIPT_END -->", ""),
    "utf8",
  );
} else {
  if (!devBlockPattern.test(popupSource) || !devScriptPattern.test(popupSource)) {
    throw new Error("Missing marked development-only popup content");
  }
  await writeFile(
    popupPath,
    popupSource.replace(devBlockPattern, "").replace(devScriptPattern, ""),
    "utf8",
  );
}

await normalizeTextFiles(packageDir);

if (isDev) {
  const devManifest = {
    ...sourceManifest,
    name: "Psetter Dev",
    short_name: "Psetter Dev",
    version_name: `${sourceManifest.version} dev`,
    description: `[Development build] ${sourceManifest.description}`,
    action: {
      ...sourceManifest.action,
      default_title: "Psetter Dev",
    },
  };
  await writeFile(
    path.join(packageDir, "manifest.json"),
    `${JSON.stringify(devManifest, null, 2)}\n`,
    "utf8",
  );
  await rm(path.dirname(builtContentPath), { recursive: true, force: true });
  console.log(`Built unpacked development extension at ${packageDir}`);
} else {
  await rm(archive, { force: true });
  await createDeterministicZip(packageDir, archive);
  console.log(`Packaged production extension at ${archive}`);
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
