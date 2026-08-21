import { inflateRawSync } from "node:zlib";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// These are deliberately narrow: broad URL or API-pattern checks would make
// legitimate future community functionality impossible to add.
export const PRIVATE_HOST_PATTERNS = [
  /feedback\.psetter\.villafran\.co/i,
];

export const STORE_ONLY_FILE_NAMES = new Set([
  "feedback-host.html",
  "feedback-host.css",
  "feedback-host.js",
]);

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".svg",
  ".txt",
]);

function assertTextIsPublic(text, location) {
  for (const pattern of PRIVATE_HOST_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(`Public boundary leak in ${location}: ${pattern}`);
    }
  }
}

async function listFiles(directory, relative = "") {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "test") {
      continue;
    }
    const absolute = path.join(directory, entry.name);
    const childRelative = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolute, childRelative)));
    } else if (entry.isFile()) {
      files.push({ absolute, relative: childRelative });
    }
  }
  return files;
}

export async function assertPublicTree(directory, label = "public inputs") {
  for (const file of await listFiles(directory)) {
    if (STORE_ONLY_FILE_NAMES.has(path.basename(file.relative))) {
      throw new Error(`${label} contain store-only file ${file.relative}`);
    }
    if (!TEXT_EXTENSIONS.has(path.extname(file.relative).toLowerCase())) continue;
    assertTextIsPublic(await readFile(file.absolute, "utf8"), `${label}/${file.relative}`);
  }
}

function findEndOfCentralDirectory(bytes) {
  const minimumOffset = Math.max(0, bytes.length - 0xffff - 22);
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("ZIP is missing its end-of-central-directory record.");
}

function readZipEntries(bytes) {
  const end = findEndOfCentralDirectory(bytes);
  const entryCount = bytes.readUInt16LE(end + 10);
  const centralSize = bytes.readUInt32LE(end + 12);
  const centralOffset = bytes.readUInt32LE(end + 16);
  const entries = [];
  let offset = centralOffset;
  const centralEnd = centralOffset + centralSize;
  for (let index = 0; index < entryCount && offset < centralEnd; index += 1) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("ZIP central directory entry is malformed.");
    }
    const compression = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const name = bytes.toString("utf8", offset + 46, offset + 46 + nameLength);
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    let content;
    if (compression === 0) content = compressed;
    else if (compression === 8) content = inflateRawSync(compressed);
    else throw new Error(`Unsupported ZIP compression method for ${name}.`);
    entries.push({ name, content });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export async function assertPublicZip(zipPath, label = "community ZIP") {
  const bytes = await readFile(zipPath);
  for (const entry of readZipEntries(bytes)) {
    if (STORE_ONLY_FILE_NAMES.has(path.posix.basename(entry.name))) {
      throw new Error(`${label} contains store-only file ${entry.name}`);
    }
    const extension = path.posix.extname(entry.name).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension)) continue;
    assertTextIsPublic(entry.content.toString("utf8"), `${label}/${entry.name}`);
  }
}
