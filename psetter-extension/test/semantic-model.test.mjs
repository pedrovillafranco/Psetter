import assert from "node:assert/strict";
import test from "node:test";

import {
  PSETTER_FUNCTION_NAMES,
  canonicalizePsetterQuestionSymbol,
  classifyPsetterIdentifier,
  createPsetterContextItem,
  extractPsetterMathIdentifiers,
  isPsetterInstructionalText,
  normalizePsetterMathText,
} from "../src/semantic-model.js";

test("known question representations canonicalize before semantic classification", () => {
  const cases = [
    ["𝐺", "G", "variable", "unicode-compatibility"],
    ["𝑥", "x", "variable", "unicode-compatibility"],
    ["Ｇ", "G", "variable", "unicode-compatibility"],
    ["ζ", "zeta", "greek", "unicode-greek"],
    ["ϵ", "epsilon", "greek", "unicode-greek"],
    ["ε", "varepsilon", "greek", "unicode-greek"],
    ["ϑ", "vartheta", "greek", "unicode-greek"],
    ["ϕ", "phi", "greek", "unicode-greek"],
    ["φ", "varphi", "greek", "unicode-greek"],
    ["ϰ", "kappa", "greek", "unicode-greek"],
    ["𝜁", "zeta", "greek", "unicode-compatibility-greek"],
    ["𝜁₀", "zeta_0", "greek", "unicode-compatibility-greek"],
    [String.raw`\zeta`, "zeta", "greek", "tex-command"],
    [String.raw`\Gamma_2`, "Gamma_2", "greek", "tex-command"],
    [String.raw`\mathbf{G}`, "G", "variable", "tex-style-mathbf"],
    [String.raw`\mathit{\zeta}`, "zeta", "greek", "tex-style-mathit"],
    ["𝐺\u200D", "G", "variable", "unicode-compatibility"],
  ];
  for (const [raw, canonicalName, semanticKind, normalization] of cases) {
    const canonical = canonicalizePsetterQuestionSymbol(raw);
    assert.equal(canonical?.canonicalName, canonicalName, raw);
    assert.equal(canonical?.normalization, normalization, raw);
    const item = createPsetterContextItem(raw, {
      problemDefined: true,
      provenance: "problem-math",
    });
    assert.equal(item?.canonicalRepresentation, canonicalName, raw);
    assert.equal(item?.semanticKind, semanticKind, raw);
    assert.equal(item?.semanticAuthority, "problem-context", raw);
    assert.equal(item?.rawRepresentation, raw.trim(), raw);
  }
});

test("representational unfamiliarity is distinct from semantic ambiguity", () => {
  for (const ambiguous of ["ϐ", "ϖ", "℘", "⊕", "未知"])
    assert.equal(canonicalizePsetterQuestionSymbol(ambiguous), null, ambiguous);

  const items = extractPsetterMathIdentifiers(String.raw`𝐺+𝜁+\zeta+ϵ+ϕ+⊕`);
  const byName = new Map(items.map((item) => [item.outputName, item]));
  assert.equal(byName.get("G")?.rawRepresentation, "𝐺");
  assert.equal(byName.get("zeta")?.rawRepresentation, "𝜁");
  assert.equal(byName.get("epsilon")?.rawRepresentation, "ϵ");
  assert.equal(byName.get("phi")?.rawRepresentation, "ϕ");
  assert.equal(byName.has("⊕"), false);
});

test("structured MathML tokens canonicalize without flattening away provenance", () => {
  const items = extractPsetterMathIdentifiers(
    '<math><mi mathvariant="bold">𝐺</mi><mo>+</mo><mi>𝜁</mi></math>',
  );
  const byName = new Map(items.map((item) => [item.outputName, item]));
  assert.equal(byName.get("G")?.rawRepresentation, "𝐺");
  assert.equal(byName.get("G")?.normalization, "mathml-token");
  assert.match(byName.get("G")?.sourceRepresentation ?? "", /^<mi\b/);
  assert.equal(byName.get("zeta")?.rawRepresentation, "𝜁");
  assert.equal(byName.get("zeta")?.semanticAuthority, "problem-context");
});

