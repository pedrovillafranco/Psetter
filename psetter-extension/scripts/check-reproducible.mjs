import { copyFile, mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseBrowserTarget } from "./browser-target.mjs";
import { artifactFileName, parseReleaseChannel, readArgument, sha256File } from "./release-provenance.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(scriptDir, "..");
const rootDir = path.resolve(extensionDir, "..");
const argv = process.argv.slice(2);
const channel = parseReleaseChannel(argv);
const browser = parseBrowserTarget(argv);
const storeOverlayPath = readArgument(argv, "--store-overlay");
if (channel === "store" && storeOverlayPath === null) {
  throw new Error("Store reproducibility requires --store-overlay.");
}
if (channel !== "store" && storeOverlayPath !== null) {
  throw new Error("A Store overlay may only be used for Store reproducibility.");
}
const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
const artifactName = artifactFileName(manifest.version, channel, browser);
const artifact = path.join(rootDir, "dist", "staging", artifactName);
const packageOutputDir = await mkdtemp(path.join(tmpdir(), "psetter-reproducible-build-"));

function packageExtension() {
  const packageArgs = [path.join(scriptDir, "package.mjs"), "--channel", channel, "--browser", browser];
  if (storeOverlayPath !== null) packageArgs.push("--store-overlay", storeOverlayPath);
  packageArgs.push("--output-dir", packageOutputDir);
  const result = spawnSync(process.execPath, packageArgs, {
    cwd: extensionDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`Package generation failed with status ${result.status ?? "unknown"}.`);
  }
}

try {
  packageExtension();
  const stagedArtifact = path.join(packageOutputDir, artifactName);
  const first = await sha256File(stagedArtifact);
  packageExtension();
  const second = await sha256File(stagedArtifact);
  if (first !== second) {
    throw new Error(`Production package is not reproducible: ${first} != ${second}`);
  }
  await mkdir(path.dirname(artifact), { recursive: true });
  await copyFile(stagedArtifact, artifact);
  console.log(`Reproducible SHA-256 ${second}  ${artifactName}`);
} finally {
  await rm(packageOutputDir, { recursive: true, force: true });
}
