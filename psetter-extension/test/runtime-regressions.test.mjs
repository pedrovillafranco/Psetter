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
  const listeners = new Set();
  let runtimeMessageListener;
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
    defaults: remoteConfig,
    remoteConfigKey: "remoteConfig",
    developerMessageReadKey: "developerMessageRead",
    validate: (value) => value,
    loadCached: async () => remoteConfig,
    load: async () => remoteConfig,
    readDeveloperMessageReadId: async () => null,
    normalizeDeveloperMessageReadId: () => null,
    isDeveloperMessageUnread: () => false,
    isVersionBelow: () => false,
  };
  window.eval(jquery);
  window.eval(mathquill);
  options.beforeRuntime?.(window);
  window.eval(runtime);
  await new Promise((resolve) => window.setTimeout(resolve, 30));
  return { dom, window, storage, runtimeMessageListener };
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
    assert.ok(controller.mathField, "valid native edit is admitted");
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
