// Shared extension configuration. This file is loaded by the popup/feedback
// pages and bundled into the content script entry.
globalThis.__psetterConfig = Object.freeze({
  settingsKey: "psetMathSettings",
  symbolsOpenKey: "psetMathSymbolsOpen",
  usageKey: "psetMathUsage",
  developerMessageReadKey: "psetterDeveloperMessageReadId",
  restoreHintKey: "psetterRestoreHintV1",
  remoteConfigKey: "psetterRemoteConfigV1",
  remoteConfigUrl: "https://feedback.psetter.villafran.co/config/v1.json",
  remoteConfigTtlMs: 5 * 60 * 1000,
  feedbackPageUrl: "https://feedback.psetter.villafran.co/feedback",
  buildChannel: "__PSETTER_BUILD_CHANNEL__",
  mitxHostname: "mitx.mit.edu",
});
