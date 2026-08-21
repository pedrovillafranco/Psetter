import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const OVERLAY_FILES = new Set([
  "feedback-host.css",
  "feedback-host.html",
  "feedback-host.js",
  "runtime-config.js",
]);

function assertHttpsUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error(`${label} must be an HTTPS URL without credentials or fragments.`);
  }
  return url;
}

function readConfigString(source, key) {
  const pattern = new RegExp(`\\b${key}\\s*:\\s*["']([^"']*)["']`);
  const match = source.match(pattern);
  if (!match) throw new Error(`Store runtime configuration is missing ${key}.`);
  return match[1];
}

function validateRuntimeConfig(source, location) {
  if (typeof source !== "string" || source.length > 16 * 1024) {
    throw new Error(`Store runtime configuration is invalid: ${location}.`);
  }
  if (/\b(?:eval|Function|importScripts)\s*\(/u.test(source)) {
    throw new Error(`Store runtime configuration contains executable indirection: ${location}.`);
  }
  if (readConfigString(source, "buildChannel") !== "__PSETTER_BUILD_CHANNEL__") {
    throw new Error("Store runtime configuration must contain the build-channel placeholder.");
  }
  const remoteConfigUrl = assertHttpsUrl(readConfigString(source, "remoteConfigUrl"), "remoteConfigUrl");
  if (remoteConfigUrl.pathname !== "/config/v1.json") {
    throw new Error("remoteConfigUrl must point to /config/v1.json.");
  }
  const feedbackPageUrl = assertHttpsUrl(readConfigString(source, "feedbackPageUrl"), "feedbackPageUrl");
  if (feedbackPageUrl.pathname !== "/feedback") {
    throw new Error("feedbackPageUrl must point to /feedback.");
  }
  const feedbackPageOrigin = readConfigString(source, "feedbackPageOrigin");
  const originUrl = assertHttpsUrl(feedbackPageOrigin, "feedbackPageOrigin");
  if (originUrl.pathname !== "/" || originUrl.origin !== feedbackPageUrl.origin) {
    throw new Error("feedbackPageOrigin must match feedbackPageUrl origin.");
  }
  if (remoteConfigUrl.origin !== feedbackPageUrl.origin) {
    throw new Error("remoteConfigUrl must use the feedback service origin.");
  }
  if (readConfigString(source, "feedbackHostPath") !== "feedback-host.html") {
    throw new Error("feedbackHostPath must be feedback-host.html.");
  }
  if (!/\bfeedbackEnabled\s*:\s*true\b/u.test(source)) {
    throw new Error("Store runtime configuration must enable feedback.");
  }
  return {
    remoteConfigOrigin: remoteConfigUrl.origin,
    feedbackOrigin: feedbackPageUrl.origin,
  };
}

export async function loadStoreOverlay(directory) {
  if (typeof directory !== "string" || !directory.trim()) {
    throw new Error("Store packaging requires an explicit --store-overlay directory for the reviewed Store overlay.");
  }
  const overlayDir = path.resolve(directory);
  let entries;
  try {
    entries = await readdir(overlayDir, { withFileTypes: true });
  } catch {
    throw new Error(`Store overlay directory is unavailable: ${overlayDir}`);
  }
  const fileNames = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const unexpected = fileNames.filter((name) => !OVERLAY_FILES.has(name));
  if (unexpected.length > 0 || entries.some((entry) => !entry.isFile())) {
    throw new Error("Store overlay may contain only its reviewed runtime and feedback-host files.");
  }
  for (const name of OVERLAY_FILES) {
    if (!fileNames.includes(name)) throw new Error(`Store overlay is missing ${name}.`);
  }

  const files = Object.fromEntries(
    await Promise.all(
      [...OVERLAY_FILES].map(async (name) => [name, await readFile(path.join(overlayDir, name), "utf8")]),
    ),
  );
  const origins = validateRuntimeConfig(files["runtime-config.js"], "runtime-config.js");
  for (const name of ["feedback-host.html", "feedback-host.css", "feedback-host.js"]) {
    if (files[name].length > 64 * 1024) throw new Error(`Store overlay file is too large: ${name}.`);
    if (/\b(?:eval|Function|importScripts)\s*\(/u.test(files[name])) {
      throw new Error(`Store overlay contains executable indirection: ${name}.`);
    }
  }
  if (!files["feedback-host.js"].includes(origins.feedbackOrigin)) {
    throw new Error("feedback-host.js must target the runtime-config feedback origin.");
  }
  if (!/feedback-host\.css/u.test(files["feedback-host.html"]) || !/feedback-host\.js/u.test(files["feedback-host.html"])) {
    throw new Error("feedback-host.html must reference its reviewed CSS and JavaScript files.");
  }
  return { directory: overlayDir, files, feedbackOrigin: origins.feedbackOrigin };
}

export { OVERLAY_FILES };
