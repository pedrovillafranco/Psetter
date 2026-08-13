import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const extensionDir = new URL("../", import.meta.url);

test("feedback uses a packaged, MITx-scoped extension host", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", extensionDir), "utf8"));
  const feedbackResource = manifest.web_accessible_resources.find((entry) =>
    entry.resources.includes("feedback-host.html"),
  );
  assert.deepEqual(feedbackResource, {
    resources: ["feedback-host.html"],
    matches: ["https://*.mitx.mit.edu/*"],
  });
});

test("feedback host isolates the proprietary form and allows no remote extension code", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("feedback-host.html", extensionDir), "utf8"),
    readFile(new URL("feedback-host.js", extensionDir), "utf8"),
  ]);
  assert.match(html, /frame-src https:\/\/feedback\.psetter\.villafran\.co/);
  assert.match(html, /connect-src https:\/\/feedback\.psetter\.villafran\.co/);
  assert.match(html, /sandbox="allow-forms allow-scripts allow-same-origin"/);
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.doesNotMatch(html, /<script[^>]+https?:/i);
  assert.doesNotMatch(html, /allow-top-navigation|allow-popups/);
  assert.match(script, /frame\.addEventListener\("load", showLoaded\)/);
  assert.match(script, /FEEDBACK_LOAD_TIMEOUT_MS/);
  assert.match(script, /Feedback is temporarily unavailable/);
});

test("feedback opens in-tab on MITx and uses the fixed hosted page elsewhere", async () => {
  const [popup, popupScript, runtime] = await Promise.all([
    readFile(new URL("popup.html", extensionDir), "utf8"),
    readFile(new URL("popup.js", extensionDir), "utf8"),
    readFile(new URL("src/content-runtime.js", extensionDir), "utf8"),
  ]);
  assert.match(popup, /<button id="feedbackLink"/);
  assert.doesNotMatch(popup, /id="feedbackLink"[^>]+target="_blank"/);
  assert.doesNotMatch(runtime, /ce\.target\s*=\s*["']_blank["']/);
  assert.match(runtime, /ce\.setAttribute\("role", "button"\)/);
  assert.match(popupScript, /CONFIG\.feedbackPageUrl/);
  assert.match(popupScript, /url\.hostname !== "feedback\.psetter\.villafran\.co"/);
  assert.match(popupScript, /await api\.tabs\.create\(\{ url: url\.href \}\)/);
  assert.match(
    popupScript,
    /if \(!openedInTab\) await openHostedFeedback\(api\)/,
  );
  assert.match(
    runtime,
    /let i = \(r, n, s\) => \{[\s\S]*?s\(\{ ok: e\.openFeedback\(\) \}\)/,
  );
  assert.match(runtime, /if \(n\?\.target !== "psetter-qa"\) return r\(n, s, o\)/);
  assert.doesNotMatch(popupScript, /Open an MITx page/);
  assert.doesNotMatch(popupScript, /Feedback opens inside a compatible MITx tab/);
});