test("generated mathematical alphabet variants canonicalize whenever their base symbol is known", () => {
  let checked = 0;
  const styledEpsilonVariants = new Set([0x1d6dc, 0x1d716, 0x1d750, 0x1d78a, 0x1d7c4]);
  for (let codePoint = 0x1d400; codePoint <= 0x1d7ff; codePoint++) {
    const styled = String.fromCodePoint(codePoint);
    const normalized = normalizePsetterMathText(styled);
    if (styled === normalized) continue;
    const base = canonicalizePsetterQuestionSymbol(normalized);
    if (!base) continue;
    const canonical = canonicalizePsetterQuestionSymbol(styled);
    assert.equal(
      canonical?.canonicalName,
      styledEpsilonVariants.has(codePoint) ? "epsilon" : base.canonicalName,
      `U+${codePoint.toString(16)}`,
    );
    checked += 1;
  }
  assert.ok(checked > 500, `expected broad generated coverage, received ${checked}`);
  for (const variant of styledEpsilonVariants)
    assert.equal(
      canonicalizePsetterQuestionSymbol(String.fromCodePoint(variant))?.canonicalName,
      "epsilon",
      `epsilon variant U+${variant.toString(16)}`,
    );
  for (const [variants, expected] of [
    [[0x1d6dd, 0x1d717, 0x1d751, 0x1d78b, 0x1d7c5], "vartheta"],
    [[0x1d6de, 0x1d718, 0x1d752, 0x1d78c, 0x1d7c6], "kappa"],
    [[0x1d6df, 0x1d719, 0x1d753, 0x1d78d, 0x1d7c7], "phi"],
  ]) {
    for (const variant of variants)
      assert.equal(
        canonicalizePsetterQuestionSymbol(String.fromCodePoint(variant))?.canonicalName,
        expected,
        `${expected} variant U+${variant.toString(16)}`,
      );
  }
});

test("adjacent rendered variables and structural multi-letter identifiers remain discoverable", () => {
  for (const [source, expected] of [
    ["mc^2", ["m", "c"]],
    ["2xy", ["x", "y"]],
    ["Gm", ["G", "m"]],
    ["𝐺𝑚", ["G", "m"]],
  ]) {
    assert.deepEqual(
      extractPsetterMathIdentifiers(source).map((item) => item.outputName),
      expected,
      source,
    );
  }
  const mathml = extractPsetterMathIdentifiers("<math><mi>mass</mi><mo>+</mo><mi>G</mi></math>");
  assert.deepEqual(mathml.map((item) => item.outputName), ["mass", "G"]);
  assert.equal(mathml[0].semanticKind, "alias");
  assert.equal(mathml[0].normalization, "mathml-token");

  const ambiguousBuiltin = extractPsetterMathIdentifiers(
    "<math><mi>sin</mi><mo>+</mo><mi>mass</mi></math>",
  );
  assert.deepEqual(
    ambiguousBuiltin.map((item) => [item.outputName, item.semanticKind]),
    [["mass", "alias"]],
  );

  const appliedBuiltin = extractPsetterMathIdentifiers(
    "<math><mi>sin</mi><mo>⁡</mo><mfenced><mi>x</mi></mfenced></math>",
  );
  assert.deepEqual(
    appliedBuiltin.map((item) => [item.outputName, item.semanticKind]),
    [["sin", "function"], ["x", "variable"]],
  );
});

test("function families retain function semantics", () => {
  const families = {
    trig: ["sin", "cos", "tan"],
    inverseTrig: ["arcsin", "arccos", "arctan", "asin", "acos", "atan"],
    logsAndRoots: ["ln", "log", "log10", "log2", "exp", "sqrt"],
  };
  for (const [family, names] of Object.entries(families)) {
    for (const name of names) {
      assert.equal(PSETTER_FUNCTION_NAMES.has(name), true, `${family}: ${name}`);
      const item = createPsetterContextItem(name);
      assert.equal(item.semanticKind, "function", `${family}: ${name}`);
      assert.equal(item.requiresArgument, true, `${family}: ${name}`);
      assert.match(item.latex, /^\\/, `${family}: ${name}`);
    }
  }
});

test("constants, Greek names, aliases, variables, and subscripts remain distinct", () => {
  const cases = [
    ["pi", {}, "constant"],
    ["e", {}, "constant"],
    ["i", {}, "constant"],
    ["G", {}, "variable"],
    ["gamma", {}, "greek"],
    ["phi", {}, "greek"],
    ["alpha", {}, "greek"],
    ["lambda_0", {}, "greek"],
    ["v_0", {}, "variable"],
    ["hati", { explicitAlias: true }, "alias"],
    ["velocity", { explicitAlias: true }, "alias"],
  ];
  for (const [name, options, expectedKind] of cases) {
    assert.equal(
      classifyPsetterIdentifier(name, options)?.semanticKind,
      expectedKind,
      name,
    );
  }
  assert.equal(classifyPsetterIdentifier("velocity"), null);
  assert.equal(classifyPsetterIdentifier("plus", { explicitAlias: true }), null);
  assert.equal(classifyPsetterIdentifier("x+y", { explicitAlias: true }), null);
});

