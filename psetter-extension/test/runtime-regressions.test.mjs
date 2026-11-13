import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";

const extensionDir = new URL("../", import.meta.url);
const [jquery, mathquill, runtimeBuild] = await Promise.all([
  readFile(new URL("vendor/jquery.min.js", extensionDir), "utf8"),
  readFile(new URL("vendor/mathquill.min.js", extensionDir), "utf8"),
  build({
    entryPoints: [fileURLToPath(new URL("src/content-runtime.js", extensionDir))],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["chrome120"],
    write: false,
    define: { __PSETTER_DEV_BUILD__: "true" },
  }),
]);
const runtime = runtimeBuild.outputFiles[0].text;

const remoteConfig = {
  disabled: false,
  feedbackDisabled: false,
  minimumSupportedVersion: "0.1.0",
  maintenanceMessage: "",
  compatibilityWarning: "",
  developerMessage: null,
  features: { contextSymbols: true, symbolSearch: true },
};

function problem(id, prompt, value = "") {
  return `<section class="problem" id="${id}">
    ${prompt}
    <div class="formulaequationinput"><input class="math" id="input_${id}" type="text" value="${value}"></div>
  </section>`;
}

async function createRuntime(html, options = {}) {
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: "https://lms.mitx.mit.edu/xblock/test",
    pretendToBeVisual: true,
    runScripts: "outside-only",
    virtualConsole,
  });
  const { window } = dom;
  const settings = {
    enabled: true,
    inlineEnabledDefault: true,
    defaultMode: "numeric",
    showGenericFields: false,
    openDetails: false,
  };
  const storage = { psetMathSettings: settings };
  const configuredRemoteConfig = options.remoteConfig ?? remoteConfig;
  const configuredReadId = options.developerMessageReadId ?? null;
  const configuredReadIds = options.developerMessageReadIds ?? [];
  const listeners = new Set();
  let runtimeMessageListener;
  const notifyStorageChanged = async (changes, areaName = "local") => {
    await Promise.all([...listeners].map((listener) => listener(changes, areaName)));
  };
  window.chrome = {
    runtime: {
      getURL: (path = "") => `chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/${path}`,
      getManifest: () => ({ version: "0.1.1" }),
      sendMessage: async () => ({ ok: true, windowId: 1 }),
      onMessage: {
        addListener(listener) { runtimeMessageListener = listener; },
        removeListener(listener) {
          if (runtimeMessageListener === listener) runtimeMessageListener = undefined;
        },
      },
    },
    storage: {
      local: {
        async get(key) {
          if (typeof key === "string") return { [key]: storage[key] };
          return { ...storage };
        },
        async set(value) {
          const delay = options.storageSetDelay?.(value) ?? 0;
          if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
          Object.assign(storage, value);
        },
      },
      onChanged: {
        addListener(listener) { listeners.add(listener); },
        removeListener(listener) { listeners.delete(listener); },
      },
    },
  };
  window.__psetterRemoteConfig = {
    defaults: configuredRemoteConfig,
    remoteConfigKey: "remoteConfig",
    developerNotificationTokenKey: "psetterDeveloperNotificationToken",
    developerMessageReadKey: "developerMessageRead",
    validate: (value) => value,
    loadCached: async () => configuredRemoteConfig,
    load: async (loadOptions) =>
      options.loadRemoteConfig
        ? options.loadRemoteConfig(loadOptions)
        : configuredRemoteConfig,
    readDeveloperMessageReadId: async () => configuredReadId,
    readDeveloperMessageReadIds: async () => configuredReadIds,
    dismissDeveloperMessage: async () => true,
    normalizeDeveloperMessageReadId: () => null,
    normalizeDeveloperMessageReadIds: (value) => Array.isArray(value) ? value : [],
    isDeveloperMessageUnread: (message, readId) => {
      const readIds = Array.isArray(readId) ? readId : [readId];
      return Boolean(message?.id && !readIds.includes(message.id));
    },
    isVersionBelow: () => false,
  };
  window.eval(jquery);
  window.eval(mathquill);
  options.beforeRuntime?.(window);
  window.eval(runtime);
  await new Promise((resolve) => window.setTimeout(resolve, 30));
  return { dom, window, storage, runtimeMessageListener, notifyStorageChanged };
}

function contextItems(controller) {
  controller.activate();
  controller.detailsOpen = true;
  controller.mountDetailsPanel();
  return [...controller.detailsPanel.querySelectorAll(".pset-math-nearby-symbols button")].map(
    (button) => ({
      id: button.dataset.symbolId,
      text: button.textContent,
      aria: button.getAttribute("aria-label"),
    }),
  );
}

