import assert from "node:assert/strict";
import test from "node:test";

const storageState = {};
globalThis.chrome = {
  storage: {
    local: {
      async get(key) {
        if (typeof key === "string") return { [key]: storageState[key] };
        return { ...storageState };
      },
      async set(value) {
        Object.assign(storageState, value);
      },
    },
  },
};
globalThis.fetch = async () => {
  throw new Error("offline");
};

globalThis.__psetterConfig = Object.freeze({
  remoteConfigKey: "testRemoteConfig",
  remoteConfigUrl: "https://config.test/v1.json",
  remoteConfigTtlMs: 300000,
  developerMessageReadKey: "testDeveloperMessageReadId",
});
await import("../remote-config.js");
const api = globalThis.__psetterRemoteConfig;

const validConfig = {
  schemaVersion: 1,
  disabled: false,
  feedbackDisabled: false,
  minimumSupportedVersion: "0.1.0",
  compatibilityWarning: "Update Psetter for the latest MITx compatibility.",
  maintenanceMessage: null,
  developerMessage: {
    id: "welcome-2026-08-13",
    title: "Welcome to Psetter!",
    text: "You’re one of the first people to use Psetter. Have fun streamlining your operations.",
    signature: "- Pedro",
  },
  features: {
    contextSymbols: true,
    symbolSearch: true,
  },
};

test("accepts only the fixed remote configuration schema", () => {
  assert.deepEqual(api.validate(validConfig), validConfig);
});

test("rejects unknown fields and remote command-shaped data", () => {
  assert.equal(api.validate({ ...validConfig, command: "disable-parser" }), null);
  assert.equal(api.validate({ ...validConfig, regex: ".*" }), null);
  assert.equal(
    api.validate({ ...validConfig, features: { ...validConfig.features, parserRules: [] } }),
    null,
  );
});

test("rejects malformed messages and versions", () => {
  assert.equal(api.validate({ ...validConfig, minimumSupportedVersion: "latest" }), null);
  assert.equal(api.validate({ ...validConfig, maintenanceMessage: "x".repeat(241) }), null);
});

test("accepts bounded developer message text and rejects executable-shaped fields", () => {
  assert.deepEqual(
    api.validate({
      ...validConfig,
      developerMessage: {
        id: "notice-1",
        title: "A notice",
        text: "Plain text only",
      },
    }).developerMessage,
    {
      id: "notice-1",
      title: "A notice",
      text: "Plain text only",
      signature: null,
    },
  );
  assert.equal(
    api.validate({
      ...validConfig,
      developerMessage: { ...validConfig.developerMessage, id: "" },
    }),
    null,
  );
  assert.equal(
    api.validate({
      ...validConfig,
      developerMessage: { ...validConfig.developerMessage, title: "x".repeat(121) },
    }),
    null,
  );
  assert.equal(
    api.validate({
      ...validConfig,
      developerMessage: { ...validConfig.developerMessage, text: "x".repeat(1001) },
    }),
    null,
  );
  assert.equal(
    api.validate({
      ...validConfig,
      developerMessage: { ...validConfig.developerMessage, signature: "x".repeat(121) },
    }),
    null,
  );
  assert.equal(
    api.validate({
      ...validConfig,
      developerMessage: { ...validConfig.developerMessage, html: "<b>unsafe</b>" },
    }),
    null,
  );
});

test("tracks unread state and persists dismissal", async () => {
  delete storageState.testDeveloperMessageReadId;
  assert.equal(api.isDeveloperMessageUnread(validConfig.developerMessage, null), true);
  assert.equal(await api.dismissDeveloperMessage(validConfig.developerMessage.id), true);
  assert.equal(await api.readDeveloperMessageReadId(), validConfig.developerMessage.id);
  assert.equal(
    api.isDeveloperMessageUnread(validConfig.developerMessage, validConfig.developerMessage.id),
    false,
  );
});

test("shows a new message ID after an older message was dismissed", () => {
  const newerMessage = { ...validConfig.developerMessage, id: "welcome-2026-08-14" };
  assert.equal(
    api.isDeveloperMessageUnread(newerMessage, validConfig.developerMessage.id),
    true,
  );
});

test("handles no developer message and cached or default offline behavior", async () => {
  assert.equal(api.validate({ ...validConfig, developerMessage: null }).developerMessage, null);
  assert.equal(api.isDeveloperMessageUnread(null, null), false);

  storageState.testRemoteConfig = {
    config: validConfig,
    fetchedAt: Date.now(),
  };
  assert.deepEqual(await api.load({ force: true }), validConfig);

  storageState.testRemoteConfig.fetchedAt = Date.now() - 600001;
  assert.deepEqual(await api.load({ force: true }), api.defaults);
});

test("compares Chrome-style versions", () => {
  assert.equal(api.isVersionBelow("0.0.9", "0.1.0"), true);
  assert.equal(api.isVersionBelow("0.1.0", "0.1.0"), false);
  assert.equal(api.isVersionBelow("1.0.0.1", "1.0.0"), false);
});
