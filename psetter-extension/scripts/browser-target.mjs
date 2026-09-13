export const BROWSER_TARGETS = new Set(["chrome", "firefox"]);
export const FIREFOX_EXTENSION_ID = "psetter@villafran.co";
export const FIREFOX_MIN_VERSION = "128.0";

export function assertBrowserTarget(value) {
  if (typeof value !== "string" || !BROWSER_TARGETS.has(value)) {
    throw new Error("Browser target must be chrome or firefox.");
  }
  return value;
}

export function parseBrowserTarget(argv = process.argv.slice(2)) {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--browser") continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("--browser requires chrome or firefox.");
    }
    values.push(value);
    index += 1;
  }
  if (values.length > 1) throw new Error("--browser may only be supplied once.");
  return assertBrowserTarget(values[0] ?? "chrome");
}

export function renderManifest(sourceManifest, { browser = "chrome", storeOverlay = null } = {}) {
  assertBrowserTarget(browser);
  const manifest = structuredClone(sourceManifest);
  if (browser === "firefox") {
    delete manifest.minimum_chrome_version;
    manifest.background = { scripts: ["background.js"] };
    manifest.browser_specific_settings = {
      gecko: {
        id: FIREFOX_EXTENSION_ID,
        strict_min_version: FIREFOX_MIN_VERSION,
        data_collection_permissions: { required: ["none"] },
      },
    };
  } else {
    delete manifest.browser_specific_settings;
    manifest.background = { service_worker: "background.js" };
  }
  if (storeOverlay) {
    manifest.host_permissions = [
      ...(manifest.host_permissions ?? []),
      `${storeOverlay.feedbackOrigin}/*`,
    ];
    manifest.web_accessible_resources = [
      ...(manifest.web_accessible_resources ?? []),
      {
        resources: ["feedback-host.html"],
        matches: ["https://*.mitx.mit.edu/*"],
      },
    ];
  }
  return manifest;
}
