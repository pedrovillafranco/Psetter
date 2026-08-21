"use strict";

(() => {
  const CONFIG = globalThis.__psetterConfig ?? {};
  const CACHE_KEY = CONFIG.remoteConfigKey ?? "psetterRemoteConfigV1";
  const CONFIG_URL = CONFIG.remoteConfigUrl ?? "";
  const REMOTE_CONFIG_ENABLED = Boolean(CONFIG_URL);
  const CACHE_TTL_MS = Number.isFinite(CONFIG.remoteConfigTtlMs)
    ? Math.max(60_000, Math.min(CONFIG.remoteConfigTtlMs, 60 * 60 * 1000))
    : 5 * 60 * 1000;
  const MAX_RESPONSE_BYTES = 4096;
  const MESSAGE_MAX_LENGTH = 240;
  const DEVELOPER_MESSAGE_ID_MAX_LENGTH = 80;
  const DEVELOPER_MESSAGE_TITLE_MAX_LENGTH = 120;
  const DEVELOPER_MESSAGE_TEXT_MAX_LENGTH = 1000;
  const DEVELOPER_MESSAGE_SIGNATURE_MAX_LENGTH = 120;
  const DEVELOPER_MESSAGE_READ_KEY =
    CONFIG.developerMessageReadKey ?? "psetterDeveloperMessageReadId";
  const DEFAULT_CONFIG = deepFreeze({
    schemaVersion: 1,
    disabled: false,
    feedbackDisabled: CONFIG.feedbackEnabled !== true,
    minimumSupportedVersion: null,
    compatibilityWarning: null,
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
  });

  function deepFreeze(value) {
    if (value && typeof value === "object") {
      Object.freeze(value);
      for (const child of Object.values(value)) deepFreeze(child);
    }
    return value;
  }

  function hasOnlyKeys(value, allowed) {
    return Object.keys(value).every((key) => allowed.has(key));
  }

  function isNullableMessage(value) {
    return (
      value === null ||
      (typeof value === "string" && value.length > 0 && value.length <= MESSAGE_MAX_LENGTH)
    );
  }

  function isSingleLineText(value, maximumLength) {
    return (
      typeof value === "string" &&
      value.length > 0 &&
      value.length <= maximumLength &&
      !/[\u0000-\u001f\u007f]/.test(value)
    );
  }

  function isDeveloperMessageId(value) {
    return (
      typeof value === "string" &&
      value.length > 0 &&
      value.length <= DEVELOPER_MESSAGE_ID_MAX_LENGTH &&
      /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
    );
  }

  function validateDeveloperMessage(value) {
    if (value === null || value === undefined) return null;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const allowedKeys = new Set(["id", "title", "text", "signature"]);
    if (!hasOnlyKeys(value, allowedKeys)) return null;
    if (!isDeveloperMessageId(value.id)) return null;
    if (!isSingleLineText(value.title, DEVELOPER_MESSAGE_TITLE_MAX_LENGTH)) return null;
    if (
      typeof value.text !== "string" ||
      value.text.length === 0 ||
      value.text.length > DEVELOPER_MESSAGE_TEXT_MAX_LENGTH ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.text)
    ) {
      return null;
    }
    if (
      value.signature !== undefined &&
      value.signature !== null &&
      !isSingleLineText(value.signature, DEVELOPER_MESSAGE_SIGNATURE_MAX_LENGTH)
    ) {
      return null;
    }
    return {
      id: value.id,
      title: value.title,
      text: value.text,
      signature: value.signature ?? null,
    };
  }

  function isVersion(value) {
    return value === null || /^(?:0|[1-9]\d{0,3})(?:\.(?:0|[1-9]\d{0,3})){2,3}$/.test(value);
  }

  function validate(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const allowedTopLevel = new Set([
      "schemaVersion",
      "disabled",
      "feedbackDisabled",
      "minimumSupportedVersion",
      "compatibilityWarning",
      "maintenanceMessage",
      "developerMessage",
      "features",
    ]);
    if (!hasOnlyKeys(value, allowedTopLevel) || value.schemaVersion !== 1) return null;
    if (typeof value.disabled !== "boolean" || typeof value.feedbackDisabled !== "boolean") {
      return null;
    }
    if (!isVersion(value.minimumSupportedVersion)) return null;
    if (!isNullableMessage(value.compatibilityWarning)) return null;
    if (!isNullableMessage(value.maintenanceMessage)) return null;
    const developerMessage = validateDeveloperMessage(value.developerMessage);
    if (
      value.developerMessage !== undefined &&
      developerMessage === null &&
      value.developerMessage !== null
    ) {
      return null;
    }
    const features = value.features;
    if (!features || typeof features !== "object" || Array.isArray(features)) return null;
    const allowedFeatures = new Set(["contextSymbols", "symbolSearch"]);
    if (!hasOnlyKeys(features, allowedFeatures)) return null;
    if (typeof features.contextSymbols !== "boolean" || typeof features.symbolSearch !== "boolean") {
      return null;
    }
    return deepFreeze({
      schemaVersion: 1,
      disabled: value.disabled,
      feedbackDisabled: value.feedbackDisabled,
      minimumSupportedVersion: value.minimumSupportedVersion,
      compatibilityWarning: value.compatibilityWarning,
      maintenanceMessage: value.maintenanceMessage,
      developerMessage,
      features: {
        contextSymbols: features.contextSymbols,
        symbolSearch: features.symbolSearch,
      },
    });
  }

  function compareVersions(left, right) {
    const a = String(left ?? "").split(".").map(Number);
    const b = String(right ?? "").split(".").map(Number);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      const difference = (a[index] ?? 0) - (b[index] ?? 0);
      if (difference !== 0) return difference < 0 ? -1 : 1;
    }
    return 0;
  }

  function isVersionBelow(currentVersion, minimumVersion) {
    return typeof minimumVersion === "string" && compareVersions(currentVersion, minimumVersion) < 0;
  }

  function getExtensionApi() {
    try {
      return globalThis.chrome ?? null;
    } catch {
      return null;
    }
  }

  async function readCache() {
    try {
      const storage = getExtensionApi()?.storage?.local;
      if (!storage?.get) return null;
      const result = await storage.get(CACHE_KEY);
      const cached = result?.[CACHE_KEY];
      const config = validate(cached?.config);
      const fetchedAt = cached?.fetchedAt;
      if (!config || !Number.isFinite(fetchedAt) || fetchedAt <= 0) return null;
      return { config, fetchedAt };
    } catch {
      return null;
    }
  }

  async function writeCache(config, fetchedAt) {
    try {
      const storage = getExtensionApi()?.storage?.local;
      if (storage?.set) await storage.set({ [CACHE_KEY]: { config, fetchedAt } });
    } catch {}
  }

  function normalizeDeveloperMessageReadId(value) {
    return isDeveloperMessageId(value) ? value : null;
  }

  async function readDeveloperMessageReadId() {
    try {
      const storage = getExtensionApi()?.storage?.local;
      if (!storage?.get) return null;
      const result = await storage.get(DEVELOPER_MESSAGE_READ_KEY);
      return normalizeDeveloperMessageReadId(result?.[DEVELOPER_MESSAGE_READ_KEY]);
    } catch {
      return null;
    }
  }

  async function dismissDeveloperMessage(id) {
    const normalizedId = normalizeDeveloperMessageReadId(id);
    if (!normalizedId) return false;
    try {
      const storage = getExtensionApi()?.storage?.local;
      if (!storage?.set) return false;
      await storage.set({ [DEVELOPER_MESSAGE_READ_KEY]: normalizedId });
      return true;
    } catch {
      return false;
    }
  }

  function isDeveloperMessageUnread(message, readId) {
    return Boolean(message && isDeveloperMessageId(message.id) && message.id !== readId);
  }

  async function fetchConfig() {
    if (!CONFIG_URL) return null;
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(CONFIG_URL, {
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const contentType = response.headers.get("Content-Type") ?? "";
      if (!contentType.toLowerCase().includes("application/json")) return null;
      const declaredLength = Number(response.headers.get("Content-Length") ?? 0);
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) return null;
      const text = await readBoundedText(response, MAX_RESPONSE_BYTES);
      if (text === null) return null;
      return validate(JSON.parse(text));
    } catch {
      return null;
    } finally {
      globalThis.clearTimeout(timeout);
    }
  }

  async function readBoundedText(response, maximumBytes) {
    if (!response.body?.getReader) {
      const text = await response.text();
      return new TextEncoder().encode(text).byteLength <= maximumBytes ? text : null;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let received = 0;
    let text = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > maximumBytes) {
          await reader.cancel();
          return null;
        }
        text += decoder.decode(value, { stream: true });
      }
      return text + decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }

  let pendingLoad;
  async function loadCached() {
    if (!REMOTE_CONFIG_ENABLED) return DEFAULT_CONFIG;
    const cached = await readCache();
    return cached && (cached.config.disabled || Date.now() - cached.fetchedAt < CACHE_TTL_MS)
      ? cached.config
      : DEFAULT_CONFIG;
  }

  async function load(options = {}) {
    if (!REMOTE_CONFIG_ENABLED) return DEFAULT_CONFIG;
    if (pendingLoad) return pendingLoad;
    pendingLoad = (async () => {
      const now = Date.now();
      const cached = await readCache();
      if (!options.force && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.config;
      }
      const remote = await fetchConfig();
      if (remote) {
        await writeCache(remote, now);
        return remote;
      }
      return cached && (cached.config.disabled || now - cached.fetchedAt < CACHE_TTL_MS)
        ? cached.config
        : DEFAULT_CONFIG;
    })();
    try {
      return await pendingLoad;
    } finally {
      pendingLoad = null;
    }
  }

  globalThis.__psetterRemoteConfig = Object.freeze({
    defaults: DEFAULT_CONFIG,
    validate,
    remoteConfigKey: CACHE_KEY,
    developerMessageReadKey: DEVELOPER_MESSAGE_READ_KEY,
    normalizeDeveloperMessageReadId,
    readDeveloperMessageReadId,
    dismissDeveloperMessage,
    isDeveloperMessageUnread,
    compareVersions,
    isVersionBelow,
    loadCached,
    load,
  });
})();
