import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  assertCommit,
  assertSha256,
  artifactFileName,
  parseReleaseChannel,
  readArgument,
  validateCandidateState,
} from "./release-provenance.mjs";

const argv = process.argv.slice(2);
const channel = parseReleaseChannel(argv);
if (channel !== "store") throw new Error("Runtime attestation is only required for Store candidates.");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(scriptDir, "..");
const rootDir = path.resolve(extensionDir, "..");
const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
const defaultStatePath = path.join(
  rootDir,
  "dist",
  `${artifactFileName(manifest.version, channel).replace(/\.zip$/u, "")}.candidate.json`,
);
const statePath = readArgument(argv, "--candidate-state") ?? defaultStatePath;
const state = validateCandidateState(JSON.parse(await readFile(statePath, "utf8")));
if (state.build.channel !== channel || state.build.version !== manifest.version) {
  throw new Error("Candidate state channel or version does not match the current manifest.");
}

function git(...args) {
  const result = spawnSync("git", args, { cwd: rootDir, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

if (git("status", "--porcelain")) {
  throw new Error("Runtime attestation requires the unchanged clean public worktree used for the candidate.");
}
if (assertCommit(git("rev-parse", "HEAD"), "Public commit") !== state.build.publicCommit) {
  throw new Error("Public HEAD does not match the candidate build identity.");
}

const runtime = {
  workerSourceCommit: assertCommit(
    readArgument(argv, "--worker-source-commit", { required: true }),
    "Worker source commit",
  ),
  workerDeploymentId: readArgument(argv, "--worker-deployment-id", { required: true }),
  remoteConfigSha256: assertSha256(
    readArgument(argv, "--remote-config-sha256", { required: true }),
    "Remote-config SHA-256",
  ),
  smokeTestedAt: readArgument(argv, "--smoke-tested-at", { required: true }),
};
const updated = validateCandidateState({ ...state, runtime });
await writeFile(statePath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
console.log(`Runtime attestation written to ${statePath}`);
