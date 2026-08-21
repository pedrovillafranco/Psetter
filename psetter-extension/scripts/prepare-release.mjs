import { readFile, readdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  artifactFileName,
  compareBuildIdentity,
  createBuildIdentity,
  createReleaseRecord,
  parseReleaseChannel,
  readArgument,
  sha256File,
  validateCandidateState,
} from "./release-provenance.mjs";

const argv = process.argv.slice(2);
const channel = parseReleaseChannel(argv);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(scriptDir, "..");
const rootDir = path.resolve(extensionDir, "..");
const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
const rootPackage = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
const expectedTag = `v${manifest.version}`;
const artifact = artifactFileName(manifest.version, channel);
const candidateStatePath =
  readArgument(argv, "--candidate-state") ??
  path.join(rootDir, "dist", `${artifact.replace(/\.zip$/u, "")}.candidate.json`);
const overlayCommit = channel === "store" ? readArgument(argv, "--overlay-commit", { required: true }) : null;
const storeOverlayPath = readArgument(argv, "--store-overlay");
if (channel === "store" && storeOverlayPath === null) {
  throw new Error("Store release preparation requires --store-overlay.");
}
if (channel !== "store" && storeOverlayPath !== null) {
  throw new Error("A Store overlay may only be used for Store release preparation.");
}

function git(...args) {
  const result = spawnSync("git", args, { cwd: rootDir, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

if (git("status", "--porcelain")) {
  throw new Error("Release preparation requires a clean public worktree.");
}
const commit = git("rev-parse", "HEAD");
const tags = git("tag", "--points-at", "HEAD").split(/\r?\n/).filter(Boolean);
if (!tags.includes(expectedTag)) {
  throw new Error(`HEAD must be tagged ${expectedTag} before preparing the ${channel} artifact.`);
}

const candidate = validateCandidateState(JSON.parse(await readFile(candidateStatePath, "utf8")));
if (candidate.build.version !== manifest.version || candidate.build.channel !== channel) {
  throw new Error("Candidate build identity does not match the release manifest and channel.");
}
if (candidate.build.publicCommit !== commit) {
  throw new Error("Candidate public commit does not match tagged HEAD.");
}
if (channel === "store" && candidate.build.overlayCommit !== overlayCommit) {
  throw new Error("Candidate Store-overlay commit does not match the supplied release input.");
}
if (channel === "store" && candidate.runtime === null) {
  throw new Error("Store release preparation requires a completed runtime attestation.");
}

const testDir = path.join(extensionDir, "test");
const testFiles = (await readdir(testDir))
  .filter((file) => file.endsWith(".test.mjs"))
  .sort()
  .map((file) => path.join(testDir, file));

for (const arguments_ of [
  [path.join(scriptDir, "check.mjs")],
  ["--test", ...testFiles],
  [
    path.join(scriptDir, "check-reproducible.mjs"),
    "--channel",
    channel,
    ...(storeOverlayPath === null ? [] : ["--store-overlay", storeOverlayPath]),
  ],
]) {
  const result = spawnSync(process.execPath, arguments_, {
    cwd: extensionDir,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (git("status", "--porcelain")) {
  throw new Error("The reproducible build changed tracked files; commit generated output first.");
}

const artifactPath = path.join(rootDir, "dist", artifact);
const build = createBuildIdentity({
  version: manifest.version,
  channel,
  publicCommit: commit,
  overlayCommit: channel === "store" ? overlayCommit : null,
  artifact,
  sha256: await sha256File(artifactPath),
  lockfileSha256: await sha256File(path.join(rootDir, "pnpm-lock.yaml")),
  nodeVersion: process.version,
  packageManager: rootPackage.packageManager,
});
const mismatches = compareBuildIdentity(candidate.build, build);
if (mismatches.length > 0) {
  throw new Error(`Final build identity differs from the smoke-tested candidate: ${mismatches.join(", ")}`);
}

const releaseRecord = createReleaseRecord({
  build,
  publicTag: expectedTag,
  runtime: candidate.runtime,
});
const recordPath = path.join(rootDir, "dist", `${artifact.replace(/\.zip$/u, "")}.release.json`);
await writeFile(recordPath, `${JSON.stringify(releaseRecord, null, 2)}\n`, "utf8");
if (git("status", "--porcelain")) {
  throw new Error("Release preparation wrote tracked changes; inspect the worktree before release.");
}
console.log(`Release record written to ${recordPath}`);
console.log(`Release SHA-256 ${build.sha256}  ${artifact}`);
