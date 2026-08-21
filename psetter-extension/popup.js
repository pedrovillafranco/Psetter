"use strict";

(() => {
  const CONFIG = globalThis.__psetterConfig ?? {};
  const REMOTE_API = globalThis.__psetterRemoteConfig;
  const SETTINGS_KEY = CONFIG.settingsKey ?? "psetMathSettings";
  const BUILD_CHANNEL = CONFIG.buildChannel ?? "production";
  const USAGE_KEY = CONFIG.usageKey ?? "psetMathUsage";
  const FEEDBACK_PAGE_URL = CONFIG.feedbackPageUrl ?? "";
  const FEEDBACK_PAGE_ORIGIN = CONFIG.feedbackPageOrigin ?? "";
  const FEEDBACK_ENABLED = CONFIG.feedbackEnabled === true;
  const SECONDS_SAVED_PER_OPERATION = 0.3;
  const defaults = {
    enabled: true,
    inlineEnabledDefault: true,
    defaultMode: "numeric",
    showGenericFields: false,
    openDetails: false,
  };
  function getExtensionApi() {
    try {
      return globalThis.chrome ?? null;
    } catch {
      return null;
    }
  }

  function isContextInvalidatedError(error) {
    return /Extension context invalidated/i.test(
      error instanceof Error ? error.message : String(error ?? ""),
    );
  }

  window.addEventListener("unhandledrejection", (event) => {
    if (isContextInvalidatedError(event.reason)) event.preventDefault();
  });

  function isMode(value) {
    return value === "numeric" || value === "symbolic" || value === "literal";
  }

  function normalizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    const isEnabled =
      typeof source.enabled === "boolean" ? source.enabled : defaults.enabled;
    return {
      enabled: isEnabled,
      inlineEnabledDefault: isEnabled,
      defaultMode: isMode(source.defaultMode)
        ? source.defaultMode
        : defaults.defaultMode,
      showGenericFields:
        typeof source.showGenericFields === "boolean"
          ? source.showGenericFields
          : defaults.showGenericFields,
      openDetails:
        typeof source.openDetails === "boolean"
          ? source.openDetails
          : defaults.openDetails,
    };
  }

  function getNode(selector) {
    const node = document.querySelector(selector);
    if (!node) throw new Error(`Missing popup element: ${selector}`);
    return node;
  }

  const enabled = getNode("#enabled");
  const enabledLabel = getNode("#enabledLabel");
  const brand = getNode(".brand");
  const operationsCount = getNode("#operationsCount");
  const timeSaved = getNode("#timeSaved");
  const impactRangeOptions = [...document.querySelectorAll(".impact-range-option")];
  const resetUsage = getNode("#resetUsage");
  const openDemo = getNode("#openDemo");
  const buildBadge = getNode("#buildBadge");
  const remoteNotice = getNode("#remoteNotice");
  const remoteNoticeTitle = getNode("#remoteNoticeTitle");
  const remoteNoticeMessage = getNode("#remoteNoticeMessage");
  const feedbackLink = getNode("#feedbackLink");
  const extensionVersion = getNode("#extensionVersion");
  const developerMessageNotice = getNode("#developerMessageNotice");
  const developerMessageTeaser = getNode("#developerMessageTeaser");
  const developerMessageOpen = getNode("#developerMessageOpen");
  const developerMessagePanel = getNode("#developerMessagePanel");
  const developerMessageTitle = getNode("#developerMessageTitle");
  const developerMessageText = getNode("#developerMessageText");
  const developerMessageSignature = getNode("#developerMessageSignature");
  const developerMessageClose = getNode("#developerMessageClose");

  let settings = defaults;
  let usage = { safeTermCombinations: 0, dailySafeTermCombinations: {} };
  let selectedImpactRange = "all";
  let developerMessageReadId = null;
  let developerMessagePanelOpen = false;
  let remoteConfig = REMOTE_API?.defaults ?? {
    disabled: false,
    feedbackDisabled: !FEEDBACK_ENABLED,
    minimumSupportedVersion: null,
    compatibilityWarning: null,
    maintenanceMessage: null,
    developerMessage: null,
    features: { contextSymbols: true, symbolSearch: true },
  };

  async function loadSettings() {
    try {
      const api = getExtensionApi();
        if (!api?.storage?.local?.get) return defaults;
        const result = await api.storage.local.get(SETTINGS_KEY);
        return normalizeSettings(result[SETTINGS_KEY]);
    } catch {
      return defaults;
    }
  }

  async function saveSettings() {
    try {
      const api = getExtensionApi();
      if (!api?.storage?.local?.set) return false;
      await api.storage.local.set({ [SETTINGS_KEY]: settings });
      return true;
    } catch {
      return false;
    }
  }

  async function loadUsage() {
    try {
      const api = getExtensionApi();
      if (!api?.storage?.local) return usage;
      const result = await api.storage.local.get(USAGE_KEY);
      return normalizeUsage(result[USAGE_KEY]);
    } catch {
      return usage;
    }
  }

  function normalizeUsage(value) {
    const total = value?.safeTermCombinations;
    const daily = value?.dailySafeTermCombinations;
    return {
      safeTermCombinations: Number.isSafeInteger(total) && total >= 0 ? total : 0,
      dailySafeTermCombinations:
        daily && typeof daily === "object" ? daily : {},
    };
  }

  function renderSettings() {
    const effectiveEnabled = settings.enabled && !remoteConfig.disabled;
    enabled.checked = settings.enabled;
    enabled.disabled = remoteConfig.disabled;
    enabledLabel.textContent = remoteConfig.disabled ? "Paused" : settings.enabled ? "On" : "Off";
    brand.classList.toggle("is-enabled", effectiveEnabled);
  }

  function renderBuildChannel() {
    const isDev = BUILD_CHANNEL === "dev";
    document.body.classList.toggle("is-dev-build", isDev);
    buildBadge.hidden = !isDev;
  }

  function renderVersion() {
    const version = getExtensionApi()?.runtime?.getManifest?.().version ?? "0.0.0";
    extensionVersion.textContent = `v${version}`;
  }

  function renderRemoteConfig() {
    const version = getExtensionApi()?.runtime?.getManifest?.().version ?? "0.0.0";
    const needsUpdate = REMOTE_API?.isVersionBelow?.(
      version,
      remoteConfig.minimumSupportedVersion,
    );
    let title = "";
    let message = "";
    let tone = "info";
    if (remoteConfig.disabled) {
      title = "Psetter is temporarily paused";
      message = remoteConfig.maintenanceMessage || "The editor has been disabled while a compatibility issue is resolved.";
      tone = "error";
    } else if (needsUpdate) {
      title = "Update recommended";
      message = remoteConfig.compatibilityWarning || "A newer Psetter version is required for current MITx compatibility.";
      tone = "warning";
    } else if (remoteConfig.maintenanceMessage) {
      title = "Service notice";
      message = remoteConfig.maintenanceMessage;
    }
    remoteNotice.hidden = !message;
    remoteNotice.className = `remote-notice ${tone}`;
    remoteNoticeTitle.textContent = title;
    remoteNoticeMessage.textContent = message;
    const feedbackUnavailable = remoteConfig.feedbackDisabled || !FEEDBACK_ENABLED;
    feedbackLink.hidden = feedbackUnavailable;
    feedbackLink.disabled = feedbackUnavailable;
    renderSettings();
    renderDeveloperMessage();
  }

  function isDeveloperMessageUnread() {
    return Boolean(
      REMOTE_API?.isDeveloperMessageUnread?.(
        remoteConfig.developerMessage,
        developerMessageReadId,
      ),
    );
  }

  function renderDeveloperMessage() {
    const message = remoteConfig.developerMessage;
    const unread = Boolean(message && isDeveloperMessageUnread());
    developerMessageNotice.hidden = !unread || developerMessagePanelOpen;
    developerMessageOpen.hidden = !unread;

    if (!message) {
      developerMessagePanelOpen = false;
      developerMessagePanel.hidden = true;
      return;
    }

    developerMessageTeaser.textContent = message.title;
    developerMessageTitle.textContent = message.title;
    developerMessageText.textContent = message.text;
    developerMessageSignature.textContent = message.signature ?? "";
    developerMessageSignature.hidden = !message.signature;
    developerMessagePanel.hidden = !developerMessagePanelOpen;
  }

  function openDeveloperMessagePanel() {
    if (!isDeveloperMessageUnread()) return;
    developerMessagePanelOpen = true;
    renderDeveloperMessage();
    developerMessageClose.focus();
  }

  async function dismissDeveloperMessage() {
    const message = remoteConfig.developerMessage;
    const saved = await REMOTE_API?.dismissDeveloperMessage?.(message?.id);
    if (!saved) return;
    developerMessageReadId = message.id;
    developerMessagePanelOpen = false;
    renderDeveloperMessage();
  }

  function bindDeveloperMessageControls() {
    developerMessageOpen.addEventListener("click", openDeveloperMessagePanel);
    developerMessageClose.addEventListener("click", dismissDeveloperMessage);
    developerMessagePanel.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      developerMessagePanelOpen = false;
      renderDeveloperMessage();
    });
    try {
      const api = getExtensionApi();
      const readKey = REMOTE_API?.developerMessageReadKey;
      if (!readKey) return;
      api?.storage?.onChanged?.addListener((changes, areaName) => {
        if (areaName !== "local" || !changes[readKey]) return;
        developerMessageReadId =
          REMOTE_API?.normalizeDeveloperMessageReadId?.(changes[readKey].newValue) ?? null;
        developerMessagePanelOpen = false;
        renderDeveloperMessage();
      });
    } catch {}
  }

  function renderUsage(value) {
    operationsCount.textContent = new Intl.NumberFormat().format(value);
    timeSaved.textContent = formatSavedTime(value);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  function usageForRange(range) {
    if (range === "all") return usage.safeTermCombinations;
    const today = new Date();
    let total = 0;
    for (const [dateKey, count] of Object.entries(usage.dailySafeTermCombinations)) {
      if (!Number.isSafeInteger(count) || count < 0) continue;
      const date = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(date.getTime())) continue;
      const ageInDays = Math.floor((startOfDay(today) - date) / 86_400_000);
      const isInRange =
        range === "day" ? ageInDays === 0 :
        range === "week" ? ageInDays >= 0 && ageInDays < 7 :
        ageInDays >= 0 && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
      if (isInRange) total += count;
    }
    return total;
  }

  function renderSelectedUsage() {
    renderUsage(usageForRange(selectedImpactRange));
  }

  function selectImpactRange(range) {
    selectedImpactRange = range;
    for (const option of impactRangeOptions) {
      const isSelected = option.dataset.range === range;
      option.classList.toggle("is-selected", isSelected);
      option.setAttribute("aria-pressed", String(isSelected));
    }
    renderSelectedUsage();
  }

  function formatSavedTime(operationCount) {
    const seconds = operationCount * SECONDS_SAVED_PER_OPERATION;
    if (seconds < 60) return formatTimeUnit(seconds, "second");
    const minutes = seconds / 60;
    if (minutes < 60) return formatTimeUnit(minutes, "minute");
    return formatTimeUnit(minutes / 60, "hour");
  }

  function formatTimeUnit(value, unit) {
    const rounded = value.toFixed(1);
    return `${rounded} ${Number(rounded) === 1 ? unit : `${unit}s`}`;
  }

  function bindUsageUpdates() {
    try {
      const api = getExtensionApi();
      api?.storage?.onChanged?.addListener((changes, areaName) => {
        if (areaName !== "local" || !changes[USAGE_KEY]) return;
        usage = normalizeUsage(changes[USAGE_KEY].newValue);
        renderSelectedUsage();
      });
    } catch {}
  }

  function bindImpactRangeOptions() {
    for (const option of impactRangeOptions) {
      option.addEventListener("click", () => selectImpactRange(option.dataset.range));
    }
  }

  async function resetUsageStats() {
    if (!window.confirm("Reset usage stats? This can't be undone.")) return;
    try {
      const api = getExtensionApi();
      if (!api?.storage?.local?.set) return;
      const resetUsage = { safeTermCombinations: 0, dailySafeTermCombinations: {} };
      await api.storage.local.set({ [USAGE_KEY]: resetUsage });
      usage = resetUsage;
      renderSelectedUsage();
    } catch {}
  }

  async function getActiveTabId() {
    const api = getExtensionApi();
    if (!api?.tabs?.query) {
      throw new Error("Chrome tabs API is unavailable.");
    }
    const tabs = await api.tabs.query({
      active: true,
      currentWindow: true,
    });
    const tabId = tabs[0]?.id;
    if (typeof tabId !== "number") {
      throw new Error("No active MITx tab is available.");
    }
    return tabId;
  }

  async function openHostedFeedback(api) {
    if (!FEEDBACK_PAGE_URL || !FEEDBACK_PAGE_ORIGIN) {
      throw new Error("Feedback is unavailable in this build.");
    }
    if (!api?.tabs?.create) throw new Error("Chrome tabs API is unavailable.");
    const url = new URL(FEEDBACK_PAGE_URL);
    if (
      url.protocol !== "https:" ||
      url.origin !== FEEDBACK_PAGE_ORIGIN ||
      url.pathname !== "/feedback"
    ) {
      throw new Error("Invalid feedback page URL.");
    }
    url.searchParams.set("version", api.runtime?.getManifest?.().version ?? "unknown");
    url.searchParams.set("source", "extension-popup");
    await api.tabs.create({ url: url.href });
  }

  async function sendSettingsUpdate() {
    const api = getExtensionApi();
    if (!api?.tabs?.sendMessage) return;
    const tabId = await getActiveTabId();
    await api.tabs.sendMessage(tabId, {
      target: "psetter-settings-update",
      settings,
    });
  }

  function bindSettings() {
    enabled.addEventListener("change", async () => {
      settings = {
        ...settings,
        enabled: enabled.checked,
        inlineEnabledDefault: enabled.checked,
      };
      enabledLabel.textContent = settings.enabled ? "On" : "Off";
      brand.classList.toggle("is-enabled", settings.enabled);
      // Persist before notifying the page. Content scripts in nested MITx
      // frames also reconcile through storage, so notifying first can let a
      // stale on value briefly re-enable an editor after the user turns it off.
      await saveSettings();
      await sendSettingsUpdate().catch(() => {});
    });
  }

  function bindUsageControls() {
    resetUsage.addEventListener("click", resetUsageStats);
    openDemo.addEventListener("click", async () => {
      const api = getExtensionApi();
      const demoUrl = api?.runtime?.getURL?.("demo.html");
      if (!demoUrl || !api?.tabs?.create) return;
      await api.tabs.create({ url: demoUrl });
      window.close();
    });
    feedbackLink.addEventListener("click", async () => {
      feedbackLink.removeAttribute("title");
      try {
        const api = getExtensionApi();
        if (!api?.tabs?.sendMessage) throw new Error("Chrome tabs API is unavailable.");
        const tabId = await getActiveTabId();
        let openedInTab = false;
        try {
          const result = await api.tabs.sendMessage(tabId, {
            target: "psetter-open-feedback",
          });
          openedInTab = result?.ok === true;
        } catch {}
        if (!openedInTab) await openHostedFeedback(api);
        window.close();
      } catch {
        feedbackLink.title = FEEDBACK_ENABLED
          ? "Unable to open feedback right now. Please try again."
          : "Feedback is unavailable in the community build.";
        feedbackLink.focus();
      }
    });
  }

  renderBuildChannel();
  renderVersion();

  Promise.all([
    loadSettings(),
    loadUsage(),
    REMOTE_API?.load?.(),
    REMOTE_API?.readDeveloperMessageReadId?.(),
  ])
    .then(([loadedSettings, loadedUsage, loadedRemoteConfig, loadedDeveloperMessageReadId]) => {
      settings = loadedSettings;
      usage = loadedUsage;
      developerMessageReadId = loadedDeveloperMessageReadId ?? null;
      if (loadedRemoteConfig) remoteConfig = loadedRemoteConfig;
      renderSettings();
      renderRemoteConfig();
      renderSelectedUsage();
      bindSettings();
      bindUsageControls();
      bindUsageUpdates();
      bindImpactRangeOptions();
      bindDeveloperMessageControls();
    })
    .catch((error) => {
      if (!isContextInvalidatedError(error)) {
        console.error("Psetter popup failed to initialize.", error);
      }
    });
})();
