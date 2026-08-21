import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import {
  artifactFileName,
  candidateStateFileName,
  compareBuildIdentity,
  createBuildIdentity,
  createCandidateState,
  createReleaseRecord,
  parseReleaseChannel,
  releaseRecordFileName,
  validateCandidateState,
  validateRuntimeAttestation,
} from "../scripts/release-provenance.mjs";

const extensionDir = fileURLToPath(new URL("../", import.meta.url));
const fullCommit = "a".repeat(40);
const overlayCommit = "b".repeat(40);
const hash = "c".repeat(64);
const lockfileHash = "d".repeat(64);

function build(channel = "community") {
  return createBuildIdentity({
    version: "0.1.1",
    channel,
    publicCommit: fullCommit,
    overlayCommit: channel === "store" ? overlayCommit : null,
    artifact: artifactFileName("0.1.1", channel),
    sha256: hash,
    lockfileSha256: lockfileHash,
    nodeVersion: "v22.0.0",
    packageManager: "pnpm@11.19.0",
  });
}

function rebuild(base, overrides = {}) {
  return createBuildIdentity({
    version: base.version,
    channel: base.channel,
    publicCommit: base.publicCommit,
    overlayCommit: base.overlayCommit,
    artifact: base.artifact,
    sha256: base.sha256,
    lockfileSha256: base.packaging.lockfileSha256,
    nodeVersion: base.packaging.nodeVersion,
    packageManager: base.packaging.packageManager,
    ...overrides,
  });
}

test("release channels are explicit and artifact names are disjoint", () => {
  assert.throws(() => parseReleaseChannel([]), /explicit release channel/);
  assert.equal(parseReleaseChannel(["--channel", "community"]), "community");
  assert.equal(parseReleaseChannel(["--channel", "store"]), "store");
  assert.throws(() => parseReleaseChannel(["--channel", "community", "--channel", "store"]));
  assert.notEqual(artifactFileName("0.1.1", "community"), artifactFileName("0.1.1", "store"));
  assert.notEqual(candidateStateFileName("0.1.1", "community"), candidateStateFileName("0.1.1", "store"));
  assert.notEqual(releaseRecordFileName("0.1.1", "community"), releaseRecordFileName("0.1.1", "store"));
});

test("channel identities reject cross-channel artifacts and overlay provenance", () => {
  const community = build("community");
  assert.throws(
    () => rebuild(community, { artifact: artifactFileName("0.1.1", "store") }),
    /Artifact must be named/,
  );
  assert.throws(
    () => rebuild(community, { overlayCommit }),
    /Community builds cannot have an overlay commit/,
  );
  assert.deepEqual(compareBuildIdentity(community, build("store")), ["channel", "overlayCommit", "artifact"]);
});

test("build identity comparison includes deterministic packaging inputs", () => {
  const candidate = build();
  assert.deepEqual(compareBuildIdentity(candidate, build()), []);
  const changed = { ...candidate, packaging: { ...candidate.packaging, lockfileSha256: hash } };
  assert.deepEqual(compareBuildIdentity(candidate, changed), ["packaging.lockfileSha256"]);
  assert.deepEqual(compareBuildIdentity(candidate, { ...candidate, sha256: lockfileHash }), ["sha256"]);
});

test("Store release records require runtime attestation separately from build identity", () => {
  const runtime = {
    workerSourceCommit: overlayCommit,
    workerDeploymentId: "worker-version-123",
    remoteConfigSha256: hash,
    smokeTestedAt: "2026-08-20T12:00:00.000Z",
  };
  const candidate = createCandidateState({ build: build("store") });
  assert.equal(candidate.attestationVersion, 1);
  assert.equal(candidate.runtime, null);
  assert.throws(() => createReleaseRecord({ build: build("store"), publicTag: "v0.1.1" }), /Runtime attestation/);
  const record = createReleaseRecord({ build: build("store"), publicTag: "v0.1.1", runtime });
  assert.equal(record.publicTag, "v0.1.1");
  assert.equal(record.runtime.workerDeploymentId, "worker-version-123");
  assert.throws(
    () => createReleaseRecord({ build: build("store"), publicTag: "v0.1.0", runtime }),
    /exactly match the build version/,
  );
  assert.deepEqual(validateRuntimeAttestation(runtime), runtime);
  assert.deepEqual(validateCandidateState(candidate), candidate);
  assert.throws(
    () => validateCandidateState({ ...candidate, attestationVersion: 2 }),
    /Candidate state schema is unsupported/,
  );
});

test("Store packaging fails closed without private overlay inputs", () => {
  const script = path.join(extensionDir, "scripts", "package.mjs");
  const result = spawnSync(process.execPath, [script, "--channel", "store"], {
    cwd: extensionDir,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /reviewed Store overlay/);
});

test("bare release preparation fails instead of selecting a channel", async () => {
  const script = path.join(extensionDir, "scripts", "prepare-release.mjs");
  const result = spawnSync(process.execPath, [script], { cwd: extensionDir, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /explicit release channel/);
  assert.match(await readFile(script, "utf8"), /parseReleaseChannel/);
});
