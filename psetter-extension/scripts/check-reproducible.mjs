import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { artifactFileName, parseReleaseChannel, readArgument, sha256File } from "./release-provenance.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(scriptDir, "..");
const rootDir = path.resolve(extensionDir, "..");
const argv = process.argv.slice(2);
const channel = parseReleaseChannel(argv);
const storeOverlayPath = readArgument(argv, "--store-overlay");
if (channel === "store" && storeOverlayPath === null) {
  throw new Error("Store reproducibility requires --store-overlay.");
}
if (channel !== "store" && storeOverlayPath !== null) {
  throw new Error("A Store overlay may only be used for Store reproducibility.");
}
const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
const artifact = path.join(rootDir, "dist", artifactFileName(manifest.version, channel));

function packageExtension() {
  const packageArgs = [path.join(scriptDir, "package.mjs"), "--channel", channel];
  if (storeOverlayPath !== null) packageArgs.push("--store-overlay", storeOverlayPath);
  const result = spawnSync(process.execPath, packageArgs, {
    cwd: extensionDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    process.exit(result.status ?? 1);
  }
}

packageExtension();
const first = await sha256File(artifact);
packageExtension();
const second = await sha256File(artifact);
if (first !== second) {
  throw new Error(`Production package is not reproducible: ${first} != ${second}`);
}
console.log(`Reproducible SHA-256 ${second}  ${path.basename(artifact)}`);
