"use strict";

(() => {
  const FEEDBACK_ORIGIN = "https://feedback.psetter.villafran.co";
  const FEEDBACK_LOAD_TIMEOUT_MS = 10_000;
  const frame = document.querySelector("#feedbackFrame");
  const status = document.querySelector("#feedbackStatus");
  if (!frame || !status) return;

  const params = new URLSearchParams(location.search);
  const rawVersion = params.get("version") ?? "unknown";
  const version = /^[0-9A-Za-z._-]{1,32}$/.test(rawVersion) ? rawVersion : "unknown";
  const feedbackUrl = new URL("/feedback", FEEDBACK_ORIGIN);
  feedbackUrl.searchParams.set("version", version);
  let loadTimeout;
  let loadState = "loading";

  function showLoaded() {
    if (loadState !== "loading") return;
    loadState = "loaded";
    globalThis.clearTimeout(loadTimeout);
    frame.hidden = false;
    status.hidden = true;
  }

  function showUnavailable() {
    if (loadState !== "loading") return;
    loadState = "error";
    globalThis.clearTimeout(loadTimeout);
    frame.hidden = true;
    status.replaceChildren();
    const heading = document.createElement("strong");
    const message = document.createElement("span");
    heading.textContent = "Feedback is temporarily unavailable";
    message.textContent = "Please try again later.";
    status.append(heading, message);
  }

  function loadFeedback() {
    try {
      frame.src = feedbackUrl.href;
      loadTimeout = globalThis.setTimeout(showUnavailable, FEEDBACK_LOAD_TIMEOUT_MS);
    } catch {
      showUnavailable();
    }
  }

  frame.addEventListener("load", showLoaded);
  frame.addEventListener("error", showUnavailable);
  loadFeedback();

  window.addEventListener("message", (event) => {
    if (
      event.source !== frame.contentWindow ||
      event.origin !== FEEDBACK_ORIGIN ||
      event.data?.target !== "psetter-feedback-close"
    ) return;
    window.parent.postMessage({ target: "psetter-feedback-close" }, "*");
  });
})();
