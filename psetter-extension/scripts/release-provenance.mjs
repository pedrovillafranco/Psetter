import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const RELEASE_SCHEMA_VERSION = 1;
export const CANDIDATE_ATTESTATION_VERSION = 1;
export const RELEASE_CHANNELS = new Set(["community", "store"]);

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const VERSION_PATTERN = /^(?:0|[1-9]\d{0,3})(?:\.(?:0|[1-9]\d{0,3})){2,3}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const BUILD_KEYS = new Set([
  "version",
  "channel",
  "publicCommit",
  "overlayCommit",
  "artifact",
  "sha256",
  "packaging",
]);
const PACKAGING_KEYS = new Set(["lockfileSha256", "nodeVersion", "packageManager"]);
const RUNTIME_KEYS = new Set([
  "workerSourceCommit",
  "workerDeploymentId",
  "remoteConfigSha256",
  "smokeTestedAt",
]);

function assertExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} contains unexpected or missing fields.`);
  }
}

function assertVersion(value, label) {
  if (typeof value !== "string" || !VERSION_PATTERN.test(value)) {
    throw new Error(`${label} must be a Chrome-style version.`);
  }
}

export function assertCommit(value, label = "commit") {
  if (typeof value !== "string" || !COMMIT_PATTERN.test(value)) {
    throw new Error(`${label} must be a full 40-character lowercase Git SHA.`);
  }
  return value;
}

export function assertSha256(value, label = "SHA-256") {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a 64-character lowercase hexadecimal SHA-256.`);
  }
  return value;
}

export function assertReleaseChannel(value) {
  if (typeof value !== "string" || !RELEASE_CHANNELS.has(value)) {
    throw new Error("Release channel must be explicitly set to community or store.");
  }
  return value;
}

export function parseReleaseChannel(argv = process.argv.slice(2)) {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--channel") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--channel requires community or store.");
      }
      values.push(value);
      index += 1;
    }
  }
  if (values.length !== 1) {
    throw new Error(
      "An explicit release channel is required; use --channel community or --channel store.",
    );
  }
  return assertReleaseChannel(values[0]);
}

export function readArgument(argv, name, { required = false } = {}) {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== name) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
    values.push(value);
    index += 1;
  }
  if (values.length > 1) throw new Error(`${name} may only be supplied once.`);
  if (required && values.length === 0) throw new Error(`${name} is required.`);
  return values[0] ?? null;
}

export function artifactFileName(version, channel) {
  assertVersion(version, "Artifact version");
  assertReleaseChannel(channel);
  return `psetter-v${version}-${channel}.zip`;
}

export function candidateStateFileName(version, channel) {
  return `${artifactFileName(version, channel).replace(/\.zip$/u, "")}.candidate.json`;
}

export function releaseRecordFileName(version, channel) {
  return `${artifactFileName(version, channel).replace(/\.zip$/u, "")}.release.json`;
}

export async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

export function createBuildIdentity({
  version,
  channel,
  publicCommit,
  overlayCommit,
  artifact,
  sha256,
  lockfileSha256,
  nodeVersion,
  packageManager,
}) {
  assertVersion(version, "Build version");
  assertReleaseChannel(channel);
  assertCommit(publicCommit, "Public commit");
  if (channel === "store") assertCommit(overlayCommit, "Store overlay commit");
  else if (overlayCommit !== null) throw new Error("Community builds cannot have an overlay commit.");
  assertSha256(sha256, "Artifact SHA-256");
  assertSha256(lockfileSha256, "Lockfile SHA-256");
  if (typeof nodeVersion !== "string" || !/^v\d+\.\d+\.\d+/.test(nodeVersion)) {
    throw new Error("Node version is invalid.");
  }
  if (typeof packageManager !== "string" || !/^pnpm@\d+\.\d+\.\d+$/.test(packageManager)) {
    throw new Error("Package manager version is invalid.");
  }
  const expectedArtifact = artifactFileName(version, channel);
  if (artifact !== expectedArtifact) {
    throw new Error(`Artifact must be named ${expectedArtifact}.`);
  }
  return {
    version,
    channel,
    publicCommit,
    overlayCommit,
    artifact,
    sha256,
    packaging: { lockfileSha256, nodeVersion, packageManager },
  };
}