test("math extraction classifies calls without turning operators into terms", () => {
  const items = extractPsetterMathIdentifiers(
    String.raw`\arctan(v_0)+\sin(\theta)+log10(x)+G*M`,
  );
  const byName = new Map(items.map((item) => [item.outputName, item.semanticKind]));
  assert.deepEqual(
    Object.fromEntries(byName),
    {
      arctan: "function",
      v_0: "variable",
      sin: "function",
      theta: "greek",
      log10: "function",
      x: "variable",
      G: "variable",
      M: "variable",
    },
  );
});

test("spoken MathJax labels do not become multi-letter aliases", () => {
  const items = extractPsetterMathIdentifiers(
    "StartFraction upper F Over x EndFraction collapsed subtraction",
  );
  assert.deepEqual(items.map((item) => item.outputName), ["F", "x"]);
  const authoredAlias = extractPsetterMathIdentifiers(String.raw`\operatorname{velocity}+t`);
  assert.deepEqual(authoredAlias.map((item) => item.outputName), ["velocity", "t"]);
});

test("instructional syntax is recognized as evidence to exclude", () => {
  const examples = [
    "For example, arctan(x) returns an angle.",
    "Use * to denote multiplication.",
    "Try typing cos(x)^2; the other syntax is wrong.",
    "Functions should be entered as the function name and parentheses.",
  ];
  for (const example of examples) assert.equal(isPsetterInstructionalText(example), true);
  assert.equal(isPsetterInstructionalText("Find arctan(v_0) in terms of alpha."), false);
});

test("structured TeX and styled Unicode preserve symbol identity", () => {
  const items = extractPsetterMathIdentifiers(
    String.raw`\frac{G}{m}+\sqrt{x}+\sin{x}+𝐸+𝑦+\zeta`,
  );
  const semantics = new Map(items.map((item) => [item.outputName, item.semanticKind]));
  assert.equal(semantics.get("G"), "variable");
  assert.equal(semantics.get("m"), "variable");
  assert.equal(semantics.get("sqrt"), "function");
  assert.equal(semantics.get("x"), "variable");
  assert.equal(semantics.get("sin"), "function");
  assert.equal(semantics.get("E"), "variable");
  assert.equal(semantics.get("y"), "variable");
  assert.equal(semantics.get("zeta"), "greek");
});

test("generated identifier classes normalize typography without joining invisible text", () => {
  const styled = new Map([
    ["𝐀", "A"],
    ["𝐺", "G"],
    ["𝑥", "x"],
    ["𝓏", "z"],
  ]);
  for (const [source, expected] of styled) {
    assert.equal(normalizePsetterMathText(source), expected);
    assert.equal(extractPsetterMathIdentifiers(source)[0]?.outputName, expected);
  }
  for (const source of ["mass\u200Btime", "x\u2060y", "alpha\uFEFFbeta"]) {
    assert.doesNotMatch(normalizePsetterMathText(source), /masstime|xy|alphabeta/);
  }
  assert.equal(normalizePsetterMathText("v₀"), "v_0");
  assert.deepEqual(
    extractPsetterMathIdentifiers("v₀+x²").map((item) => item.outputName),
    ["v_0", "x"],
  );
  for (const prime of ["x'", "x′", "x″", "x‴"])
    assert.equal(
      extractPsetterMathIdentifiers(prime).some((item) => item.outputName === "x"),
      false,
      prime,
    );

  const greek = [
    "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta",
    "iota", "kappa", "lambda", "mu", "nu", "xi", "rho", "sigma", "tau",
    "upsilon", "phi", "chi", "psi", "omega", "Gamma", "Delta", "Theta",
    "Lambda", "Xi", "Pi", "Sigma", "Upsilon", "Phi", "Psi", "Omega",
  ];
  for (const name of greek)
    assert.equal(classifyPsetterIdentifier(name)?.semanticKind, "greek", name);
});
