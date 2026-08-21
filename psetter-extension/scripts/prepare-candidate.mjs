import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  artifactFileName,
  assertCommit,
  createBuildIdentity,
  createCandidateState,
  parseReleaseChannel,
  readArgument,
  sha256File,
} from "./release-provenance.mjs";

const argv = process.argv.slice(2);
const channel = parseReleaseChannel(argv);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(scriptDir, "..");
const rootDir = path.resolve(extensionDir, "..");
const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
const rootPackage = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
const overlayCommit = channel === "store" ? readArgument(argv, "--overlay-commit", { required: true }) : null;
const storeOverlayPath = readArgument(argv, "--store-overlay");
if (overlayCommit !== null) assertCommit(overlayCommit, "Store overlay commit");
if (channel === "store" && storeOverlayPath === null) {
  throw new Error("Store candidate preparation requires --store-overlay.");
}
if (channel !== "store" && storeOverlayPath !== null) {
  throw new Error("A Store overlay may only be used for Store candidates.");
}

function git(...args) {
  const result = spawnSync("git", args, { cwd: rootDir, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

if (git("status", "--porcelain")) {
  throw new Error("Candidate preparation requires a clean public worktree.");
}
const publicCommit = assertCommit(git("rev-parse", "HEAD"), "Public commit");
const reproducible = spawnSync(
  process.execPath,
  [
    path.join(scriptDir, "check-reproducible.mjs"),
    "--channel",
    channel,
    ...(storeOverlayPath === null ? [] : ["--store-overlay", storeOverlayPath]),
  ],
  { cwd: extensionDir, stdio: "inherit" },
);
if (reproducible.status !== 0) process.exit(reproducible.status ?? 1);

const artifact = artifactFileName(manifest.version, channel);
const artifactPath = path.join(rootDir, "dist", artifact);
const lockfileSha256 = await sha256File(path.join(rootDir, "pnpm-lock.yaml"));
const build = createBuildIdentity({
  version: manifest.version,
  channel,
  publicCommit,
  overlayCommit,
  artifact,
  sha256: await sha256File(artifactPath),
  lockfileSha256,
  nodeVersion: process.version,
  packageManager: rootPackage.packageManager,
});
const state = createCandidateState({ build });
const statePath = path.join(rootDir, "dist", `${artifact.replace(/\.zip$/u, "")}.candidate.json`);
await mkdir(path.dirname(statePath), { recursive: true });
await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
console.log(`Candidate attestation written to ${statePath}`);
console.log(`Candidate SHA-256 ${build.sha256}  ${artifact}`);
