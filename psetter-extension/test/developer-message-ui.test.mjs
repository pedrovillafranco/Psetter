import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const extensionDir = new URL("../", import.meta.url);

test("developer message surfaces are local, text-only, and dismissible", async () => {
  const [popup, popupScript, runtime, styles] = await Promise.all([
    readFile(new URL("popup.html", extensionDir), "utf8"),
    readFile(new URL("popup.js", extensionDir), "utf8"),
    readFile(new URL("src/content-runtime.js", extensionDir), "utf8"),
    readFile(new URL("content.css", extensionDir), "utf8"),
  ]);

  assert.match(popup, /id="developerMessageNotice"/);
  assert.match(popup, /id="developerMessagePanel"/);
  assert.match(popup, /id="developerMessageClose"/);
  assert.doesNotMatch(popup, /developerMessageDismiss/);
  assert.match(popupScript, /developerMessageReadId/);
  assert.match(popupScript, /textContent = message\.text/);
  assert.doesNotMatch(popupScript, /developerMessageDismiss/);
  assert.doesNotMatch(popupScript, /innerHTML/);
  assert.match(runtime, /developerMessageReadId/);
  assert.match(runtime, /R\("p", "pset-math-developer-message-text", message\.text\)/);
  assert.doesNotMatch(runtime, /developerMessage.*innerHTML/s);
  assert.match(styles, /\.pset-math-developer-message-panel/);
  assert.match(styles, /\.pset-math-developer-message-button/);
});
