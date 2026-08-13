"use strict";

(() => {
  const DEV_MODE_KEY = "psetQaDevMode";
  const devMode = document.querySelector("#devMode");
  const devPanel = document.querySelector("#devPanel");
  const devStatus = document.querySelector("#devStatus");
  const controls = {
    "start-capture": document.querySelector("#startCapture"),
    "stop-capture": document.querySelector("#stopCapture"),
    "run-scripted": document.querySelector("#runScriptedQa"),
    "export-log": document.querySelector("#exportQaLog"),
  };
  if (!devMode || !devPanel || !devStatus || Object.values(controls).some((node) => !node)) {
    return;
  }

  let statusTimeout;

  function getExtensionApi() {
    try {
      return globalThis.chrome ?? null;
    } catch {
      return null;
    }
  }

  function setStatus(message, tone = "info") {
    devStatus.textContent = message;
    devStatus.style.color =
      tone === "error" ? "#b42318" : tone === "success" ? "#177245" : "#1d4ed8";
    window.clearTimeout(statusTimeout);
    if (message) {
      statusTimeout = window.setTimeout(() => {
        devStatus.textContent = "";
      }, 3000);
    }
  }

  async function loadMode() {
    try {
      const storage = getExtensionApi()?.storage?.local;
      if (!storage) return false;
      const result = await storage.get(DEV_MODE_KEY);
      return result[DEV_MODE_KEY] === true;
    } catch {
      return false;
    }
  }

  async function saveMode(value) {
    try {
      await getExtensionApi()?.storage?.local?.set?.({ [DEV_MODE_KEY]: value });
    } catch {}
  }

  async function sendCommand(command) {
    const api = getExtensionApi();
    if (!api?.tabs?.query || !api.tabs.sendMessage) {
      throw new Error("Chrome tabs API is unavailable.");
    }
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (typeof tabId !== "number") throw new Error("No active MITx tab is available.");
    return api.tabs.sendMessage(tabId, { target: "psetter-qa", command });
  }

  function render(value) {
    devMode.checked = value;
    devPanel.hidden = !value;
  }

  devMode.addEventListener("change", async () => {
    render(devMode.checked);
    await saveMode(devMode.checked);
    setStatus(devMode.checked ? "QA tools enabled." : "QA tools hidden.");
  });

  for (const [command, button] of Object.entries(controls)) {
    button.addEventListener("click", async () => {
      try {
        if (command === "run-scripted") setStatus("Running scripted QA…");
        const result = await sendCommand(command);
        setStatus(result?.message ?? "QA command completed.", result?.ok === false ? "error" : "success");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error), "error");
      }
    });
  }

  loadMode().then(render);
})();
