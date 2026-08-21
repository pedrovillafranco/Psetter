// Shared community-build configuration. This file is loaded by extension pages
// and bundled into the content script entry. Store-only infrastructure is
// supplied by the separate store build and is intentionally absent here.
globalThis.__psetterConfig = Object.freeze({
  settingsKey: "psetMathSettings",
  symbolsOpenKey: "psetMathSymbolsOpen",
  usageKey: "psetMathUsage",
  developerMessageReadKey: "psetterDeveloperMessageReadId",
  restoreHintKey: "psetterRestoreHintV1",
  remoteConfigKey: "psetterRemoteConfigV1",
  remoteConfigUrl: "",
  remoteConfigTtlMs: 5 * 60 * 1000,
  feedbackPageUrl: "",
  feedbackPageOrigin: "",
  feedbackHostPath: "",
  feedbackEnabled: false,
  buildChannel: "__PSETTER_BUILD_CHANNEL__",
  mitxHostname: "mitx.mit.edu",
});
