"use strict";

const FEEDBACK_HOST_PATH = "feedback-host.html";
const FEEDBACK_WINDOW_KEY = "psetterFeedbackWindowId";
const VERSION_PATTERN = /^(?:0|[1-9]\d{0,3})(?:\.(?:0|[1-9]\d{0,3})){2,3}$/u;

function isMitxUrl(source) {
  try {
    const url = new URL(source);
    return url.protocol === "https:" &&
      (url.hostname === "mitx.mit.edu" || url.hostname.endsWith(".mitx.mit.edu"));
  } catch {
    return false;
  }
}

function isAllowedSender(sender) {
  return [sender?.url, sender?.tab?.url].some(isMitxUrl);
}

function isFeedbackHostSender(sender) {
  try {
    const actual = new URL(sender?.url ?? "");
    const expected = new URL(chrome.runtime.getURL(FEEDBACK_HOST_PATH));
    return actual.origin === expected.origin && actual.pathname === expected.pathname;
  } catch {
    return false;
  }
}

function getSessionStorage() {
  try {
    return chrome.storage?.session;
  } catch {
    return undefined;
  }
}

async function readFeedbackWindowId() {
  const session = getSessionStorage();
  if (typeof session?.get !== "function") return undefined;
  try {
    const values = await session.get(FEEDBACK_WINDOW_KEY);
    return Number.isInteger(values?.[FEEDBACK_WINDOW_KEY])
      ? values[FEEDBACK_WINDOW_KEY]
      : undefined;
  } catch {
    return undefined;
  }
}

async function writeFeedbackWindowId(windowId) {
  const session = getSessionStorage();
  if (typeof session?.set !== "function") return;
  try {
    await session.set({ [FEEDBACK_WINDOW_KEY]: windowId });
  } catch {}
}

async function clearFeedbackWindowId() {
  const session = getSessionStorage();
  if (typeof session?.remove !== "function") return;
  try {
    await session.remove(FEEDBACK_WINDOW_KEY);
  } catch {}
}

function normalizeVersion(value) {
  return typeof value === "string" && VERSION_PATTERN.test(value) ? value : "unknown";
}

function createFeedbackUrl(version) {
  const url = new URL(chrome.runtime.getURL(FEEDBACK_HOST_PATH));
  url.searchParams.set("version", normalizeVersion(version));
  return url.href;
}

async function openFeedbackWindow(version) {
  if (!chrome.windows) return null;
  const storedWindowId = await readFeedbackWindowId();
  if (storedWindowId !== undefined) {
    try {
      await chrome.windows.update(storedWindowId, { focused: true });
      return storedWindowId;
    } catch {
      await clearFeedbackWindowId();
    }
  }
  const created = await chrome.windows.create({
    url: createFeedbackUrl(version),
    type: "popup",
    width: 500,
    height: 500,
    focused: true,
  });
  const windowId = Number.isInteger(created?.id) ? created.id : null;
  if (windowId !== null) await writeFeedbackWindowId(windowId);
  return windowId;
}

async function closeFeedbackWindow(sender) {
  const hostWindowId = isFeedbackHostSender(sender) && sender?.tab?.windowId;
  const windowId = Number.isInteger(hostWindowId)
    ? hostWindowId
    : await readFeedbackWindowId();
  await clearFeedbackWindowId();
  if (!Number.isInteger(windowId) || !chrome.windows) return;
  try {
    await chrome.windows.remove(windowId);
  } catch {}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    message?.target !== "psetter-open-feedback" &&
    message?.target !== "psetter-close-feedback"
  ) return;
  const senderAllowed = message.target === "psetter-open-feedback"
    ? isAllowedSender(sender)
    : isAllowedSender(sender) || isFeedbackHostSender(sender);
  if (!senderAllowed) {
    sendResponse({ ok: false });
    return;
  }
  if (message.target === "psetter-close-feedback") {
    closeFeedbackWindow(sender).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.path !== FEEDBACK_HOST_PATH) {
    sendResponse({ ok: false });
    return;
  }
  openFeedbackWindow(message.version)
    .then((windowId) => sendResponse({ ok: windowId !== null, windowId }))
    .catch(() => sendResponse({ ok: false }));
  return true;
});

chrome.windows?.onRemoved?.addListener((windowId) => {
  readFeedbackWindowId().then((storedWindowId) => {
    if (storedWindowId === windowId) return clearFeedbackWindowId();
  });
});
