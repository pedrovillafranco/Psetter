import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../background.js", import.meta.url), "utf8");

function createHarness() {
  const sessionValues = {};
  let listener;
  const calls = [];
  const chrome = {
    runtime: {
      getURL: (path) => `chrome-extension://test/${path}`,
      onMessage: { addListener: (handler) => { listener = handler; } },
    },
    storage: {
      session: {
        async get(key) {
          return { [key]: sessionValues[key] };
        },
        async set(values) { Object.assign(sessionValues, values); },
        async remove(key) { delete sessionValues[key]; },
      },
    },
    windows: {
      onRemoved: { addListener() {} },
      async update(id, details) { calls.push({ method: "update", id, details }); },
      async create(details) {
        calls.push({ method: "create", details });
        return { id: 7 };
      },
      async remove(id) { calls.push({ method: "remove", id }); },
    },
  };
  vm.runInNewContext(source, { chrome, URL, Number, Promise });
  return { calls, sessionValues, dispatch: (message, sender) => new Promise((resolve) => {
    const result = listener(message, sender, resolve);
    if (result !== true) resolve(undefined);
  }) };
}

test("background opens and reuses a feedback popup for MITx senders", async () => {
  const harness = createHarness();
  const sender = { url: "https://lms.mitx.mit.edu/course/problem" };
  assert.deepEqual(
    JSON.parse(JSON.stringify(await harness.dispatch({ target: "psetter-open-feedback", path: "feedback-host.html", version: "0.1.2" }, sender))),
    { ok: true, windowId: 7 },
  );
  assert.deepEqual(JSON.parse(JSON.stringify(harness.calls[0])), {
    method: "create",
    details: {
      url: "chrome-extension://test/feedback-host.html?version=0.1.2",
      type: "popup",
      width: 500,
      height: 500,
      focused: true,
    },
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(await harness.dispatch({ target: "psetter-open-feedback", path: "feedback-host.html", version: "0.1.2" }, sender))),
    { ok: true, windowId: 7 },
  );
  assert.deepEqual(JSON.parse(JSON.stringify(harness.calls[1])), { method: "update", id: 7, details: { focused: true } });
  assert.deepEqual(JSON.parse(JSON.stringify(await harness.dispatch(
    { target: "psetter-close-feedback" },
    {
      url: "chrome-extension://test/feedback-host.html?version=0.1.2",
      tab: { windowId: 42 },
    },
  ))), { ok: true });
  assert.deepEqual(JSON.parse(JSON.stringify(harness.calls[2])), { method: "remove", id: 42 });
  assert.equal(harness.sessionValues.psetterFeedbackWindowId, undefined);
});

test("background checks both sender URL candidates for MITx context", async () => {
  const harness = createHarness();
  assert.deepEqual(
    JSON.parse(JSON.stringify(await harness.dispatch(
      { target: "psetter-open-feedback", path: "feedback-host.html", version: "0.1.2" },
      { url: "about:blank", tab: { url: "https://lms.mitx.mit.edu/course/problem" } },
    ))),
    { ok: true, windowId: 7 },
  );
});

test("background rejects popup requests from non-MITx senders", async () => {
  const harness = createHarness();
  assert.deepEqual(
    JSON.parse(JSON.stringify(await harness.dispatch(
      { target: "psetter-open-feedback", path: "feedback-host.html", version: "0.1.2" },
      { url: "https://example.com/" },
    ))),
    { ok: false },
  );
  assert.deepEqual(JSON.parse(JSON.stringify(harness.calls)), []);
});

test("feedback window identity survives a service-worker restart", async () => {
  const first = createHarness();
  const sender = { url: "https://lms.mitx.mit.edu/course/problem" };
  assert.deepEqual(
    JSON.parse(JSON.stringify(await first.dispatch(
      { target: "psetter-open-feedback", path: "feedback-host.html", version: "0.1.2" },
      sender,
    ))),
    { ok: true, windowId: 7 },
  );

  const second = createHarness();
  Object.assign(second.sessionValues, first.sessionValues);
  assert.deepEqual(
    JSON.parse(JSON.stringify(await second.dispatch(
      { target: "psetter-open-feedback", path: "feedback-host.html", version: "0.1.2" },
      sender,
    ))),
    { ok: true, windowId: 7 },
  );
  assert.deepEqual(JSON.parse(JSON.stringify(second.calls[0])), {
    method: "update",
    id: 7,
    details: { focused: true },
  });
});
