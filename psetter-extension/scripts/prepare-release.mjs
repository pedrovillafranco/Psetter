import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(scriptDir, "..");
const rootDir = path.resolve(extensionDir, "..");
const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
const expectedTag = `v${manifest.version}`;

function git(...args) {
  const result = spawnSync("git", args, { cwd: rootDir, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

if (git("status", "--porcelain")) {
  throw new Error("Release preparation requires a clean working tree.");
}
const commit = git("rev-parse", "HEAD");
const tags = git("tag", "--points-at", "HEAD").split(/\r?\n/).filter(Boolean);
if (!tags.includes(expectedTag)) {
  throw new Error(`HEAD must be tagged ${expectedTag} before preparing the release artifact.`);
}

const testDir = path.join(extensionDir, "test");
const testFiles = (await readdir(testDir))
  .filter((file) => file.endsWith(".test.mjs"))
  .sort()
  .map((file) => path.join(testDir, file));

for (const arguments_ of [
  [path.join(scriptDir, "check.mjs")],
  ["--test", ...testFiles],
  [path.join(scriptDir, "check-reproducible.mjs")],
]) {
  const result = spawnSync(process.execPath, arguments_, {
    cwd: extensionDir,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (git("status", "--porcelain")) {
  throw new Error("The reproducible build changed tracked files; commit the generated output first.");
}

const artifact = path.join(rootDir, "dist", `psetter-v${manifest.version}.zip`);
const sha256 = createHash("sha256").update(await readFile(artifact)).digest("hex");
const releaseRecord = {
  version: manifest.version,
  tag: expectedTag,
  commit,
  artifact: path.basename(artifact),
  sha256,
};
const recordPath = path.join(rootDir, "dist", `psetter-v${manifest.version}.release.json`);
await writeFile(recordPath, `${JSON.stringify(releaseRecord, null, 2)}\n`, "utf8");
console.log(`Release record written to ${recordPath}`);