test("context stays inside one problem and rejects instructional, hidden, and injected DOM", async () => {
  const { dom, window } = await createRuntime(`<div class="problems-wrapper" data-content="broad">
    ${problem("one", `<p>For example, <code>arctan</code> is valid syntax. Type <code>pi</code> for the mathematical constant and <code>e</code> for the other constant.</p>
      <p>Find <span role="math" aria-label="x + theta"></span>.</p>
      <p>Reference implementation token: <code>strayIdentifier</code>.</p>
      <p hidden>Let <code>hiddenAlias</code> be a variable.</p>`)}
    ${problem("two", `<p>What is the force <span role="math" aria-label="F"></span>? Express the answer in terms of <code>G</code>, <code>M</code>, <code>m</code>, and <code>r</code>.</p>
      <p>Try out <code>G*M*m/r^2</code> as an example answer.</p>
      <p><span role="math" aria-label="F equals"></span></p>`)}
  </div>`);
  try {
    const runtimeManager = window.__psetterRuntime;
    const firstInput = window.document.querySelector("#input_one");
    const secondInput = window.document.querySelector("#input_two");
    const firstController = runtimeManager.controllers.get(firstInput);
    const secondController = runtimeManager.controllers.get(secondInput);
    const firstBefore = contextItems(firstController);
    assert.deepEqual(firstBefore.map((item) => item.text), ["x", "θ"]);
    assert.equal(firstBefore.some((item) => /arctan|pi|hiddenAlias/.test(item.text)), false);

    firstController.detailsPanel.insertAdjacentHTML(
      "afterbegin",
      '<code data-psetter-context="lambda">lambda</code>',
    );
    firstController.detailsMount.remove();
    firstController.detailsPanel = undefined;
    firstController.detailsMount = undefined;
    const firstAfter = contextItems(firstController);
    assert.deepEqual(firstAfter.map((item) => item.text), ["x", "θ"]);

    const second = contextItems(secondController);
    assert.deepEqual(second.map((item) => item.text), ["G", "M", "m", "r"]);
    assert.equal(second.some((item) => item.text === "x" || item.text === "θ"), false);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("context insertion preserves function and alias semantics", async () => {
  const { dom, window } = await createRuntime(`<div class="problems-wrapper">
    ${problem("function", '<p>Find <span role="math" aria-label="arctan(x)"></span>.</p>')}
    ${problem("alias", '<p>Use <code>hati</code> for <span role="math" aria-label="i"></span>.</p>')}
  </div>`);
  try {
    const manager = window.__psetterRuntime;
    const functionController = manager.controllers.get(window.document.querySelector("#input_function"));
    const functionSuggestions = contextItems(functionController);
    assert.equal(
      functionController.detailsPanel.querySelector(".pset-math-brand-version")?.textContent,
      "v0.1.1",
    );
    const functionButton = functionController.detailsPanel.querySelector(
      '[data-symbol-id="context:function:arctan"]',
    );
    assert.ok(functionButton);
    assert.match(functionSuggestions.find((item) => item.id.includes("arctan")).aria, /function arctan/);
    functionButton.click();
    functionController.typeCharacter("x");
    functionController.typeCharacter(")");
    assert.equal(functionController.input.value, "arctan(x)");
    assert.doesNotMatch(functionController.input.value, /a\*r|arc\*tan/);
    for (let cycle = 0; cycle < 3; cycle++) {
      functionController.deactivate();
      functionController.activate();
      assert.equal(functionController.input.value, "arctan(x)", `arctan lifecycle ${cycle + 1}`);
    }

    const aliasController = manager.controllers.get(window.document.querySelector("#input_alias"));
    contextItems(aliasController);
    const aliasButton = aliasController.detailsPanel.querySelector(
      '[data-symbol-id="context:alias:hati"]',
    );
    assert.ok(aliasButton);
    aliasButton.click();
    assert.equal(aliasController.input.value, "hati");
    aliasController.deactivate();
    aliasController.activate();
    assert.equal(aliasController.input.value, "hati");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("hatted physics basis vectors serialize as hati, hatj, and hatk", async () => {
  const prompt = String.raw`<p>Use the unit vectors <span role="math" aria-label="\hat{i}+\hat{\jmath}+\hat{k}"></span> in your answer.</p>`;
  const { dom, window } = await createRuntime(problem("basis_vectors", prompt));
  try {
    const controller = window.__psetterRuntime.controllers.get(
      window.document.querySelector("#input_basis_vectors"),
    );
    controller.activate();
    const aliases = new Map(
      controller.semanticContext.items
        .filter((item) => ["hati", "hatj", "hatk"].includes(item.outputName))
        .map((item) => [item.outputName, item]),
    );
    assert.deepEqual([...aliases.keys()], ["hati", "hatj", "hatk"]);
    for (const name of aliases.keys()) {
      controller.clearExpression();
      controller.insertSymbol(aliases.get(name));
      assert.equal(controller.input.value, name, name);
      assert.equal(controller.lastResult.status, "safe", name);
    }
    controller.mathField.latex("3*hati-2*hatj+6*hatk");
    assert.equal(controller.input.value, "3*hati-2*hatj+6*hatk");
    assert.equal(controller.lastResult.status, "safe");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("manual vector-alias typing stays contiguous", async () => {
  const { dom, window } = await createRuntime(problem("manual_basis_aliases", "<p>Enter a vector expression.</p>"));
  try {
    const input = window.document.querySelector("#input_manual_basis_aliases");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    for (const alias of ["hati", "hatj", "hatk"]) {
      controller.clearExpression();
      for (const character of alias) controller.typeCharacter(character);
      assert.equal(input.value, alias, alias);
      assert.equal(controller.lastResult.status, "safe", alias);
    }
    controller.clearExpression();
    controller.mathField.latex("h*a*t*i");
    assert.equal(input.value, "h*a*t*i", "explicit multiplication is not rewritten as an alias");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("MathQuill typed vector aliases stay contiguous in implicit products", async () => {
  const { dom, window } = await createRuntime(problem("typed_basis_aliases", "<p>Enter a vector expression.</p>"));
  try {
    const input = window.document.querySelector("#input_typed_basis_aliases");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    const cases = [
      ["hati", "hati"],
      ["2hati", "2*hati"],
      ["hatihati", "hati*hati"],
      ["hatj+hatk", "hatj+hatk"],
    ];
    for (const [expression, expected] of cases) {
      controller.clearExpression();
      for (const character of expression) controller.typeCharacter(character);
      assert.equal(input.value, expected, expression);
      assert.equal(controller.lastResult.status, "safe", expression);
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("typed sqrt creates a radical and preserves implicit multiplication", async () => {
  const { dom, window } = await createRuntime(problem("typed_root", "<p>Enter an expression.</p>"));
  try {
    const input = window.document.querySelector("#input_typed_root");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    for (const character of "4sqrt21") controller.typeCharacter(character);
    assert.match(controller.mathField.latex(), /\\sqrt\{21\}/);
    assert.equal(input.value, "4*sqrt(21)");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("unit names declared in prose are preserved", async () => {
  const { dom, window } = await createRuntime(problem("units", "<p>Express your answer in terms of rad for radians, s for seconds, kg for kilograms, m for meters.</p>"));
  try {
    const input = window.document.querySelector("#input_units");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    for (const character of "rad") controller.typeCharacter(character);
    assert.equal(input.value, "rad");
    controller.clearExpression();
    for (const character of "kg") controller.typeCharacter(character);
    assert.equal(input.value, "kg");
    controller.clearExpression();
    for (const character of "rad") controller.typeCharacter(character);
    controller.typeCharacter("^");
    controller.typeCharacter("2");
    controller.mathField.keystroke("Right");
    controller.typeCharacter("/");
    controller.typeCharacter("s");
    controller.typeCharacter("^");
    controller.typeCharacter("2");
    controller.mathField.keystroke("Right Right");
    for (const character of "kg") controller.typeCharacter(character);
    assert.equal(controller.nativeEquivalentForQa("rad^2/s^2*kg"), true, input.value);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("typed function arguments retain explicit grouping", async () => {
  const { dom, window } = await createRuntime(problem("grouped_trig", "<p>Enter an expression.</p>"));
  try {
    const input = window.document.querySelector("#input_grouped_trig");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    for (const character of "sin(alpha+beta)") controller.typeCharacter(character);
    assert.equal(input.value, "sin(alpha+beta)");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("adjacent factors and script navigation serialize without merging identifiers", async () => {
  const { dom, window } = await createRuntime(problem("products", '<p>Use <span role="math" aria-label="m"></span>, <span role="math" aria-label="v"></span>, <span role="math" aria-label="U_0"></span>, and <span role="math" aria-label="omega_0"></span>.</p>'));
  try {
    const input = window.document.querySelector("#input_products");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    for (const character of "-48mv") controller.typeCharacter(character);
    controller.typeCharacter("^");
    controller.typeCharacter("2");
    assert.equal(input.value, "-48*m*v^2");
    controller.clearExpression();
    for (const character of "U_0") controller.typeCharacter(character);
    controller.mathField.keystroke("Right");
    controller.typeCharacter("2");
    controller.typeCharacter("x");
    assert.equal(input.value, "U_0*2*x", controller.mathField.latex());
    controller.clearExpression();
    for (const character of "U_02") controller.typeCharacter(character);
    assert.equal(input.value, "U_02", "digits still inside the subscript stay together");
    controller.clearExpression();
    for (const character of "omega_0") controller.typeCharacter(character);
    controller.mathField.keystroke("Right");
    controller.typeCharacter("t");
    assert.equal(input.value, "omega_0*t");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("the Latin o variable is not serialized as parser Omicron", async () => {
  const { dom, window } = await createRuntime(problem("latin_o", "<p>Use the variable o.</p>"));
  try {
    const input = window.document.querySelector("#input_latin_o");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    controller.typeCharacter("o");
    assert.equal(input.value, "o");
    assert.equal(controller.lastResult.status, "safe");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("queued developer messages use one page panel and advance after dismissal", async () => {
  const first = {
    id: "notice-1",
    title: "First notice",
    text: "First text",
    signature: "- Pedro",
  };
  const second = {
    id: "notice-2",
    title: "Second notice",
    text: "Second text",
    signature: "- Pedro",
  };
  const third = {
    id: "notice-3",
    title: "Third notice",
    text: "Third text",
    signature: "- Pedro",
  };
  const { developerMessage: _legacyMessage, ...queuedConfig } = remoteConfig;
  queuedConfig.developerMessages = [first, second, third];
  const { dom, window } = await createRuntime(
    problem("queued_notifications", "<p>Find x.</p>"),
    { remoteConfig: queuedConfig },
  );
  try {
    const manager = window.__psetterRuntime;
    assert.equal(manager.developerMessageButton.hidden, false);
    assert.equal(manager.openDeveloperMessage(), true);
    assert.equal(
      manager.developerMessagePanel.querySelector(".pset-math-developer-message-title").textContent,
      first.title,
    );
    assert.equal(
      manager.developerMessagePanel.querySelector(".pset-math-developer-message-progress").textContent,
      "1 of 3",
    );

    manager.developerMessagePanel.querySelector(".pset-math-developer-message-close").click();
    assert.equal(manager.developerMessagePanel, undefined, "closing only hides the panel");
    assert.equal(manager.developerMessageButton.hidden, false, "closed notification remains available");
    assert.equal(manager.openDeveloperMessage(), true);
    manager.developerMessagePanel.querySelector(".pset-math-developer-message-nav[aria-label='Next notification']").click();
    assert.equal(
      manager.developerMessagePanel.querySelector(".pset-math-developer-message-title").textContent,
      second.title,
    );

    assert.equal(await manager.dismissDeveloperMessage(), true);
    assert.equal(manager.developerMessagePanel, undefined);
    assert.equal(manager.developerMessageButton.hidden, false, "later messages remain queued");
    assert.equal(manager.openDeveloperMessage(), true);
    assert.equal(
      manager.developerMessagePanel.querySelector(".pset-math-developer-message-title").textContent,
      third.title,
    );
    assert.equal(
      manager.developerMessagePanel.querySelector(".pset-math-developer-message-progress").textContent,
      "3 of 3",
    );

    assert.equal(await manager.dismissDeveloperMessage(), true);
    assert.equal(manager.developerMessageButton.hidden, false, "the undismissed first message remains queued");
    assert.equal(manager.openDeveloperMessage(), true);
    assert.equal(
      manager.developerMessagePanel.querySelector(".pset-math-developer-message-title").textContent,
      first.title,
    );
    assert.equal(
      manager.developerMessagePanel.querySelector(".pset-math-developer-message-progress").textContent,
      "1 of 3",
    );

    assert.equal(await manager.dismissDeveloperMessage(), true);
    assert.equal(manager.developerMessageButton.hidden, true, "queue is empty");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("local developer token changes the live page notification audience immediately", async () => {
  const first = {
    id: "public-notice",
    title: "Public notice",
    text: "Everyone sees this.",
    signature: null,
  };
  const developerTest = {
    id: "developer-notice",
    title: "Developer notice",
    text: "Only the opted-in developer sees this.",
    signature: null,
  };
  const publicConfig = { ...remoteConfig, developerMessage: first, developerMessages: [first] };
  const developerConfig = {
    ...publicConfig,
    developerMessages: [first, developerTest],
  };
  const loadCalls = [];
  let developerEnabled = false;
  const { dom, window, storage, notifyStorageChanged } = await createRuntime(
    problem("local_developer_audience", "<p>Find x.</p>"),
    {
      remoteConfig: publicConfig,
      loadRemoteConfig: async (options) => {
        loadCalls.push(options);
        return developerEnabled ? developerConfig : publicConfig;
      },
    },
  );
  try {
    const manager = window.__psetterRuntime;
    assert.equal(manager.getUnreadDeveloperMessages().length, 1);

    developerEnabled = true;
    storage.psetterDeveloperNotificationToken = "a".repeat(64);
    await notifyStorageChanged(
      { psetterDeveloperNotificationToken: { newValue: storage.psetterDeveloperNotificationToken } },
    );
    assert.equal(loadCalls.at(-1)?.force, true);
    assert.equal(manager.getUnreadDeveloperMessages().length, 2);

    developerEnabled = false;
    delete storage.psetterDeveloperNotificationToken;
    await notifyStorageChanged({
      psetterDeveloperNotificationToken: { oldValue: "a".repeat(64), newValue: undefined },
    });
    assert.equal(manager.getUnreadDeveloperMessages().length, 1);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("question aliases containing operator names remain editable in native answers", async () => {
  const cases = [
    [
      "second_definition",
      '<p>Express the answer in terms of <code>Deltanu</code> for <span role="math" aria-label="Delta nu CS"></span>.</p>',
      "9192631770/(Deltanu)",
    ],
    [
      "meter_definition",
      '<p>Express the answer in terms of <code>c</code>, <code>Deltanu</code> for <span role="math" aria-label="Delta nu CS"></span>.</p>',
      "(c/299792458)*(9192631770/(Deltanu))",
    ],
  ];
  const { dom, window } = await createRuntime(
    cases.map(([id, prompt, value]) => problem(id, prompt, value)).join(""),
  );
  try {
    for (const [id, , original] of cases) {
      const input = window.document.querySelector(`#input_${id}`);
      const controller = window.__psetterRuntime.controllers.get(input);
      controller.activate();
      assert.ok(controller.mathField, `${id}: native answer is editable`);
      assert.ok(controller.semanticContext.aliases.has("Deltanu"), `${id}: alias discovered`);
      assert.doesNotMatch(controller.mathField.latex(), /\\tan/, `${id}: alias stays atomic`);
      assert.equal(controller.lastResult.status, "safe", `${id}: hydration is safe`);
      assert.equal(input.value, original, `${id}: hydration is non-mutating`);

      controller.mathField.moveToRightEnd();
      controller.typeCharacter("+");
      controller.typeCharacter("1");
      assert.equal(controller.lastResult.status, "safe", `${id}: edit remains safe`);
      assert.equal(
        controller.nativeEquivalentForQa(`${original}+1`),
        true,
        `${id}: edit preserves native semantics; actual ${input.value}`,
      );
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("existing cat sled and train answers hydrate and remain editable", async () => {
  const cases = [
    ["cat_a", "m_c*u*cos(theta)/(m_s+m_c)", ["m_c", "m_s", "u", "theta"]],
    ["cat_b", "((m_s+m_c)/(m_s))*tan(theta)", ["m_c", "m_s", "theta"]],
    ["train_a", "N*m*(u/(m_t+N*m))", ["m_t", "N", "m", "u"]],
    ["train_b", "m*(u/(m_t+k*m))", ["m_t", "N", "m", "u", "k"]],
  ];
  const { dom, window } = await createRuntime(cases.map(([id, value, symbols]) =>
    problem(id, `<p>Express your answer using some or all of the following: ${symbols.map((s) => `<code>${s}</code>`).join(", ")}.</p>`, value)).join(""));
  try {
    for (const [id, original] of cases) {
      const input = window.document.querySelector(`#input_${id}`);
      const controller = window.__psetterRuntime.controllers.get(input);
      controller.activate();
      assert.ok(controller.mathField, `${id} should open`);
      assert.equal(input.value, original, `${id} hydration preserves the answer`);
      controller.mathField.moveToRightEnd();
      controller.typeCharacter("+");
      controller.typeCharacter("1");
      assert.equal(controller.lastResult.status, "safe", `${id}: ${controller.lastResult.errors}`);
      assert.equal(controller.nativeEquivalentForQa(`${original}+1`), true, `${id}: ${input.value}`);
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("rail car answer opens from the MITx variable-list prompt", async () => {
  const prompt = `<p><span role="math" aria-label="N"></span> people, each of mass <span role="math" aria-label="m"></span>, stand on a railway car of mass <span role="math" aria-label="m_t"></span>. They jump off with speed <span role="math" aria-label="u"></span>.</p>
    <p>Express your answer using some or all of the following: <code>m_t</code> for <span role="math" aria-label="m_t"></span>, <span role="math" aria-label="N"></span>, <span role="math" aria-label="m"></span>, and <span role="math" aria-label="u"></span>.</p>`;
  const source = "N*m*(u/(m_t+N*m))";
  const { dom, window } = await createRuntime(problem("rail_car", prompt, source));
  try {
    const input = window.document.querySelector("#input_rail_car");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    assert.ok(controller.mathField, controller.lastResult.errors.join(" | "));
    assert.equal(input.value, source);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("astronaut answer with indexed variables opens from MITx declarations", async () => {
  const prompt = `<p>Express your answer in terms of some or all of the following: <span role="math" aria-label="m"></span>, <code>m_1</code> for <span role="math" aria-label="m_1"></span>, <code>m_2</code> for <span role="math" aria-label="m_2"></span>, <span role="math" aria-label="u"></span>, <code>v_1</code> for <span role="math" aria-label="v_1"></span>, and <code>v_2</code> for <span role="math" aria-label="v_2"></span>.</p>`;
  const source = "m_2*(m_1+m)*((v_2-v_1)/(m*(m_1+m_2+m)))";
  const { dom, window } = await createRuntime(problem("astronaut", prompt, source));
  try {
    const input = window.document.querySelector("#input_astronaut");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    assert.ok(controller.mathField, controller.lastResult.errors.join(" | "));
    assert.equal(input.value, source);
    assert.equal(controller.nativeEquivalentForQa(source), true);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("elevator answer variables remain editable after native MITx hydration", async () => {
  const prompt = `<p>Two blocks have masses <span role="math" aria-label="m_1"></span> and <span role="math" aria-label="m_2"></span>.</p>
    <p>The elevator accelerates with magnitude <span role="math" aria-label="a"></span>. Use <span role="math" aria-label="g"></span> in your answer.</p>
    <p>Give the answer in terms of <span role="math" aria-label="m_1"></span>, <span role="math" aria-label="m_2"></span>, <span role="math" aria-label="a"></span>, and <span role="math" aria-label="g"></span>.</p>`;
  const { dom, window } = await createRuntime(
    `<div class="problems-wrapper">
      ${problem("elevator", prompt)}
      ${problem("elevator_native", prompt, "m(a-m_2)")}
    </div>`,
  );
  try {
    const input = window.document.querySelector("#input_elevator");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    assert.ok(controller.mathField, "native answer is editable");
    assert.deepEqual(
      ["m_1", "m_2", "a", "g"].map((name) => controller.semanticContext.items.some((item) => item.outputName === name)),
      [true, true, true, true],
      "question variables are available to the editor",
    );
    assert.equal(controller.lastResult.status, "safe", "empty hydration is safe");
    controller.mathField.latex("m(a-m_2)");
    assert.equal(controller.lastResult.status, "safe", "implicit multiplication is safe");
    assert.equal(input.value, "m*(a-m_2)", "single-letter variable is written as MITx multiplication");

    const nativeInput = window.document.querySelector("#input_elevator_native");
    const nativeController = window.__psetterRuntime.controllers.get(nativeInput);
    nativeController.activate();
    assert.ok(nativeController.mathField, "existing native answer is editable");
    assert.equal(nativeInput.value, "m(a-m_2)", "native hydration is non-mutating");
    nativeController.mathField.moveToRightEnd();
    nativeController.typeCharacter("+");
    nativeController.typeCharacter("1");
    assert.equal(nativeController.lastResult.status, "safe", "edited native answer remains safe");
    assert.equal(
      nativeInput.value,
      "m(a-m_2)+1",
      "editing an existing native function call still writes back to MITx",
    );
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("each context semantic class keeps its identity through MathQuill and MITx output", async () => {
  const prompt = `<p>Find <span role="math" aria-label="sin(x)+alpha+v_0+G"></span>
    in terms of <code>pi</code> and <code>e</code>.</p>`;
  const { dom, window } = await createRuntime(problem("classes", prompt));
  try {
    const controller = window.__psetterRuntime.controllers.get(
      window.document.querySelector("#input_classes"),
    );
    const suggestions = contextItems(controller);
    const cases = [
      ["context:function:sin", "sin(x)", ["x", ")"]],
      ["context:variable:x", "x", []],
      ["context:greek:alpha", "alpha", []],
      ["context:variable:v_0", "v_0", []],
      ["context:variable:G", "G", []],
      ["context:constant:pi", "pi", []],
      ["context:constant:e", "e", []],
    ];
    assert.deepEqual(
      suggestions.map((item) => item.id),
      cases.map(([id]) => id),
    );
    for (const [id, expected, suffix] of cases) {
      controller.clearExpression();
      controller.detailsPanel.querySelector(`[data-symbol-id="${id}"]`).click();
      for (const character of suffix) controller.typeCharacter(character);
      assert.equal(controller.input.value, expected, id);
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("activation, teardown, config refresh, and repeated off/on cycles never rewrite answers", async () => {
  const expressions = [
    "sin(x)",
    "sqrt(sin(x))",
    "arctan(v_0/lambda)",
    "alpha+theta",
    "x_1+x_2",
    "velocity+time",
    "2*x",
    "2x",
    "(a+b)/(c-d)",
    "x^(-2)",
    "-(-x)",
    "((a+b)*c)",
  ];
  const html = `<div class="problems-wrapper">${expressions
    .map((value, index) => problem(`life_${index}`, `<p><span role="math" aria-label="${value}"></span></p>`, value))
    .join("")}</div>`;
  const { dom, window } = await createRuntime(html);
  try {
    const manager = window.__psetterRuntime;
    const values = () => expressions.map((_, index) => window.document.querySelector(`#input_life_${index}`).value);
    assert.deepEqual(values(), expressions);
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let index = 0; index < expressions.length; index++) {
        const input = window.document.querySelector(`#input_life_${index}`);
        const controller = manager.controllers.get(input);
        controller.activate();
        controller.deactivate();
      }
      assert.deepEqual(values(), expressions, `controller cycle ${cycle + 1}`);
    }

    manager.applyRemoteConfig({ ...remoteConfig, maintenanceMessage: "Compatibility notice" });
    assert.deepEqual(values(), expressions, "remote config refresh");
    manager.disposeAll();
    manager.scan();
    assert.deepEqual(values(), expressions, "controller recreation");

    for (let cycle = 0; cycle < 3; cycle++) {
      manager.settings = { ...manager.settings, enabled: false };
      manager.applySettings();
      assert.deepEqual(values(), expressions, `off cycle ${cycle + 1}`);
      manager.settings = { ...manager.settings, enabled: true, inlineEnabledDefault: true };
      manager.applySettings();
      assert.deepEqual(values(), expressions, `on cycle ${cycle + 1}`);
    }

    manager.settings = { ...manager.settings, enabled: false };
    manager.applySettings();
    const edited = window.document.querySelector("#input_life_2");
    edited.value = "atan(custom_1)";
    edited.dispatchEvent(new window.Event("input", { bubbles: true }));
    manager.settings = { ...manager.settings, enabled: true, inlineEnabledDefault: true };
    manager.applySettings();
    manager.controllers.get(edited).activate();
    manager.controllers.get(edited).deactivate();
    assert.equal(edited.value, "atan(custom_1)");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("authored editor source survives edit-off-on cycles before more text is added", async () => {
  const { dom, window } = await createRuntime(
    problem(
      "gravity_cycle",
      '<p>Express <span role="math" aria-label="F"></span> in terms of <code>G</code>, <code>M</code>, <code>m</code>, and <code>r</code>.</p><p><span role="math" aria-label="F equals"></span></p>',
      "G*M*m/r^2",
    ),
  );
  try {
    const manager = window.__psetterRuntime;
    const input = window.document.querySelector("#input_gravity_cycle");
    let controller = manager.controllers.get(input);
    controller.activate();
    controller.mathField.moveToRightEnd();
    for (const character of "GGG") controller.typeCharacter(character);
    const authoredLatex = controller.mathField.latex();
    assert.equal(input.value, "G*M*m/r^2*G*G*G");
    assert.doesNotMatch(input.value, /CatalanConstant/);

    manager.applyRemoteConfig({ ...remoteConfig, maintenanceMessage: "Refresh" });
    controller = manager.controllers.get(input);
    controller.activate();
    assert.equal(controller.mathField.latex(), authoredLatex, "remote config recreation");
    manager.disposeAll();
    manager.scan();
    controller = manager.controllers.get(input);
    controller.activate();
    assert.equal(controller.mathField.latex(), authoredLatex, "controller recreation");

    for (let cycle = 0; cycle < 3; cycle++) {
      manager.settings = { ...manager.settings, enabled: false };
      manager.applySettings();
      assert.equal(window.document.querySelectorAll(".pset-math-takeover").length, 0);
      manager.settings = { ...manager.settings, enabled: true, inlineEnabledDefault: true };
      manager.applySettings();
      controller = manager.controllers.get(input);
      controller.activate();
      assert.equal(controller.mathField.latex(), authoredLatex, `authored source cycle ${cycle + 1}`);
      assert.equal(input.value, "G*M*m/r^2*G*G*G", `native output cycle ${cycle + 1}`);
    }

    controller.mathField.moveToRightEnd();
    for (const character of "new") controller.typeCharacter(character);
    assert.equal(input.value, "G*M*m/r^2*G*G*G*n*e*w");
    assert.doesNotMatch(input.value, /CatalanConstant|C\*a\*t\*a\*l\*a\*n/);

    manager.settings = { ...manager.settings, enabled: false };
    manager.applySettings();
    input.value = "atan(custom_1)";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    manager.settings = { ...manager.settings, enabled: true, inlineEnabledDefault: true };
    manager.applySettings();
    controller = manager.controllers.get(input);
    controller.activate();
    assert.equal(input.value, "atan(custom_1)");
    assert.notEqual(controller.mathField.latex(), authoredLatex);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("edited expression classes preserve authored source through repeated lifecycle cycles", async () => {
  const expressions = [
    "sin(x)",
    "sqrt(sin(x))",
    "arctan(v_0/lambda)",
    "alpha+theta",
    "x_1+x_2",
    "velocity+time",
    "2*x",
    "2x",
    "(a+b)/(c-d)",
    "x^(-2)",
    "-(-x)",
    "((a+b)*c)",
  ];
  const { dom, window } = await createRuntime(
    expressions.map((value, index) => problem(`edited_${index}`, `<p><span role="math" aria-label="${value}"></span></p>`, value)).join(""),
  );
  try {
    const manager = window.__psetterRuntime;
    const expected = [];
    for (let index = 0; index < expressions.length; index++) {
      const input = window.document.querySelector(`#input_edited_${index}`);
      const controller = manager.controllers.get(input);
      controller.activate();
      assert.ok(controller.mathField, `native hydration admitted: ${expressions[index]}`);
      controller.mathField.moveToRightEnd();
      controller.typeCharacter("+");
      controller.typeCharacter("z");
      expected.push({ latex: controller.mathField.latex(), native: input.value });
      controller.deactivate();
    }
    for (let cycle = 0; cycle < 3; cycle++) {
      manager.settings = { ...manager.settings, enabled: false };
      manager.applySettings();
      assert.equal(window.document.querySelectorAll(".pset-math-takeover").length, 0);
      manager.settings = { ...manager.settings, enabled: true, inlineEnabledDefault: true };
      manager.applySettings();
      for (let index = 0; index < expressions.length; index++) {
        const input = window.document.querySelector(`#input_edited_${index}`);
        const controller = manager.controllers.get(input);
        controller.activate();
        assert.equal(controller.mathField.latex(), expected[index].latex, `latex ${index} cycle ${cycle + 1}`);
        assert.equal(input.value, expected[index].native, `native ${index} cycle ${cycle + 1}`);
        assert.doesNotMatch(input.value, /CatalanConstant|GoldenRatio|EulerGamma/);
        controller.deactivate();
      }
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("numeric literals preserve authored leading and trailing zero precision across edits and lifecycle cycles", async () => {
  const expressions = [
    "00343.400",
    "0.50",
    "2.500",
    "0.00450",
    ".50",
    "0002.50",
    "-0.50",
    "5.0*10^3",
  ];
  const { dom, window } = await createRuntime(
    expressions
      .map((value, index) =>
        problem(`numeric_precision_${index}`, `<p>Enter ${value}.</p>`, value),
      )
      .join(""),
  );
  try {
    const manager = window.__psetterRuntime;
    for (let index = 0; index < expressions.length; index++) {
      const original = expressions[index];
      const input = window.document.querySelector(`#input_numeric_precision_${index}`);
      const controller = manager.controllers.get(input);
      assert.equal(input.value, original, `native source before hydration: ${original}`);
      controller.activate();
      assert.ok(controller.mathField, `hydration admitted: ${original}; ${controller.lastResult?.errors?.join(" | ")}`);
      assert.equal(input.value, original, `hydration preserves lexical source: ${original}`);
      const lexical = original.startsWith(".") ? `0${original}` : original;

      controller.mathField.moveToRightEnd();
      controller.typeCharacter("+");
      controller.typeCharacter("x");
      assert.match(
        input.value,
        new RegExp(lexical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `unrelated edit preserves numeric spelling: ${original}; actual ${input.value}`,
      );
      const editedNative = input.value;
      controller.deactivate();

      for (let cycle = 0; cycle < 4; cycle++) {
        manager.settings = { ...manager.settings, enabled: false };
        manager.applySettings();
        manager.settings = { ...manager.settings, enabled: true, inlineEnabledDefault: true };
        manager.applySettings();
        const current = manager.controllers.get(input);
        current.activate();
        assert.equal(input.value, editedNative, `numeric source cycle ${cycle + 1}: ${original}`);
        current.deactivate();
      }
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("MITx metric affixes remain atomic and differ from explicit multiplication", async () => {
  const metricAffixes = ["d", "c", "m", "u", "n", "p", "k", "M", "G", "T"];
  const expressions = metricAffixes.flatMap((affix) => [`2${affix}`, `2*${affix}`]);
  const { dom, window } = await createRuntime(
    expressions
      .map((value, index) => problem(`metric_${index}`, `<p>Enter ${value}.</p>`, value))
      .join(""),
  );
  try {
    for (let index = 0; index < expressions.length; index += 2) {
      const affixed = expressions[index];
      const multiplied = expressions[index + 1];
      const input = window.document.querySelector(`#input_metric_${index}`);
      const controller = window.__psetterRuntime.controllers.get(input);
      controller.activate();
      assert.ok(controller.mathField, `affix hydration: ${affixed}`);
      assert.equal(input.value, affixed, `non-mutating hydration: ${affixed}`);
      assert.match(
        controller.mathField.latex(),
        new RegExp(`^2\\\\mathrm\\{${affixed.slice(1)}\\}$`),
        `native metric provenance: ${affixed}`,
      );
      assert.equal(controller.nativeEquivalentForQa(affixed), true, affixed);
      assert.equal(controller.nativeEquivalentForQa(multiplied), false, `${affixed} != ${multiplied}`);
      assert.equal(
        controller.convertLatexForQa(affixed).output,
        multiplied,
        `plain editor adjacency is multiplication: ${affixed}`,
      );
      controller.mathField.moveToRightEnd();
      controller.typeCharacter("+");
      controller.typeCharacter("0");
      assert.equal(input.value, `${affixed}+0`, `edit: ${affixed}`);
      assert.equal(controller.lastResult.status, "safe", `safe edit: ${affixed}`);

      const explicitInput = window.document.querySelector(`#input_metric_${index + 1}`);
      const explicitController = window.__psetterRuntime.controllers.get(explicitInput);
      explicitController.activate();
      assert.ok(explicitController.mathField, `multiplication hydration: ${multiplied}`);
      assert.equal(explicitInput.value, multiplied);
      assert.equal(explicitController.nativeEquivalentForQa(affixed), false);
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("question-defined affix letters win over metric syntax in visual editing", async () => {
  const affixes = ["d", "c", "m", "u", "n", "p", "k", "M", "G", "T"];
  const { dom, window } = await createRuntime(
    affixes
      .flatMap((affix, index) => [
        problem(
          `context_affix_editor_${index}`,
          `<p>Use <span role="math" aria-label="${affix}"></span> in your answer.</p>`,
        ),
        problem(
          `context_affix_native_${index}`,
          `<p>Use <span role="math" aria-label="${affix}"></span> in your answer.</p>`,
          `2${affix}`,
        ),
      ])
      .join(""),
  );
  try {
    for (let index = 0; index < affixes.length; index++) {
      const affix = affixes[index];
      const nativeInput = window.document.querySelector(
        `#input_context_affix_native_${index}`,
      );
      const nativeController = window.__psetterRuntime.controllers.get(nativeInput);
      nativeController.activate();
      assert.ok(nativeController.mathField, `contextual native hydration: ${affix}`);
      assert.equal(nativeInput.value, `2${affix}`, `native provenance wins: ${affix}`);
      assert.match(nativeController.mathField.latex(), /\\mathrm/, affix);

      const input = window.document.querySelector(`#input_context_affix_editor_${index}`);
      const controller = window.__psetterRuntime.controllers.get(input);
      controller.activate();
      const symbol = controller.semanticContext.items.find(
        (item) => item.outputName === affix,
      );
      assert.ok(symbol, `context symbol: ${affix}`);
      controller.mathField.latex("2");
      controller.insertSymbol(symbol);
      assert.equal(input.value, `2*${affix}`, `contextual adjacency: ${affix}`);
      assert.equal(controller.lastResult.status, "safe", affix);
      assert.doesNotMatch(controller.mathField.latex(), /\\mathrm/, affix);
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("fresh reserved symbols are preserved and bare functions remain drafts", async () => {
  const { dom, window } = await createRuntime(problem("fresh_lexical", "<p>Enter an expression.</p>"));
  try {
    const input = window.document.querySelector("#input_fresh_lexical");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    controller.detailsOpen = true;
    controller.mountDetailsPanel();
    assert.equal(
      controller.detailsPanel.querySelector('[data-symbol-id="epsilon"]')?.textContent,
      "ϵ",
    );
    assert.equal(
      controller.detailsPanel.querySelector('[data-symbol-id="phi"]')?.textContent,
      "ϕ",
    );

    controller.mathField.latex("G");
    assert.equal(input.value, "G");
    assert.equal(controller.lastResult.status, "safe");
    assert.doesNotMatch(input.value, /CatalanConstant/);

    controller.mathField.latex(String.raw`\zeta`);
    assert.equal(input.value, "zeta");
    assert.equal(controller.lastResult.status, "safe");
    assert.doesNotMatch(input.value, /\bZeta\b/);

    const committed = input.value;
    for (const bare of [String.raw`\sin`, String.raw`2+\cos`]) {
      controller.mathField.latex(bare);
      assert.equal(controller.lastResult.status, "ambiguous", bare);
      assert.equal(input.value, committed, `bare function must not commit: ${bare}`);
    }
    controller.mathField.latex(String.raw`\sin\left(x\right)`);
    assert.equal(input.value, "sin(x)");
    assert.equal(controller.lastResult.status, "safe");
    for (const name of [
      "arcsinh", "arccosh", "arctanh", "arcsec", "sech", "arcsech",
      "arccsc", "csch", "arccsch", "arccot", "coth", "arccoth",
    ]) {
      controller.mathField.latex(String.raw`\operatorname{${name}}\left(x\right)`);
      assert.equal(controller.lastResult.status, "safe", name);
      assert.equal(input.value, `${name}(x)`, name);
    }

    controller.mathField.latex("5!");
    assert.equal(controller.lastResult.status, "safe", "postfix factorial");
    assert.equal(input.value, "factorial(5)");
    for (const name of ["fact", "factorial"]) {
      controller.mathField.latex(
        String.raw`\operatorname{${name}}\left(5\right)`,
      );
      assert.equal(controller.lastResult.status, "ambiguous", `fresh ${name}`);
      assert.equal(input.value, "factorial(5)", `fresh ${name} does not commit`);
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("a newer Psetter runtime lease tears down the prior instance UI and a waiting copy can reclaim a removed lease", async () => {
  const { dom, window } = await createRuntime(problem("lease", "<p>Find x.</p>", "x"));
  try {
    const manager = window.__psetterRuntime;
    const controller = manager.controllers.get(window.document.querySelector("#input_lease"));
    controller.activate();
    controller.scheduleMathFieldFocus();
    assert.equal(window.document.querySelectorAll(".pset-math-takeover").length, 1);
    window.document.documentElement.setAttribute("data-psetter-runtime-owner", "new-runtime");
    window.document.dispatchEvent(new window.Event("psetter-runtime-owner-changed"));
    assert.equal(manager.disposed, true);
    assert.equal(window.document.querySelectorAll(".pset-math-takeover").length, 0);
    assert.equal(window.document.querySelectorAll(".pset-math-global-controls").length, 0);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(controller.typeCharacter("z"), false, "losing runtime generation is inert");
    assert.equal(window.document.querySelector("#input_lease").value, "x");

    window.document.documentElement.removeAttribute("data-psetter-runtime-owner");
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    const replacement = window.__psetterRuntime;
    assert.ok(replacement && replacement !== manager, "standby runtime reclaimed removed lease");
    assert.equal(replacement.disposed, false);
    assert.equal(
      window.document.documentElement.getAttribute("data-psetter-runtime-owner"),
      replacement.runtimeOwner,
    );
    assert.equal(replacement.controllers.size, 1);
    assert.equal(window.document.querySelectorAll(".pset-math-global-controls").length, 1);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("turning Psetter off removes nested UI left by another installed copy", async () => {
  const { dom, window } = await createRuntime(problem("duplicate", "<p>Find x.</p>", "x"));
  try {
    const manager = window.__psetterRuntime;
    const input = window.document.querySelector("#input_duplicate");
    const controller = manager.controllers.get(input);
    controller.activate();
    const ownTakeover = window.document.querySelector(".pset-math-takeover");
    const foreignTakeover = window.document.createElement("span");
    foreignTakeover.className = "pset-math-takeover foreign-copy";
    ownTakeover.parentNode.insertBefore(foreignTakeover, ownTakeover);
    foreignTakeover.appendChild(ownTakeover);
    manager.settings = { ...manager.settings, enabled: false };
    manager.applySettings();
    assert.equal(window.document.querySelectorAll(".pset-math-takeover").length, 0);
    assert.equal(input.isConnected, true);
    assert.equal(input.value, "x");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("the visible toggle immediately closes an active editor before storage settles", async () => {
  const { dom, window, storage } = await createRuntime(problem("toggle", "<p>Find x.</p>", "x"));
  try {
    const manager = window.__psetterRuntime;
    const input = window.document.querySelector("#input_toggle");
    const controller = manager.controllers.get(input);
    controller.activate();
    let staleActivation = 0;
    input.addEventListener("focus", () => staleActivation++);
    assert.equal(window.document.querySelectorAll(".pset-math-takeover").length, 1);
    await manager.toggleEnabled();
    assert.equal(storage.psetMathSettings.enabled, false);
    assert.equal(manager.settings.enabled, false);
    assert.equal(window.document.querySelectorAll(".pset-math-takeover").length, 0);
    assert.equal(window.document.querySelectorAll(".pset-math-trigger").length, 0);
    assert.equal(input.isConnected, true);
    assert.equal(input.value, "x");
    input.dispatchEvent(new window.Event("focus", { bubbles: true }));
    assert.equal(staleActivation, 1, "disabled Psetter preserves the page's native focus listener");
    await manager.toggleEnabled();
    assert.equal(storage.psetMathSettings.enabled, true);
    await new Promise((resolve) => window.setTimeout(resolve, 30));
    manager.controllers.get(input).activate();
    assert.equal(window.document.querySelectorAll(".pset-math-takeover").length, 1);
    input.dispatchEvent(new window.Event("focus", { bubbles: true }));
    assert.equal(staleActivation, 2, "enabled page preserves the same native focus behavior");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("outside clicks close the editor while its details panel is open", async () => {
  const { dom, window } = await createRuntime(problem("outside_close", "<p>Find x.</p>", "x"));
  try {
    const manager = window.__psetterRuntime;
    const input = window.document.querySelector("#input_outside_close");
    const controller = manager.controllers.get(input);
    manager.activeController = controller;
    controller.activate();
    controller.toggleDetails();
    assert.equal(controller.detailsOpen, true);

    controller.detailsPanel.dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
    assert.equal(manager.activeController, controller, "clicks inside the details panel stay owned");
    assert.equal(controller.active, true);

    const outsideButton = window.document.createElement("button");
    window.document.body.appendChild(outsideButton);
    outsideButton.dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
    assert.equal(manager.activeController, undefined);
    assert.equal(controller.active, false);
    assert.equal(input.value, "x", "closing the editor preserves the MITx answer");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("stale settings writes cannot restore Psetter after a newer native-off transition", async () => {
  const { dom, window, storage } = await createRuntime(
    problem("settings_race", "<p>Find x.</p>", "x"),
    {
      storageSetDelay: (value) => (value.psetMathSettings?.enabled ? 45 : 0),
    },
  );
  try {
    const manager = window.__psetterRuntime;
    manager.settings = { ...manager.settings, enabled: true, inlineEnabledDefault: true };
    const staleOnWrite = manager.persistSettings();
    manager.settings = { ...manager.settings, enabled: false, inlineEnabledDefault: false };
    manager.applySettings();
    const currentOffWrite = manager.persistSettings();
    await Promise.all([staleOnWrite, currentOffWrite]);
    assert.equal(storage.psetMathSettings.enabled, false);
    assert.equal(manager.settings.enabled, false);
    assert.equal(window.document.documentElement.getAttribute("data-psetter-disabled"), "true");
    assert.equal(window.document.querySelectorAll(".pset-math-takeover").length, 0);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("disabled Psetter preserves the extension-absent native event trace", async () => {
  const html = `<form id="native-form">${problem("native_trace", "<p>Find x.</p>", "x")}</form>`;
  const installTrace = (window, trace) => {
    const input = window.document.querySelector("#input_native_trace");
    const form = window.document.querySelector("#native-form");
    for (const type of ["focus", "keydown", "input", "change"])
      input.addEventListener(type, (event) => trace.push(`${type}:${event.defaultPrevented}`));
    form.addEventListener("submit", (event) => {
      trace.push(`submit:${event.defaultPrevented}`);
      event.preventDefault();
    });
  };
  const exercise = (window) => {
    const input = window.document.querySelector("#input_native_trace");
    const form = window.document.querySelector("#native-form");
    input.dispatchEvent(new window.FocusEvent("focus"));
    input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true }));
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  };

  const absentDom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: "https://lms.mitx.mit.edu/xblock/test",
    pretendToBeVisual: true,
  });
  const absentTrace = [];
  installTrace(absentDom.window, absentTrace);
  exercise(absentDom.window);

  const disabledTrace = [];
  const { dom, window } = await createRuntime(html, {
    beforeRuntime: (runtimeWindow) => installTrace(runtimeWindow, disabledTrace),
  });
  try {
    const manager = window.__psetterRuntime;
    manager.settings = { ...manager.settings, enabled: false };
    manager.applySettings();
    exercise(window);
    assert.deepEqual(disabledTrace, absentTrace);
    assert.equal(window.document.querySelectorAll(".pset-math-takeover").length, 0);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
    absentDom.window.close();
  }
});

test("the global off command reaches embedded MITx answer frames", async () => {
  const { dom, window } = await createRuntime(problem("frame-toggle", "<p>Find x.</p>", "x"));
  try {
    const manager = window.__psetterRuntime;
    const iframe = window.document.createElement("iframe");
    iframe.src = "https://courses.mitx.mit.edu/course/frame";
    const messages = [];
    Object.defineProperty(iframe, "contentWindow", {
      configurable: true,
      value: { postMessage: (data, targetOrigin) => messages.push({ data, targetOrigin }) },
    });
    window.document.body.appendChild(iframe);

    manager.notifyFrames("psetter-disable");
    assert.equal(messages.length, 1);
    assert.equal(messages[0].data.target, "psetter-disable");
    assert.equal(messages[0].targetOrigin, "https://courses.mitx.mit.edu");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("an embedded runtime forwards off commands to deeper answer frames", async () => {
  const { dom, window } = await createRuntime(problem("nested-frame-toggle", "<p>Find x.</p>", "x"));
  try {
    const manager = window.__psetterRuntime;
    manager.isTopWindow = false;
    const iframe = window.document.createElement("iframe");
    iframe.src = "https://courses.mitx.mit.edu/course/deep-answer";
    const messages = [];
    Object.defineProperty(iframe, "contentWindow", {
      configurable: true,
      value: { postMessage: (data, targetOrigin) => messages.push({ data, targetOrigin }) },
    });
    window.document.body.appendChild(iframe);

    window.dispatchEvent(
      new window.MessageEvent("message", {
        origin: "https://courses.mitx.mit.edu",
        source: { postMessage() {} },
        data: { target: "psetter-disable" },
      }),
    );
    assert.equal(manager.settings.enabled, true, "same-origin non-parent sender is ignored");
    assert.equal(messages.length, 0);

    window.dispatchEvent(
      new window.MessageEvent("message", {
        origin: "https://courses.mitx.mit.edu",
        source: window.parent,
        data: { target: "psetter-disable" },
      }),
    );
    assert.equal(manager.settings.enabled, false);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].data.target, "psetter-disable");
    assert.equal(messages[0].targetOrigin, "https://courses.mitx.mit.edu");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("clicking the visible toggle invokes the same immediate off path", async () => {
  const { dom, window } = await createRuntime(problem("toggle-click", "<p>Find x.</p>", "x"));
  try {
    const manager = window.__psetterRuntime;
    const input = window.document.querySelector("#input_toggle-click");
    manager.controllers.get(input).activate();
    manager.globalToggle.dispatchEvent(new window.Event("pointerup", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(manager.settings.enabled, false);
    assert.equal(window.document.querySelectorAll(".pset-math-takeover").length, 0);
    assert.equal(input.isConnected, true);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("community feedback control fails closed without opening a hosted service", async () => {
  const { dom, window } = await createRuntime(problem("feedback", "<p>Find x.</p>"));
  try {
    const popups = [];
    window.open = (...args) => popups.push(args);
    const manager = window.__psetterRuntime;
    const controller = manager.controllers.get(window.document.querySelector("#input_feedback"));
    contextItems(controller);
    const feedback = controller.detailsPanel.querySelector("button.pset-math-feedback-link");
    assert.ok(feedback);
    feedback.click();
    assert.deepEqual(JSON.parse(JSON.stringify(await manager.openFeedback())), { ok: false });
    assert.equal(popups.length, 0);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("Store feedback delegates popup creation to the extension background API", async () => {
  const messages = [];
  const { dom, window, runtimeMessageListener } = await createRuntime(problem("store_feedback", "<p>Find x.</p>"), {
    beforeRuntime(currentWindow) {
      currentWindow.__psetterConfig = {
        settingsKey: "psetMathSettings",
        symbolsOpenKey: "psetMathSymbolsOpen",
        usageKey: "psetMathUsage",
        restoreHintKey: "psetterRestoreHintV1",
        feedbackEnabled: true,
        feedbackHostPath: "feedback-host.html",
        buildChannel: "production",
        mitxHostname: "mitx.mit.edu",
      };
      currentWindow.chrome.runtime.sendMessage = async (message) => {
        messages.push(message);
        return { ok: true, windowId: 7 };
      };
    },
  });
  try {
    const manager = window.__psetterRuntime;
    const responsePromise = new Promise((resolve) => {
      assert.equal(
        runtimeMessageListener({ target: "psetter-open-feedback" }, {}, resolve),
        true,
      );
    });
    assert.deepEqual(JSON.parse(JSON.stringify(await responsePromise)), { ok: true, windowId: 7 });
    assert.deepEqual(JSON.parse(JSON.stringify(messages[0])), {
      target: "psetter-open-feedback",
      path: "feedback-host.html",
      version: "0.1.1",
    });
    manager.closeFeedback();
    assert.deepEqual(JSON.parse(JSON.stringify(messages[1])), {
      target: "psetter-close-feedback",
      windowId: 7,
    });
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("unsafe and ambiguous conversions preserve native bytes and emit no synthetic events", async () => {
  const cases = [
    ["sum", String.raw`\sum_{i=1}^{n}i`],
    ["matrix", String.raw`\begin{matrix}a&b\\c&d\end{matrix}`],
    ["plus-minus", String.raw`x\pm y`],
    ["unknown-head", String.raw`\operatorname{mystery}(x)`],
    ["decoration", String.raw`\overline{x}`],
    ["unknown-unicode", "x⊕y"],
  ];
  const { dom, window } = await createRuntime(
    cases.map(([id]) => problem(`unsafe_${id}`, '<p><span role="math" aria-label="x"></span></p>', "x")).join(""),
  );
  try {
    for (const [id, latex] of cases) {
      const input = window.document.querySelector(`#input_unsafe_${id}`);
      const events = { input: 0, change: 0, keyup: 0 };
      for (const type of Object.keys(events)) input.addEventListener(type, () => events[type]++);
      const controller = window.__psetterRuntime.controllers.get(input);
      controller.activate();
      assert.ok(controller.mathField, id);
      const direct = controller.convertLatexForQa(latex);
      assert.notEqual(direct.status, "safe", `${id}: converter outcome`);
      controller.mathField.latex(latex);
      assert.equal(input.value, "x", `${id}: native value`);
      assert.deepEqual(events, { input: 0, change: 0, keyup: 0 }, `${id}: rejected events`);

      controller.mathField.latex("x+1");
      assert.equal(input.value, "x+1", `${id}: later valid edit`);
      assert.deepEqual(events, { input: 1, change: 1, keyup: 1 }, `${id}: valid event contract`);
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("claimed native MITx syntax round-trips semantically before and after an unrelated edit", async () => {
  const generatedSymbols = ["x", "G", "mass", "alpha", "v_0"];
  const generated = generatedSymbols.flatMap((symbol, index) => [
    `sin(${symbol})`,
    `log10(${symbol})`,
    `log2(${symbol})`,
    `sqrt(exp(${symbol}))`,
    `foo(${symbol},y)`,
    `(${symbol}+y)/(z-${index + 1})`,
    `${symbol}^(-2)`,
  ]);
  const expressions = [...new Set([
    "log10(x)", "log2(x)", "foo(x,y)", "mass+time", "sin(x)",
    "fact(5)", "factorial(5)",
    "sqrt(sin(x))", "atan(custom_1)", "alpha+theta", "x_1+x_2",
    "2*x", "2x", "(a+b)/(c-d)", "x^(-2)", "-(-x)",
    "02*x", "2.0*x", "0.50*x", "x+0", "0+x", "x*0", "0*x",
    ...generated,
  ])];
  const { dom, window } = await createRuntime(
    expressions.map((value, index) => problem(`roundtrip_${index}`, `<p><span role="math" aria-label="${value}"></span></p>`, value)).join(""),
  );
  try {
    for (let index = 0; index < expressions.length; index++) {
      const original = expressions[index];
      const input = window.document.querySelector(`#input_roundtrip_${index}`);
      const events = { input: 0, change: 0, keyup: 0 };
      for (const type of Object.keys(events)) input.addEventListener(type, () => events[type]++);
      const controller = window.__psetterRuntime.controllers.get(input);
      controller.activate();
      assert.ok(
        controller.mathField,
        `admitted: ${original}; ${controller.lastResult.errors.join(" | ")}`,
      );
      assert.equal(input.value, original, `hydration is non-mutating: ${original}`);
      assert.deepEqual(events, { input: 0, change: 0, keyup: 0 }, `hydration events: ${original}`);
      controller.mathField.moveToRightEnd();
      controller.typeCharacter("+");
      controller.typeCharacter("0");
      assert.equal(
        controller.nativeEquivalentForQa(`${original}+0`),
        true,
        `semantic edit: ${original}; actual ${input.value}; latex ${controller.mathField.latex()}; result ${JSON.stringify(controller.lastResult)}`,
      );
      assert.doesNotMatch(input.value, /CatalanConstant|GoldenRatio|EulerGamma/);
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("unsupported native syntax is not claimed and a later valid native edit is respected", async () => {
  const { dom, window } = await createRuntime(problem("blocked_native", "<p>Find x.</p>", "x⊕y"));
  try {
    const input = window.document.querySelector("#input_blocked_native");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    assert.equal(controller.mathField, undefined);
    assert.equal(input.value, "x⊕y");
    assert.equal(window.document.querySelectorAll(".pset-math-takeover").length, 0);

    input.value = "foo(x,y)";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.equal(controller.mathField, undefined, "native editing remains in control");
    controller.nativeInputButton.click();
    assert.ok(controller.mathField, "explicit retry admits the valid edit");
    assert.equal(input.value, "foo(x,y)");
    controller.mathField.moveToRightEnd();
    controller.typeCharacter("+");
    controller.typeCharacter("1");
    assert.equal(controller.nativeEquivalentForQa("foo(x,y)+1"), true);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("answer targets, complete semantic context, and the visible context subset stay separate", async () => {
  const many = Array.from({ length: 60 }, (_, index) => `q_${index}`);
  many.push("G");
  const prompt = `<p><span role="math" aria-label="${many.join("+")}"></span></p>
    <p><span role="math" aria-label="F(x) equals"></span></p>`;
  const { dom, window } = await createRuntime(problem("context_depth", prompt, "G"));
  try {
    const controller = window.__psetterRuntime.controllers.get(
      window.document.querySelector("#input_context_depth"),
    );
    const visible = contextItems(controller);
    assert.equal(visible.length, 12, "palette is intentionally bounded");
    assert.equal(visible.some((item) => item.text === "G"), false, "G is beyond the UI limit");
    assert.equal(controller.semanticContext.items.some((item) => item.outputName === "G"), true);
    assert.equal(controller.semanticContext.items.some((item) => item.outputName === "F"), false);
    assert.equal(controller.semanticContext.items.some((item) => item.outputName === "x"), true);
    controller.mathField.moveToRightEnd();
    controller.typeCharacter("+");
    controller.typeCharacter("G");
    assert.equal(controller.input.value, "G+G", "off-palette context still protects parser identity");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("generated context entries retain identity through insertion, parsing, and serialization", async () => {
  const collisions = [...new Set([
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    ..."abcdefghijklmnopqrstuvwxyz",
    "pi", "phi", "gamma", "zeta", "Gamma", "Theta", "Phi",
    "alpha", "lambda", "omega",
  ])];
  const prompt = `<p><span role="math" aria-label="${collisions.join("+")}+sin(x)+log10(x)+sqrt(x)+𝐺+𝑥"></span></p>
    <p>Let <code>mass</code> be a variable.</p>`;
  const { dom, window } = await createRuntime(problem("collision_classes", prompt));
  try {
    const controller = window.__psetterRuntime.controllers.get(
      window.document.querySelector("#input_collision_classes"),
    );
    controller.activate();
    for (const item of controller.semanticContext.items) {
      controller.clearExpression();
      controller.insertSymbol(item);
      if (item.semanticKind === "function") {
        controller.typeCharacter("x");
        controller.typeCharacter(")");
        assert.match(controller.input.value, new RegExp(`^${item.outputName}\\(`), item.id);
      } else {
        assert.equal(
          controller.input.value,
          item.outputName,
          `${item.id}: ${JSON.stringify(controller.lastResult)} / ${controller.mathField.latex()}`,
        );
      }
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("question-derived representational variants canonicalize and remain authoritative", async () => {
  const prompt = `<p><math><mi mathvariant="bold">𝐺</mi><mo>+</mo><mi>𝜁</mi></math></p>
    <p><span role="math" aria-label="\\mathbf{x}+\\zeta+ϵ+ε+ϑ+ϕ+φ+ϰ+⊕"></span></p>`;
  const { dom, window } = await createRuntime(problem("canonical_context", prompt));
  try {
    const controller = window.__psetterRuntime.controllers.get(
      window.document.querySelector("#input_canonical_context"),
    );
    controller.activate();
    const items = new Map(
      controller.semanticContext.items.map((item) => [item.outputName, item]),
    );
    assert.deepEqual(
      [...items.keys()].sort(),
      ["G", "epsilon", "kappa", "phi", "varepsilon", "varphi", "vartheta", "x", "zeta"],
    );
    assert.equal(items.get("G").rawRepresentation, "𝐺");
    assert.match(items.get("G").sourceRepresentation, /^<mi\b/);
    assert.equal(items.get("G").semanticAuthority, "problem-context");
    assert.equal(items.get("zeta").rawRepresentation, "𝜁");
    assert.equal(items.get("epsilon").rawRepresentation, "ϵ");
    assert.equal(items.get("varepsilon").rawRepresentation, "ε");
    assert.equal(items.get("vartheta").rawRepresentation, "ϑ");
    assert.equal(items.get("phi").rawRepresentation, "ϕ");
    assert.equal(items.get("varphi").rawRepresentation, "φ");
    assert.equal(items.get("kappa").rawRepresentation, "ϰ");
    assert.equal(items.get("x").rawRepresentation, String.raw`\mathbf{x}`);

    for (const name of [
      "G", "x", "zeta", "epsilon", "varepsilon", "vartheta", "phi", "varphi", "kappa",
    ]) {
      controller.clearExpression();
      controller.insertSymbol(items.get(name));
      assert.equal(controller.input.value, name, name);
      assert.equal(controller.lastResult.status, "safe", name);
    }
    assert.doesNotMatch(controller.input.value, /CatalanConstant|Zeta/);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("controller resources and native writes remain O(1) after 1000 recreations", async () => {
  const { dom, window } = await createRuntime(`<form>${problem("asymptotic", "<p>Find x.</p>", "x")}</form>`);
  try {
    const manager = window.__psetterRuntime;
    const input = window.document.querySelector("#input_asymptotic");
    const disposedSamples = [];
    for (let cycle = 0; cycle < 1000; cycle++) {
      const old = manager.controllers.get(input);
      if (cycle % 100 === 0) disposedSamples.push(old);
      manager.disposeAll();
      manager.scan();
    }
    assert.equal(manager.controllers.size, 1);
    assert.equal(window.document.querySelectorAll(".pset-math-trigger").length, 1);
    for (const old of disposedSamples) {
      assert.equal(old.disposed, true);
      assert.equal(old.resourceDisposers.length, 0);
      assert.equal(old.inlineDisposers.length, 0);
      assert.equal(old.detailsDisposers.length, 0);
      assert.equal(old.typeCharacter("z"), false, "disposed generation is inert");
    }

    input.dispatchEvent(new window.FocusEvent("focus", { bubbles: false }));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const controller = manager.controllers.get(input);
    assert.equal(manager.activeController, controller);
    assert.equal(window.document.querySelectorAll(".pset-math-takeover").length, 1);
    const events = { input: 0, change: 0, keyup: 0 };
    for (const type of Object.keys(events)) input.addEventListener(type, () => events[type]++);
    controller.mathField.latex("x+1");
    assert.equal(input.value, "x+1");
    assert.deepEqual(events, { input: 1, change: 1, keyup: 1 });
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("irrelevant DOM history does not trigger full rescans", async () => {
  const { dom, window } = await createRuntime(problem("mutation_cost", "<p>Find x.</p>", "x"));
  try {
    const manager = window.__psetterRuntime;
    const baseline = manager.scanCount;
    const container = window.document.createElement("aside");
    window.document.body.appendChild(container);
    for (let index = 0; index < 1000; index++)
      container.appendChild(window.document.createElement("span"));
    await new Promise((resolve) => window.setTimeout(resolve, 30));
    assert.equal(manager.scanCount, baseline);
    assert.equal(manager.controllers.size, 1);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("deterministic lifecycle state machine preserves ownership and native semantics", async () => {
  const seed = 0x5eedc0de;
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  const trace = [];
  const { dom, window } = await createRuntime(
    `<div id="state-host">${problem("state_machine", '<p><span role="math" aria-label="x+G"></span></p>', "x")}</div>`,
  );
  try {
    const manager = window.__psetterRuntime;
    let input = window.document.querySelector("#input_state_machine"),
      expected = "x";
    const enable = (value) => {
      manager.settings = {
        ...manager.settings,
        enabled: value,
        inlineEnabledDefault: value,
      };
      manager.applySettings();
    };
    for (let step = 0; step < 300; step++) {
      const operation = random() % 10;
      trace.push(`${step}:${operation}:${expected}`);
      if (trace.length > 40) trace.shift();
      try {
        if (operation === 0) {
          enable(false);
        } else if (operation === 1) {
          enable(true);
        } else if (operation === 2 && manager.settings.enabled) {
          manager.disposeAll();
          manager.scan();
        } else if (operation === 3 && manager.settings.enabled) {
          input.dispatchEvent(new window.FocusEvent("focus"));
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        } else if (operation === 4 && manager.settings.enabled) {
          const controller = manager.controllers.get(input);
          controller?.activate();
          if (controller?.mathField) {
            controller.mathField.latex(`x+${step}`);
            expected = input.value;
          }
        } else if (operation === 5 && manager.settings.enabled) {
          const controller = manager.controllers.get(input);
          controller?.activate();
          if (controller?.mathField) {
            controller.mathField.latex(String.raw`x\pm G`);
            assert.equal(input.value, expected, "unsafe edit");
          }
        } else if (operation === 6) {
          enable(false);
          expected = `G+${step}`;
          input.value = expected;
          input.dispatchEvent(new window.Event("input", { bubbles: true }));
        } else if (operation === 7) {
          const replacement = input.cloneNode(false);
          replacement.value = expected;
          input.replaceWith(replacement);
          input = replacement;
          await new Promise((resolve) => window.setTimeout(resolve, 30));
        } else if (operation === 8 && manager.settings.enabled) {
          const controller = manager.controllers.get(input);
          controller?.activate();
          if (controller?.controls?.isConnected) {
            controller.controls.parentNode.insertBefore(input, controller.controls);
            controller.controls.remove();
            await new Promise((resolve) => window.setTimeout(resolve, 30));
          }
        } else if (operation === 9) {
          manager.applyRemoteConfig({
            ...remoteConfig,
            maintenanceMessage: `state-${step}`,
          });
        }

        assert.equal(input.value, expected, "native model");
        assert.ok(manager.controllers.size <= 1, "one controller per target");
        assert.ok(window.document.querySelectorAll(".pset-math-takeover").length <= 1, "one wrapper");
        assert.ok(window.document.querySelectorAll("[data-pset-math-enhanced]").length <= 1, "one enhanced target");
        assert.ok(manager.editorStates.size <= manager.editorStateLimit, "bounded editor state");
        if (!manager.settings.enabled) {
          assert.equal(manager.controllers.size, 0, "disabled controller count");
          assert.equal(window.document.querySelectorAll(".pset-math-takeover").length, 0, "disabled wrapper count");
        }
      } catch (error) {
        error.message += `\nseed=${seed}; trace=${trace.join(" -> ")}`;
        throw error;
      }
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("SPA editor-state retention is bounded independently of page history", async () => {
  const { dom, window } = await createRuntime(problem("spa_state", "<p>Find x.</p>", "x"));
  try {
    const manager = window.__psetterRuntime;
    for (let index = 0; index < 1000; index++) {
      const syntheticInput = window.document.createElement("input");
      syntheticInput.id = `visited_problem_${index}`;
      manager.writeEditorState(syntheticInput, {
        latex: `x+${index}`,
        nativeOutput: `x+${index}`,
        mode: "numeric",
      });
    }
    assert.equal(manager.editorStates.size, 128);
    assert.equal(manager.editorStates.has("id:visited_problem_0"), false);
    assert.equal(manager.editorStates.has("id:visited_problem_999"), true);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("seeded unsupported-notation fuzzing never produces a safe conversion", async () => {
  const seed = 0x00c0ffee;
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state;
  };
  const commands = ["sum", "prod", "int", "overline", "underline", "hat", "vec", "matrix", "mystery", "phantom"];
  const unicode = ["⊕", "⊗", "∑", "∫", "∞", "±", "∂", "⌈", "⌊", "⋆"];
  const { dom, window } = await createRuntime(problem("fuzz", "<p>Find x.</p>", "x"));
  try {
    const controller = window.__psetterRuntime.controllers.get(
      window.document.querySelector("#input_fuzz"),
    );
    controller.activate();
    const failures = [];
    for (let iteration = 0; iteration < 500; iteration++) {
      const value = random();
      const command = commands[value % commands.length];
      const symbol = unicode[(value >>> 8) % unicode.length];
      const samples = [
        `\\${command}{x}`,
        `x${symbol}y`,
        `\\operatorname{unknown${value % 997}}(x)`,
        String.raw`\begin{matrix}a&b\\c&d\end{matrix}`,
        String.raw`x\pm y`,
        "x'",
      ];
      const latex = samples[(value >>> 16) % samples.length];
      const result = controller.convertLatexForQa(latex);
      if (result.status === "safe") failures.push({ iteration, latex, output: result.output });
    }
    assert.deepEqual(failures, [], `seed=${seed}`);
    assert.equal(controller.input.value, "x");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});


test("parentheses remain editable during typing and native answer hydration", async () => {
  const expressions = ["(x+1)", "2*(x+1)", "(x+1)/(y+2)", "((x+y)*(x-y))", "x^(2)*(y+1)", "(x^2)^3", "x+(y+1)", "x*(y*x)"];
  const { dom, window } = await createRuntime(expressions.map((value, index) =>
    problem(`group_${index}`, '<p><span role="math" aria-label="x+y"></span></p>', value),
  ).join(""));
  try {
    for (let index = 0; index < expressions.length; index++) {
      const input = window.document.querySelector(`#input_group_${index}`);
      const controller = window.__psetterRuntime.controllers.get(input);
      controller.activate();
      assert.ok(controller.mathField, `hydrate ${expressions[index]}`);
      assert.equal(input.value, expressions[index], "activation preserves native bytes");
      controller.mathField.moveToRightEnd();
      for (const key of "+(x+1)") controller.typeCharacter(key);
      assert.equal(controller.lastResult.status, "safe", JSON.stringify(controller.lastResult));
      assert.equal(controller.nativeEquivalentForQa(`${expressions[index]}+(x+1)`), true, input.value);
      controller.clearExpression();
      for (const key of expressions[index]) controller.typeCharacter(key);
      assert.equal(controller.lastResult.status, "safe", JSON.stringify(controller.lastResult));
      assert.equal(controller.nativeEquivalentForQa(expressions[index]), true, input.value);
      controller.deactivate();
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("declared multi-letter variables and plain aliases stay atomic across multiple answer fields", async () => {
  const { dom, window } = await createRuntime(`<section class="problem">
    <p>Use the following variables: <span role="math" aria-label="d t"></span>,
      <span role="math"><math><mi>d</mi><mi>x</mi></math></span>,
      and Deltat for <span role="math" aria-label="Delta t"></span>.</p>
    <div class="formulaequationinput"><input id="input_declared_1" class="math" type="text"></div>
    <div class="formulaequationinput"><input id="input_declared_2" class="math" type="text"></div>
  </section>`);
  try {
    for (const id of ["input_declared_1", "input_declared_2"]) {
      const input = window.document.getElementById(id);
      const controller = window.__psetterRuntime.controllers.get(input);
      controller.activate();
      for (const name of ["dt", "dx", "Deltat"]) {
        assert.ok(controller.semanticContext.aliases.has(name), `${id}: ${name} declaration`);
        controller.clearExpression();
        for (const key of `${name}+(x+1)`) controller.typeCharacter(key);
        assert.equal(controller.lastResult.status, "safe", JSON.stringify(controller.lastResult));
        assert.equal(controller.nativeEquivalentForQa(`${name}+(x+1)`), true, input.value);
        controller.clearExpression();
        for (const key of name.split("").join("*")) controller.typeCharacter(key);
        assert.equal(controller.nativeEquivalentForQa(name.split("").join("*")), true, "explicit products stay products");
      }
      controller.deactivate();
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});


test("seeded expression edits preserve grouping, native events, and lifecycle state", async () => {
  const seed = Number(process.env.PSETTER_INTERACTION_SEED ?? 0x140017) >>> 0;
  let state = seed;
  const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
  const leaves = ["x", "y", "2", "3", "dt", "dx"];
  const operators = ["+", "-", "*"];
  const expression = (depth) => depth === 0
    ? leaves[random() % leaves.length]
    : `(${expression(depth - 1)}${operators[random() % operators.length]}${expression(depth - 1)})`;
  const { dom, window } = await createRuntime(problem("generated_edits",
    '<p>Express the answer in terms of <code>dt</code>, <code>dx</code>, <span role="math" aria-label="x+y"></span>.</p>'));
  try {
    const input = window.document.querySelector("#input_generated_edits");
    const controller = window.__psetterRuntime.controllers.get(input);
    const events = { input: 0, change: 0, keyup: 0 };
    for (const type of Object.keys(events)) input.addEventListener(type, () => events[type]++);
    controller.activate();
    for (let iteration = 0; iteration < 64; iteration++) {
      const source = expression(1 + random() % 3);
      const trace = `seed=${seed} iteration=${iteration} source=${source}`;
      controller.clearExpression();
      for (const key of source) controller.typeCharacter(key);
      assert.equal(controller.lastResult.status, "safe", `${trace} result=${JSON.stringify(controller.lastResult)}`);
      assert.equal(controller.nativeEquivalentForQa(source), true, `${trace} output=${input.value}`);
      assert.equal(events.input, events.change, trace);
      assert.equal(events.input, events.keyup, trace);
      const output = input.value;
      const before = { ...events };
      controller.deactivate();
      controller.activate();
      assert.ok(controller.mathField, `${trace} output=${input.value} result=${JSON.stringify(controller.lastResult)}`);
      assert.equal(input.value, output, trace);
      assert.deepEqual(events, before, `${trace}: activation must emit no answer events`);
      controller.mathField.moveToRightEnd();
      for (const key of "+(1)") controller.typeCharacter(key);
      assert.equal(controller.nativeEquivalentForQa(`${source}+(1)`), true, `${trace}: editor remains responsive`);
    }
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("unknown native syntax leaves the native field editable and keys unclaimed", async () => {
  const { dom, window } = await createRuntime(problem("native_fallback", "<p>Enter an expression.</p>", "x⊕y"));
  try {
    const input = window.document.querySelector("#input_native_fallback");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    for (const key of ["(", "x", ")", "Backspace", "ArrowLeft"]) {
      const event = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      input.dispatchEvent(event);
      assert.equal(event.defaultPrevented, false, `${key}: native key remains available`);
      assert.equal(input.classList.contains("pset-math-native-covered"), false);
      assert.equal(input.readOnly, false);
      assert.equal(input.disabled, false);
      assert.equal(input.value, "x⊕y");
    }
    input.value = "(x+1)/(y+2)";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.equal(controller.mathField, undefined, "native editing does not cause takeover");
    controller.nativeInputButton.click();
    assert.ok(controller.mathField, "a supported native edit can be opened explicitly");
    assert.equal(input.value, "(x+1)/(y+2)");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});


test("variable declarations stay bounded to their list and problem", async () => {
  const { dom, window } = await createRuntime(`<section class="problem">
    <p>Express the answer in terms of <span role="math" aria-label="dt"></span>.
      Another product is <span role="math" aria-label="dx"></span>.</p>
    <p><span hidden>Use the following variables:</span><span role="math" aria-label="dy"></span></p>
    <div class="formulaequationinput"><input id="input_scoped_aliases" class="math" type="text"></div>
    </section>${problem("other_aliases", '<p><span role="math" aria-label="dt"></span></p>')}`);
  try {
    const first = window.__psetterRuntime.controllers.get(window.document.getElementById("input_scoped_aliases"));
    first.activate();
    assert.equal(first.semanticContext.aliases.has("dt"), true);
    assert.equal(first.semanticContext.aliases.has("dx"), false, "later narrative does not declare a name");
    assert.equal(first.semanticContext.aliases.has("dy"), false, "hidden instructions are not evidence");
    const other = window.__psetterRuntime.controllers.get(window.document.getElementById("input_other_aliases"));
    other.activate();
    assert.equal(other.semanticContext.aliases.has("dt"), false, "another problem does not inherit names");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("unfinished typing warns, preserves the native answer, and recovers on completion", async () => {
  const { dom, window } = await createRuntime(problem("draft_feedback", "<p>Find x.</p>", "x"));
  try {
    const input = window.document.querySelector("#input_draft_feedback");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    controller.mathField.moveToRightEnd();
    controller.typeCharacter("+");
    assert.equal(input.value, "x");
    assert.equal(controller.interactionNotice.hidden, false);
    assert.match(controller.interactionMessage.textContent, /Not synced to MITx/);
    assert.equal(controller.interactionNotice.dataset.state, "incomplete");
    const draft = controller.mathField.latex();
    controller.deactivate();
    controller.activate();
    assert.equal(controller.mathField.latex(), draft, "reopening preserves an unfinished draft");
    assert.equal(input.value, "x");
    controller.mathField.moveToRightEnd();
    controller.typeCharacter("1");
    assert.equal(input.value, "x+1");
    assert.equal(controller.interactionNotice.hidden, true);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("unsupported drafts can use native input without repeated interception or stale replay", async () => {
  const { dom, window } = await createRuntime(problem("native_choice", "<p>Find x.</p>", "x"));
  try {
    const input = window.document.querySelector("#input_native_choice");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    controller.mathField.latex(String.raw`\sum_{i=1}^{n}i`);
    const draft = controller.mathField.latex();
    assert.equal(input.value, "x");
    assert.equal(controller.interactionNotice.dataset.state, "unsupported");
    controller.nativeInputButton.focus();
    assert.equal(controller.active, true, "recovery control focus stays inside the editor session");
    controller.nativeInputButton.click();
    assert.equal(controller.mathField, undefined);
    assert.equal(input.classList.contains("pset-math-native-covered"), false);
    controller.nativeInputButton.focus();
    assert.equal(controller.active, true);
    controller.nativeInputButton.click();
    assert.equal(controller.mathField.latex(), draft, "explicit resume restores the visual draft");
    controller.nativeInputButton.click();
    input.value = "y+2";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    const event = new window.KeyboardEvent("keydown", { key: "(", bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
    assert.equal(controller.mathField, undefined, "native edits do not remount the editor");
    input.value = "x";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    input.value = "y+2";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    controller.nativeInputButton.click();
    assert.ok(controller.mathField);
    assert.equal(input.value, "y+2");
    assert.notEqual(controller.mathField.latex(), draft, "native edits invalidate the older visual draft");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("unfinished drafts survive the page off/on cycle without writing partial answers", async () => {
  const { dom, window } = await createRuntime(problem("draft_toggle", "<p>Find x.</p>", "x"));
  try {
    const input = window.document.querySelector("#input_draft_toggle");
    const manager = window.__psetterRuntime;
    let controller = manager.controllers.get(input);
    controller.activate();
    controller.mathField.moveToRightEnd();
    controller.typeCharacter("+");
    const draft = controller.mathField.latex();
    await manager.toggleEnabled();
    assert.equal(input.value, "x");
    await manager.toggleEnabled();
    controller = manager.controllers.get(input);
    controller.activate();
    assert.equal(controller.mathField.latex(), draft);
    controller.mathField.moveToRightEnd();
    controller.typeCharacter("2");
    assert.equal(input.value, "x+2");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("an editor runtime fault releases its native field and leaves another field usable", async () => {
  const { dom, window } = await createRuntime(problem("faulty", "<p>Find x.</p>", "x") + problem("healthy", "<p>Find y.</p>", "y"));
  try {
    const manager = window.__psetterRuntime;
    const input = window.document.querySelector("#input_faulty");
    const controller = manager.controllers.get(input);
    controller.activate();
    controller.mathField.latex = () => { throw new Error("simulated editor failure"); };
    assert.doesNotThrow(() => controller.recompute());
    assert.equal(controller.lastResult.issueKind, "runtime");
    assert.equal(controller.mathField, undefined);
    assert.equal(input.classList.contains("pset-math-native-covered"), false);
    assert.equal(input.value, "x");
    assert.match(controller.interactionMessage.textContent, /using MITx syntax/);
    assert.match(controller.interactionMessage.textContent, /using MITx syntax/);
    assert.equal(window.document.activeElement, input, "runtime recovery returns focus to the native input");
    const event = new window.KeyboardEvent("keydown", { key: "1", cancelable: true, bubbles: true });
    input.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
    const healthy = manager.controllers.get(window.document.querySelector("#input_healthy"));
    healthy.activate();
    healthy.mathField.moveToRightEnd();
    healthy.typeCharacter("+");
    healthy.typeCharacter("1");
    assert.equal(healthy.input.value, "y+1");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("rejected native hydration is not retried on every key or focus event", async () => {
  const { dom, window } = await createRuntime(problem("no_retry", "<p>Find x.</p>", "x⊕y"));
  try {
    const input = window.document.querySelector("#input_no_retry");
    const controller = window.__psetterRuntime.controllers.get(input);
    let attempts = 0;
    const original = controller.mountInlineEditorUnchecked.bind(controller);
    controller.mountInlineEditorUnchecked = () => { attempts++; return original(); };
    controller.activate();
    for (let index = 0; index < 4; index++) {
      input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "x", bubbles: true }));
      input.dispatchEvent(new window.Event("focus"));
    }
    await new Promise((resolve) => window.setTimeout(resolve, 10));
    assert.equal(attempts, 1);
    assert.equal(controller.interactionNotice.dataset.state, "native");
    assert.equal(controller.interactionNotice.hidden, false);
    assert.equal(controller.interactionMessage.textContent, "Visual editor unavailable for this answer.");
    assert.equal(controller.nativeInputButton.hidden, true, "don't offer a retry for unchanged syntax");
    controller.nativeInputButton.click();
    assert.equal(controller.mathField, undefined, "retry still rejects unsafe syntax");
    assert.equal(input.value, "x⊕y", "retry preserves the native answer");
    assert.equal(controller.manualNative, true);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("MITx field eligibility changes release only the affected input", async () => {
  const { dom, window } = await createRuntime(problem("eligibility", "<p>Find x.</p>", "x"));
  try {
    const input = window.document.querySelector("#input_eligibility");
    const manager = window.__psetterRuntime;
    manager.controllers.get(input).activate();
    input.readOnly = true;
    await new Promise((resolve) => window.setTimeout(resolve, 30));
    assert.equal(manager.controllers.has(input), false);
    assert.equal(input.classList.contains("pset-math-native-covered"), false);
    assert.equal(input.value, "x");
    assert.equal(window.document.querySelectorAll(".pset-math-interaction-notice").length, 0);
    input.readOnly = false;
    await new Promise((resolve) => window.setTimeout(resolve, 30));
    assert.equal(manager.controllers.has(input), true);
    input.type = "password";
    await new Promise((resolve) => window.setTimeout(resolve, 30));
    assert.equal(manager.controllers.has(input), false);
    assert.equal(input.classList.contains("pset-math-native-covered"), false);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});


test("sync feedback waits for idle and reuses the reset comment box above the answer", async () => {
  const { dom, window } = await createRuntime(problem("quiet_feedback", "<p>Find x.</p>", "x"));
  try {
    const controller = window.__psetterRuntime.controllers.get(window.document.querySelector("#input_quiet_feedback"));
    controller.activate();
    controller.mathField.latex(String.raw`\operatorname{mystery}(x)`);
    assert.equal(window.document.querySelector(".pset-math-sync-indicator"), null);
    assert.equal(controller.interactionNotice.hidden, true);
    await new Promise((resolve) => window.setTimeout(resolve, 1050));
    assert.equal(controller.interactionNotice.hidden, false, "a persistent sync problem shows a comment after idle");
    assert.equal(controller.interactionNotice.hidden, false);
    assert.equal(controller.interactionNotice.classList.contains("pset-math-restore-hint"), true);
    assert.match(controller.interactionMessage.textContent, /has not been applied/);
    assert.equal(controller.nativeInputButton.textContent, "Use MITx syntax");
    controller.mathField.latex("x+1");
    assert.equal(controller.interactionNotice.hidden, true);
    controller.mathField.latex(String.raw`\operatorname{mystery}(x)`);
    controller.deactivate();
    await new Promise((resolve) => window.setTimeout(resolve, 1050));
    assert.equal(controller.interactionNotice.hidden, true, "a stale timer cannot restore a deactivated comment");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});


test("native answer callbacks cannot eject an editor during a typed edit", async () => {
  const { dom, window } = await createRuntime(problem("sync_focus", "<p>Find x.</p>", "x") +
    '<button id="preview_focus">Preview status</button>');
  try {
    const input = window.document.querySelector("#input_sync_focus");
    const manager = window.__psetterRuntime;
    input.focus();
    await new Promise((resolve) => window.setTimeout(resolve, 10));
    const controller = manager.controllers.get(input);
    const field = controller.mathField;
    const textarea = controller.editorSurface.querySelector("textarea");
    const events = { input: 0, change: 0, keyup: 0 };
    for (const type of Object.keys(events)) input.addEventListener(type, () => {
      events[type]++;
      window.document.querySelector("#preview_focus").focus();
    });
    for (const key of "yz") {
      field.typedText(key);
      assert.equal(controller.active, true, "native callbacks keep the editing session active");
      assert.equal(controller.mathField, field, "typing keeps the same MathQuill instance");
      assert.equal(window.document.activeElement, textarea, "typing keeps keyboard focus");
    }
    assert.equal(input.value, "x*y*z");
    assert.deepEqual(events, { input: 2, change: 2, keyup: 2 });
    window.document.querySelector("#preview_focus").focus();
    assert.equal(controller.active, false, "focus outside a native write still closes the editor");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("native refocus during an answer callback preserves the insertion point", async () => {
  const { dom, window } = await createRuntime(problem("sync_caret", "<p>Find x.</p>", "x+2"));
  try {
    const input = window.document.querySelector("#input_sync_caret");
    input.focus();
    await new Promise((resolve) => window.setTimeout(resolve, 10));
    const controller = window.__psetterRuntime.controllers.get(input);
    const field = controller.mathField;
    field.moveToRightEnd().keystroke("Left");
    input.addEventListener("keyup", () => input.focus());
    field.typedText("3");
    await new Promise((resolve) => window.setTimeout(resolve, 10));
    field.typedText("4");
    assert.equal(input.value, "x+342");
    assert.equal(controller.mathField, field);
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("typing before the deferred focus handoff survives native answer callbacks", async () => {
  const { dom, window } = await createRuntime(problem("early_key", "<p>Find x.</p>", "x") +
    '<button id="early_preview">Preview status</button>');
  try {
    const input = window.document.querySelector("#input_early_key");
    input.addEventListener("input", () => window.document.querySelector("#early_preview").focus());
    input.focus();
    const controller = window.__psetterRuntime.controllers.get(input);
    input.dispatchEvent(new window.KeyboardEvent("keydown", {
      key: "y", bubbles: true, cancelable: true,
    }));
    assert.equal(controller.active, true);
    assert.ok(controller.mathField);
    assert.equal(input.value, "x*y");
    await new Promise((resolve) => window.setTimeout(resolve, 10));
    assert.equal(window.document.activeElement, controller.editorSurface.querySelector("textarea"));
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("runtime recovery retains the last visual draft when the editor source getter fails", async () => {
  const { dom, window } = await createRuntime(problem("fault_draft", "<p>Find x.</p>", "x"));
  try {
    const input = window.document.querySelector("#input_fault_draft");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    controller.mathField.moveToRightEnd().typedText("+");
    const draft = controller.mathField.latex();
    controller.mathField.latex = () => { throw new Error("simulated source failure"); };
    controller.recompute();
    assert.equal(input.value, "x");
    assert.equal(controller.manualNative, true);
    controller.nativeInputButton.click();
    assert.equal(controller.mathField.latex(), draft, "explicit retry recovers the exact unfinished source");
    controller.mathField.moveToRightEnd().typedText("2");
    assert.equal(input.value, "x+2");
  } finally {
    window.__psetterRuntime?.dispose();
    dom.window.close();
  }
});

test("undo, redo, and original restore remain separate after edits", async () => {
  const { dom, window } = await createRuntime(problem("recovery", "<p>Find x.</p>", "2*x"));
  try {
    const input = window.document.querySelector("#input_recovery");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    controller.mathField.moveToRightEnd();
    controller.typeCharacter("+");
    controller.typeCharacter("3");
    assert.equal(input.value, "2*x+3");
    assert.equal(controller.restoreControl.hidden, false);
    controller.undoHistory();
    assert.equal(input.value, "2*x+3", "incomplete undo must not write a partial answer");
    assert.equal(controller.interactionNotice.hidden, false);
    controller.redoHistory();
    assert.equal(input.value, "2*x+3");
    controller.restoreOriginal();
    assert.equal(input.value, "2*x");
  } finally { window.__psetterRuntime?.dispose(); dom.window.close(); }
});

test("external changes and form reset do not get overwritten by a visual draft", async () => {
  const { dom, window } = await createRuntime(`<form>${problem("external", "<p>Find x.</p>", "x")}</form>`);
  try {
    const input = window.document.querySelector("#input_external");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    input.value = "42";
    controller.mathField.moveToRightEnd();
    controller.typeCharacter("+");
    controller.typeCharacter("1");
    assert.equal(input.value, "42");
    assert.match(controller.interactionMessage.textContent, /Not synced to MITx/);
    input.form.reset();
    controller.deactivate();
    await new Promise((resolve) => window.setTimeout(resolve, 10));
    assert.equal(input.value, "x");
  } finally { window.__psetterRuntime?.dispose(); dom.window.close(); }
});

test("symbol search groups results and does not accumulate scoped listeners", async () => {
  const { dom, window } = await createRuntime(problem("palette", "<p>Find x.</p>", "x"));
  try {
    const input = window.document.querySelector("#input_palette");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    controller.mountDetailsPanel();
    const count = controller.detailsDisposers.length;
    for (let i = 0; i < 100; i++) controller.renderPalette(i % 2 ? "sin" : "nothingmatches");
    assert.equal(controller.detailsDisposers.length, count);
    controller.renderPalette("nothingmatches");
    assert.match(controller.paletteGrid.textContent, /No matching symbols/);
    controller.renderPalette("");
    assert.match(controller.paletteGrid.textContent, /Common/);
    assert.match(controller.paletteGrid.textContent, /Functions/);
    assert.match(controller.paletteGrid.textContent, /Greek and relations/);
  } finally { window.__psetterRuntime?.dispose(); dom.window.close(); }
});


test("recovery menu offers restore and MITx syntax separately", async () => {
  const { dom, window } = await createRuntime(problem("menu", "<p>Find x.</p>", "x"));
  try {
    const input = window.document.querySelector("#input_menu");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    controller.restoreControl.click();
    assert.equal(controller.restoreMenu.hidden, false);
    assert.equal(controller.restoreAction.disabled, false);
    assert.equal(controller.syntaxAction.textContent, "Use MITx syntax");
    controller.syntaxAction.click();
    assert.equal(controller.manualNative, true);
    assert.equal(input.value, "x");
  } finally { window.__psetterRuntime?.dispose(); dom.window.close(); }
});


test("unit vector palette buttons write MITx aliases", async () => {
  const { dom, window } = await createRuntime(problem("unit_vectors", "<p>Find x.</p>"));
  try {
    const input = window.document.querySelector("#input_unit_vectors");
    const controller = window.__psetterRuntime.controllers.get(input);
    controller.activate();
    controller.mountDetailsPanel();
    for (const alias of ["hati", "hatj", "hatk"]) {
      controller.mathField.latex("");
      controller.paletteGrid.querySelector(`[data-symbol-id="${alias}"]`).click();
      assert.equal(input.value, alias);
    }
  } finally { window.__psetterRuntime?.dispose(); dom.window.close(); }
});
