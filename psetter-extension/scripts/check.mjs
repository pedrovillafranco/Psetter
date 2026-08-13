import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const extensionDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(extensionDir, "..", "..");

const checks = [
  ["content runtime", path.join(extensionDir, "..", "src", "content-runtime.js")],
  ["popup", path.join(extensionDir, "..", "popup.js")],
  ["development popup", path.join(extensionDir, "..", "popup-dev.js")],
  ["remote config", path.join(extensionDir, "..", "remote-config.js")],
  ["feedback host", path.join(extensionDir, "..", "feedback-host.js")],
  ["local demo", path.join(extensionDir, "..", "demo.js")],
];

for (const [label, file] of checks) {
  if (!existsSync(file)) throw new Error(`Missing ${label}: ${file}`);
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: rootDir,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const manifest = JSON.parse(
  readFileSync(path.join(extensionDir, "..", "manifest.json"), "utf8"),
);
const extensionPackage = JSON.parse(
  readFileSync(path.join(extensionDir, "..", "package.json"), "utf8"),
);
const rootPackage = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Production must use Manifest V3.");
if (
  manifest.version !== extensionPackage.version ||
  manifest.version !== rootPackage.version
) {
  throw new Error("Root package, extension package, and manifest versions must match.");
}
if (JSON.stringify(manifest.permissions ?? []) !== JSON.stringify(["storage"])) {
  throw new Error("The storage permission must remain the only API permission.");
}
const expectedHosts = [
  "https://*.mitx.mit.edu/*",
  "https://feedback.psetter.villafran.co/*",
];
if (JSON.stringify(manifest.host_permissions ?? []) !== JSON.stringify(expectedHosts)) {
  throw new Error("Host permissions differ from the reviewed MITx and Feedback scope.");
}
const declaredFiles = [
  ...(manifest.content_scripts ?? []).flatMap((script) => [
    ...(script.js ?? []),
    ...(script.css ?? []),
  ]),
  ...(manifest.icons ? Object.values(manifest.icons) : []),
  ...(manifest.action?.default_icon ? Object.values(manifest.action.default_icon) : []),
];
for (const file of declaredFiles) {
  if (!existsSync(path.join(extensionDir, "..", file))) {
    throw new Error(`Manifest references missing file: ${file}`);
  }
}

console.log("Extension syntax checks passed.");
