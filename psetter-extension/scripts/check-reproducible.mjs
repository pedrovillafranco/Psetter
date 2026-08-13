import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(scriptDir, "..");
const rootDir = path.resolve(extensionDir, "..");
const manifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
const artifact = path.join(rootDir, "dist", `psetter-v${manifest.version}.zip`);

function packageExtension() {
  const result = spawnSync(process.execPath, [path.join(scriptDir, "package.mjs")], {
    cwd: extensionDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    process.exit(result.status ?? 1);
  }
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

packageExtension();
const first = await sha256(artifact);
packageExtension();
const second = await sha256(artifact);
if (first !== second) {
  throw new Error(`Production package is not reproducible: ${first} != ${second}`);
}
console.log(`Reproducible SHA-256 ${second}  ${path.basename(artifact)}`);