export function validateBuildIdentity(value) {
  assertExactKeys(value, BUILD_KEYS, "Build identity");
  assertExactKeys(value.packaging, PACKAGING_KEYS, "Build packaging identity");
  return createBuildIdentity({
    version: value.version,
    channel: value.channel,
    publicCommit: value.publicCommit,
    overlayCommit: value.overlayCommit,
    artifact: value.artifact,
    sha256: value.sha256,
    lockfileSha256: value.packaging.lockfileSha256,
    nodeVersion: value.packaging.nodeVersion,
    packageManager: value.packaging.packageManager,
  });
}

export function compareBuildIdentity(expected, actual) {
  const left = validateBuildIdentity(expected);
  const right = validateBuildIdentity(actual);
  const mismatches = [];
  for (const field of ["version", "channel", "publicCommit", "overlayCommit", "artifact", "sha256"]) {
    if (left[field] !== right[field]) mismatches.push(field);
  }
  for (const field of ["lockfileSha256", "nodeVersion", "packageManager"]) {
    if (left.packaging[field] !== right.packaging[field]) mismatches.push(`packaging.${field}`);
  }
  return mismatches;
}

export function validateRuntimeAttestation(value, { required = false } = {}) {
  if (value === null && !required) return null;
  assertExactKeys(value, RUNTIME_KEYS, "Runtime attestation");
  assertCommit(value.workerSourceCommit, "Worker source commit");
  if (
    typeof value.workerDeploymentId !== "string" ||
    value.workerDeploymentId.length < 1 ||
    value.workerDeploymentId.length > 160
  ) {
    throw new Error("Worker deployment ID is invalid.");
  }
  assertSha256(value.remoteConfigSha256, "Remote-config SHA-256");
  if (typeof value.smokeTestedAt !== "string" || !ISO_TIMESTAMP_PATTERN.test(value.smokeTestedAt)) {
    throw new Error("Smoke-test timestamp must be an ISO UTC timestamp.");
  }
  if (Number.isNaN(Date.parse(value.smokeTestedAt))) {
    throw new Error("Smoke-test timestamp is invalid.");
  }
  return { ...value };
}

export function createCandidateState({
  build,
  createdAt = new Date().toISOString(),
  runtime = null,
  attestationVersion = CANDIDATE_ATTESTATION_VERSION,
}) {
  const validatedBuild = validateBuildIdentity(build);
  if (attestationVersion !== CANDIDATE_ATTESTATION_VERSION) {
    throw new Error("Candidate attestation schema is unsupported.");
  }
  if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) {
    throw new Error("Candidate creation timestamp is invalid.");
  }
  return {
    attestationVersion: CANDIDATE_ATTESTATION_VERSION,
    schemaVersion: RELEASE_SCHEMA_VERSION,
    kind: "psetter-release-candidate",
    createdAt,
    build: validatedBuild,
    runtime: validateRuntimeAttestation(runtime),
  };
}

export function validateCandidateState(value) {
  assertExactKeys(
    value,
    new Set(["attestationVersion", "schemaVersion", "kind", "createdAt", "build", "runtime"]),
    "Candidate state",
  );
  if (
    value.attestationVersion !== CANDIDATE_ATTESTATION_VERSION ||
    value.schemaVersion !== RELEASE_SCHEMA_VERSION ||
    value.kind !== "psetter-release-candidate"
  ) {
    throw new Error("Candidate state schema is unsupported.");
  }
  return createCandidateState({
    build: value.build,
    createdAt: value.createdAt,
    runtime: value.runtime,
    attestationVersion: value.attestationVersion,
  });
}

export function createReleaseRecord({ build, publicTag, runtime = null }) {
  const validatedBuild = validateBuildIdentity(build);
  if (typeof publicTag !== "string" || publicTag !== `v${validatedBuild.version}`) {
    throw new Error("Public release tag must exactly match the build version.");
  }
  return {
    schemaVersion: RELEASE_SCHEMA_VERSION,
    kind: "psetter-release",
    publicTag,
    build: validatedBuild,
    runtime: validateRuntimeAttestation(runtime, { required: validatedBuild.channel === "store" }),
  };
}
