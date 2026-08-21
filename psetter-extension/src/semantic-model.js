"use strict";

const FUNCTION_ROWS = [
  ["sin", "\\sin"],
  ["cos", "\\cos"],
  ["tan", "\\tan"],
  ["sec", "\\sec"],
  ["csc", "\\csc"],
  ["cot", "\\cot"],
  ["sinh", "\\sinh"],
  ["cosh", "\\cosh"],
  ["tanh", "\\tanh"],
  ["sech", "\\operatorname{sech}"],
  ["csch", "\\operatorname{csch}"],
  ["coth", "\\operatorname{coth}"],
  ["arcsin", "\\arcsin"],
  ["arccos", "\\arccos"],
  ["arctan", "\\arctan"],
  ["arcsec", "\\operatorname{arcsec}"],
  ["arccsc", "\\operatorname{arccsc}"],
  ["arccot", "\\operatorname{arccot}"],
  ["arcsinh", "\\operatorname{arcsinh}"],
  ["arccosh", "\\operatorname{arccosh}"],
  ["arctanh", "\\operatorname{arctanh}"],
  ["arcsech", "\\operatorname{arcsech}"],
  ["arccsch", "\\operatorname{arccsch}"],
  ["arccoth", "\\operatorname{arccoth}"],
  ["asin", "\\operatorname{asin}"],
  ["acos", "\\operatorname{acos}"],
  ["atan", "\\operatorname{atan}"],
  ["ln", "\\ln"],
  ["log", "\\log"],
  ["log10", "\\operatorname{log10}"],
  ["log2", "\\operatorname{log2}"],
  ["exp", "\\exp"],
  ["sqrt", "\\sqrt"],
  ["abs", "\\operatorname{abs}"],
];

const GREEK_ROWS = [
  ["alpha", "α", "\\alpha"],
  ["beta", "β", "\\beta"],
  ["gamma", "γ", "\\gamma"],
  ["delta", "δ", "\\delta"],
  ["epsilon", "ϵ", "\\epsilon"],
  ["varepsilon", "ε", "\\varepsilon"],
  ["zeta", "ζ", "\\zeta"],
  ["eta", "η", "\\eta"],
  ["theta", "θ", "\\theta"],
  ["vartheta", "ϑ", "\\vartheta"],
  ["iota", "ι", "\\iota"],
  ["kappa", "ϰ", "\\kappa"],
  ["lambda", "λ", "\\lambda"],
  ["mu", "μ", "\\mu"],
  ["nu", "ν", "\\nu"],
  ["xi", "ξ", "\\xi"],
  ["omicron", "ο", "o"],
  ["rho", "ρ", "\\rho"],
  ["sigma", "σ", "\\sigma"],
  ["tau", "τ", "\\tau"],
  ["upsilon", "υ", "\\upsilon"],
  ["phi", "ϕ", "\\phi"],
  ["varphi", "φ", "\\varphi"],
  ["chi", "χ", "\\chi"],
  ["psi", "ψ", "\\psi"],
  ["omega", "ω", "\\omega"],
  ["Delta", "Δ", "\\Delta"],
  ["Gamma", "Γ", "\\Gamma"],
  ["Theta", "Θ", "\\Theta"],
  ["Lambda", "Λ", "\\Lambda"],
  ["Xi", "Ξ", "\\Xi"],
  ["Pi", "Π", "\\Pi"],
  ["Sigma", "Σ", "\\Sigma"],
  ["Upsilon", "Υ", "\\Upsilon"],
  ["Phi", "Φ", "\\Phi"],
  ["Psi", "Ψ", "\\Psi"],
  ["Omega", "Ω", "\\Omega"],
];

export const PSETTER_FUNCTIONS = new Map(
  FUNCTION_ROWS.map(([name, latex]) => [name, { name, latex, semanticKind: "function" }]),
);
export const PSETTER_FUNCTION_NAMES = new Set(PSETTER_FUNCTIONS.keys());
export const PSETTER_GREEK = new Map(
  GREEK_ROWS.map(([name, glyph, latex]) => [name, { name, glyph, latex, semanticKind: "greek" }]),
);
export const PSETTER_GREEK_LATEX = Object.fromEntries(
  GREEK_ROWS.filter(([name]) => name[0] === name[0].toLowerCase()).map(
    ([name, , latex]) => [name, latex],
  ),
);

const GREEK_BY_GLYPH = new Map(
  GREEK_ROWS.map(([name, glyph, latex]) => [glyph, { name, glyph, latex, semanticKind: "greek" }]),
);
const CONSTANTS = new Map([
  ["pi", { name: "pi", label: "π", latex: "\\pi", semanticKind: "constant" }],
  ["e", { name: "e", label: "e", latex: "e", semanticKind: "constant" }],
  ["i", { name: "i", label: "i", latex: "i", semanticKind: "constant" }],
]);
const OPERATOR_NAMES = new Set([
  "plus", "minus", "times", "cdot", "divide", "le", "ge", "ne", "approx",
  "sum", "prod", "partial", "infty", "infinity",
]);
const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)?$/;
const STRUCTURAL_TEX_COMMANDS = new Set([
  "begin", "end", "frac", "left", "right", "mathrm", "mathbf", "mathit",
  "mathsf", "mathtt", "text", "operatorname", "overline", "underline",
  "hat", "bar", "vec", "dot", "ddot", "cdot", "times", "div", "pm",
  "mp", "le", "leq", "ge", "geq", "ne", "neq", "approx", "sum", "prod",
  "int", "lim", "partial", "infty",
]);
// These remaining Unicode variants do not have a documented, distinct MITx
// spelling. Preserve them from NFKC so they fail closed instead of silently
// collapsing into another Greek symbol. Documented variants (epsilon,
// varepsilon, vartheta, phi, and varphi) are modeled explicitly above.
const AMBIGUOUS_GREEK_VARIANT_PATTERN =
  /[ϐϖϱϴ\u{1D6DD}-\u{1D6E1}\u{1D717}-\u{1D71B}\u{1D751}-\u{1D755}\u{1D78B}-\u{1D78F}\u{1D7C5}-\u{1D7C9}]/u;
const AMBIGUOUS_GREEK_VARIANT_GLOBAL_PATTERN =
  /[ϐϖϱϴ\u{1D6DD}-\u{1D6E1}\u{1D717}-\u{1D71B}\u{1D751}-\u{1D755}\u{1D78B}-\u{1D78F}\u{1D7C5}-\u{1D7C9}]/gu;
const DOCUMENTED_GREEK_VARIANT_GLOBAL_PATTERN = /[ϵϑϕϰ]/gu;
const STYLED_GREEK_VARIANTS = new Map([
  ...[0x1d6dc, 0x1d716, 0x1d750, 0x1d78a, 0x1d7c4].map((codePoint) => [codePoint, "epsilon"]),
  ...[0x1d6dd, 0x1d717, 0x1d751, 0x1d78b, 0x1d7c5].map((codePoint) => [codePoint, "vartheta"]),
  ...[0x1d6de, 0x1d718, 0x1d752, 0x1d78c, 0x1d7c6].map((codePoint) => [codePoint, "kappa"]),
  ...[0x1d6df, 0x1d719, 0x1d753, 0x1d78d, 0x1d7c7].map((codePoint) => [codePoint, "phi"]),
]);

function splitSubscript(identifier) {
  const match = identifier.match(/^([A-Za-z][A-Za-z0-9]*)(?:_([A-Za-z0-9]+))?$/);
  return match ? { base: match[1], subscript: match[2] ?? "" } : null;
}

function escapeOperatorName(value) {
  return value.replace(/[^A-Za-z0-9]/g, "");
}

function decodePsetterSubscript(value) {
  return [...String(value ?? "")]
    .map((character) => {
      const index = "₀₁₂₃₄₅₆₇₈₉".indexOf(character);
      return index >= 0 ? String(index) : character;
    })
    .join("");
}

export function canonicalizePsetterQuestionSymbol(rawRepresentation) {
  if (typeof rawRepresentation !== "string") return null;
  const raw = rawRepresentation.trim();
  if (!raw) return null;
  const styledVariant = raw.match(/^(\p{L})([₀-₉]*)$/u);
  const styledVariantName = styledVariant
    ? STYLED_GREEK_VARIANTS.get(styledVariant[1].codePointAt(0))
    : null;
  if (styledVariantName) {
    const greek = PSETTER_GREEK.get(styledVariantName);
    const subscript = decodePsetterSubscript(styledVariant[2]);
    return {
      rawRepresentation: raw,
      canonicalName: `${greek.name}${subscript ? `_${subscript}` : ""}`,
      canonicalLatex: `${greek.latex}${subscript ? `_{${subscript}}` : ""}`,
      semanticHint: "greek",
      normalization: "unicode-styled-greek-variant",
    };
  }
  // Unicode compatibility normalization intentionally folds Greek variant
  // symbols into base letters. Those variants can be mathematically distinct,
  // so a question needs stronger MathML semantics before Psetter may merge them.
  if (AMBIGUOUS_GREEK_VARIANT_PATTERN.test(raw)) return null;
  const styledTex = raw.match(
    /^\\(mathrm|mathbf|mathit|mathsf|mathtt|boldsymbol)\s*\{\s*([^{}]+)\s*\}$/,
  );
  if (styledTex) {
    const inner = canonicalizePsetterQuestionSymbol(styledTex[2]);
    return inner
      ? {
          ...inner,
          rawRepresentation: raw,
          normalization: `tex-style-${styledTex[1]}`,
        }
      : null;
  }
  const normalized = normalizePsetterMathText(raw).trim();
  const tex = normalized.match(/^\\([A-Za-z]+)(?:_\{?([A-Za-z0-9₀-₉]+)\}?)?$/);
  if (tex) {
    const command = tex[1];
    const subscript = decodePsetterSubscript(tex[2]);
    const greek = PSETTER_GREEK.get(command);
    if (greek)
      return {
        rawRepresentation: raw,
        canonicalName: `${greek.name}${subscript ? `_${subscript}` : ""}`,
        canonicalLatex: `${greek.latex}${subscript ? `_{${subscript}}` : ""}`,
        semanticHint: "greek",
        normalization: "tex-command",
      };
    const functionSpec = PSETTER_FUNCTIONS.get(command.toLowerCase());
    if (functionSpec && !subscript)
      return {
        rawRepresentation: raw,
        canonicalName: functionSpec.name,
        canonicalLatex: functionSpec.latex,
        semanticHint: "function",
        normalization: "tex-command",
      };
    if (command === "pi" && !subscript)
      return {
        rawRepresentation: raw,
        canonicalName: "pi",
        canonicalLatex: "\\pi",
        semanticHint: "constant",
        normalization: "tex-command",
      };
    return null;
  }
  const glyph = normalized.match(/^([α-ωΑ-Ωϵϑϕϰ])([₀-₉]*)$/u);
  if (glyph) {
    const subscript = decodePsetterSubscript(glyph[2]);
    if (glyph[1] === "π" && !subscript)
      return {
        rawRepresentation: raw,
        canonicalName: "pi",
        canonicalLatex: "\\pi",
        semanticHint: "constant",
        normalization: raw === normalized ? "unicode-greek" : "unicode-compatibility-greek",
      };
    const greek = GREEK_BY_GLYPH.get(glyph[1]);
    if (!greek) return null;
    return {
      rawRepresentation: raw,
      canonicalName: `${greek.name}${subscript ? `_${subscript}` : ""}`,
      canonicalLatex: `${greek.latex}${subscript ? `_{${subscript}}` : ""}`,
      semanticHint: "greek",
      normalization: raw === normalized ? "unicode-greek" : "unicode-compatibility-greek",
    };
  }
  if (!IDENTIFIER_PATTERN.test(normalized)) return null;
  return {
    rawRepresentation: raw,
    canonicalName: normalized,
    canonicalLatex: normalized,
    semanticHint: "identifier",
    normalization: raw === normalized ? "identity" : "unicode-compatibility",
  };
}

export function classifyPsetterIdentifier(rawIdentifier, options = {}) {
  if (typeof rawIdentifier !== "string") return null;
  const canonical = canonicalizePsetterQuestionSymbol(rawIdentifier);
  if (!canonical) return null;
  const identifier = canonical.canonicalName;
  const parts = splitSubscript(identifier);
  if (!parts) return null;
  const { base, subscript } = parts;
  const lowered = base.toLowerCase();
  const declaredKind = options.declaredKind;
  if (declaredKind === "function" && !subscript) {
    const functionSpec = PSETTER_FUNCTIONS.get(lowered);
    return {
      ...(functionSpec ?? {
        name: base,
        latex: `\\operatorname{${escapeOperatorName(base)}}`,
        semanticKind: "function",
      }),
      sourceName: base,
      label: base,
      outputName: base,
      requiresArgument: true,
      problemDefined: true,
    };
  }
  if ((declaredKind === "alias" || declaredKind === "variable") && !subscript) {
    const isAlias = declaredKind === "alias" || base.length > 1;
    return {
      name: identifier,
      sourceName: identifier,
      outputName: identifier,
      label: base,
      latex: isAlias ? `\\operatorname{${escapeOperatorName(base)}}` : base,
      subscript,
      semanticKind: isAlias ? "alias" : "variable",
      requiresArgument: false,
      problemDefined: true,
    };
  }
  const functionSpec = PSETTER_FUNCTIONS.get(lowered);
  if (functionSpec && !subscript) {
    return {
      ...functionSpec,
      sourceName: base,
      label: base,
      outputName: base,
      requiresArgument: true,
      problemDefined: options.problemDefined === true,
    };
  }
  const exactGreek = PSETTER_GREEK.get(base);
  if (exactGreek && base !== lowered) {
    return {
      ...exactGreek,
      sourceName: identifier,
      outputName: identifier,
      label: exactGreek.glyph,
      latex: `${exactGreek.latex}${subscript ? `_{${subscript}}` : ""}`,
      subscript,
      requiresArgument: false,
      problemDefined: options.problemDefined === true,
    };
  }
  const constant = CONSTANTS.get(base);
  if (constant && !subscript) {
    return {
      ...constant,
      sourceName: base,
      outputName: base,
      requiresArgument: false,
      problemDefined: options.problemDefined === true,
    };
  }
  const greek = PSETTER_GREEK.get(base) ?? PSETTER_GREEK.get(lowered);
  if (greek) {
    return {
      ...greek,
      sourceName: identifier,
      outputName: identifier,
      label: greek.glyph,
      latex: `${greek.latex}${subscript ? `_{${subscript}}` : ""}`,
      subscript,
      requiresArgument: false,
      problemDefined: options.problemDefined === true,
    };
  }
  if (OPERATOR_NAMES.has(lowered)) return null;
  if (base.length === 1) {
    return {
      name: identifier,
      sourceName: identifier,
      outputName: identifier,
      label: base,
      latex: `${base}${subscript ? `_{${subscript}}` : ""}`,
      subscript,
      semanticKind: "variable",
      requiresArgument: false,
      problemDefined: options.problemDefined === true,
    };
  }
  if (!options.explicitAlias) return null;
  return {
    name: identifier,
    sourceName: identifier,
    outputName: identifier,
    label: base,
    latex: `\\operatorname{${escapeOperatorName(base)}}${subscript ? `_{${subscript}}` : ""}`,
    subscript,
    semanticKind: "alias",
    requiresArgument: false,
    problemDefined: true,
  };
}

export function createPsetterContextItem(rawIdentifier, options = {}) {
  const semantic = classifyPsetterIdentifier(rawIdentifier, options);
  if (!semantic) return null;
  const canonical = canonicalizePsetterQuestionSymbol(rawIdentifier);
  if (!canonical) return null;
  return {
    id: `context:${semantic.semanticKind}:${semantic.sourceName}`,
    label: semantic.label,
    display: { base: semantic.label, subscript: semantic.subscript ?? "" },
    search: `${semantic.semanticKind} ${semantic.sourceName}`,
    latex: semantic.latex,
    outputName: semantic.outputName,
    semanticKind: semantic.semanticKind,
    requiresArgument: semantic.requiresArgument,
    problemDefined: semantic.problemDefined ?? options.problemDefined === true,
    provenance: options.provenance ?? "problem-math",
    rawRepresentation: options.rawRepresentation ?? canonical.rawRepresentation,
    canonicalRepresentation: semantic.outputName,
    canonicalLatex: semantic.latex,
    normalization: options.normalization ?? canonical.normalization,
    sourceRepresentation:
      options.sourceRepresentation ?? options.rawRepresentation ?? canonical.rawRepresentation,
    semanticAuthority:
      semantic.problemDefined || options.problemDefined === true
        ? "problem-context"
        : "generic-parser",
    group: "context",
    kind: "context",
  };
}

export function isPsetterInstructionalText(text) {
  if (typeof text !== "string") return false;
  const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
  return [
    /\bfor example\b/,
    /\be\.g\./,
    /\btry (?:out|typing|entering)\b/,
    /\btyping\b.+\b(?:gives|is correct|is wrong|error)\b/,
    /\btype\b.+\bfor the mathematical (?:constant|function)\b/,
    /\buse\b.+\bto denote\b/,
    /\bsyntax\b/,
    /\bhow (?:do|should) (?:i|you) type\b/,
    /\bshould be entered as (?:a |the )?function name\b/,
    /\bparentheses are required\b/,
    /\balways use\b/,
    /\binput help\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function extractPsetterMathIdentifiers(source) {
  if (typeof source !== "string" || !source.trim()) return [];
  const normalizedSource = normalizePsetterMathText(source);
  const tokens = [];
  const add = (value, options = {}) => {
    const item = createPsetterContextItem(value, {
      problemDefined: true,
      provenance: "problem-math",
      ...options,
    });
    if (item) tokens.push(item);
  };
  for (const match of source.matchAll(
    /<(?:[A-Za-z][A-Za-z0-9_-]*:)?(?:mi|ci)\b[^>]*>([^<>]+)<\/(?:[A-Za-z][A-Za-z0-9_-]*:)?(?:mi|ci)>/gi,
  )) {
    const canonical = canonicalizePsetterQuestionSymbol(match[1]);
    if (!canonical) continue;
    const knownFunction = PSETTER_FUNCTION_NAMES.has(
      canonical.canonicalName.toLowerCase(),
    );
    const tail = source.slice(match.index + match[0].length);
    const hasMathmlArgument = /^\s*(?:(?:<(?:[A-Za-z][A-Za-z0-9_-]*:)?mo\b[^>]*>\s*(?:⁡|&(?:#x?2061|ApplyFunction);)\s*<\/(?:[A-Za-z][A-Za-z0-9_-]*:)?mo>\s*)?(?:<(?:[A-Za-z][A-Za-z0-9_-]*:)?mfenced\b|<(?:[A-Za-z][A-Za-z0-9_-]*:)?mo\b[^>]*>\s*\(\s*<\/(?:[A-Za-z][A-Za-z0-9_-]*:)?mo>))/i.test(
      tail,
    );
    // Presentation MathML sometimes uses <mi> for standard function names.
    // Do not promote those names into authoritative aliases. Retain them as
    // functions only when nearby MathML structure proves application.
    if (knownFunction && !hasMathmlArgument) continue;
    add(canonical.canonicalName, {
      ...(knownFunction
        ? { declaredKind: "function" }
        : canonical.semanticHint === "identifier" && canonical.canonicalName.length > 1
        ? { declaredKind: "alias", explicitAlias: true }
        : {}),
      rawRepresentation: canonical.rawRepresentation,
      sourceRepresentation: match[0],
      normalization: "mathml-token",
    });
  }
  for (const match of source.matchAll(
    /\\(?:mathrm|mathbf|mathit|mathsf|mathtt|boldsymbol)\s*\{\s*([^{}]+)\s*\}/g,
  )) {
    const canonical = canonicalizePsetterQuestionSymbol(match[0]);
    if (!canonical) continue;
    add(canonical.canonicalName, {
      rawRepresentation: canonical.rawRepresentation,
      normalization: canonical.normalization,
    });
  }
  // Preserve the source representation for known Unicode mathematical
  // alphabets and Greek glyphs. The normalized scan below then contributes
  // structure without erasing how an authoritative question symbol arrived.
  for (const match of source.matchAll(/[\p{L}]+(?:[₀-₉]+)?/gu)) {
    if (/^[\x00-\x7F]+$/.test(match[0])) continue;
    const canonical = canonicalizePsetterQuestionSymbol(match[0]);
    if (!canonical) continue;
    add(canonical.canonicalName, {
      rawRepresentation: canonical.rawRepresentation,
      normalization: canonical.normalization,
    });
  }
  for (const match of normalizedSource.matchAll(/\\operatorname\s*\{\s*([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)?)\s*\}/g)) {
    const tail = normalizedSource.slice(match.index + match[0].length);
    const isCall = /^\s*(?:\\left\s*)?[({]/.test(tail);
    add(match[1], {
      explicitAlias: true,
      declaredKind: isCall ? "function" : "alias",
      rawRepresentation: match[0],
    });
  }
  for (const match of normalizedSource.matchAll(/\\([A-Za-z]+)(?:_\{?([A-Za-z0-9]+)\}?)?/g)) {
    const command = match[1];
    const tail = normalizedSource.slice(match.index + match[0].length);
    const isCall = /^\s*(?:\\left\s*)?[({]/.test(tail);
    const greek = PSETTER_GREEK.get(command);
    if (greek) {
      add(`${greek.name}${match[2] ? `_${match[2]}` : ""}`, {
        rawRepresentation: match[0],
        normalization: "tex-command",
      });
      continue;
    }
    if (PSETTER_FUNCTION_NAMES.has(command.toLowerCase()) && (isCall || command === "sqrt")) {
      add(command, {
        declaredKind: "function",
        rawRepresentation: match[0],
        normalization: "tex-command",
      });
    }
  }
  const normalized = normalizedSource
    .replace(
      /<(?:[A-Za-z][A-Za-z0-9_-]*:)?(?:mi|ci)\b[^>]*>[^<>]+<\/(?:[A-Za-z][A-Za-z0-9_-]*:)?(?:mi|ci)>/gi,
      " ",
    )
    .replace(/<[^>]+>/g, " ")
    .replace(/\\operatorname\s*\{[^{}]*\}/g, " ")
    .replace(/([A-Za-z])_\{([A-Za-z0-9]+)\}/g, "$1_$2")
    .replace(/\\([A-Za-z]+)/g, (full, command) =>
      STRUCTURAL_TEX_COMMANDS.has(command) || PSETTER_FUNCTION_NAMES.has(command.toLowerCase())
        ? " "
        : " ",
    )
    .replace(/[{}]/g, " ")
    .replace(/[α-ωΑ-Ω]/g, (glyph) => {
      const canonical = canonicalizePsetterQuestionSymbol(glyph);
      return ` ${canonical?.canonicalName ?? ""} `;
    });
  const compactMathSource =
    !/\s/.test(normalized.trim()) || /[+\-*/^=<>\\{}()]/.test(normalized);
  for (const match of normalized.matchAll(/[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)?/g)) {
    const raw = match[0];
    const before = normalized[match.index - 1] ?? "";
    const after = normalized[match.index + raw.length] ?? "";
    if (/[′″‴']/.test(before) || /[′″‴']/.test(after)) continue;
    const tail = normalized.slice(match.index + raw.length);
    const isCall = /^\s*[({]/.test(tail);
    const beforeCount = tokens.length;
    add(raw, isCall ? { declaredKind: "function", explicitAlias: true } : {});
    // Rendered question math commonly flattens adjacent variables (mc^2,
    // 2xy, Gm) into one text token even though MITx answer syntax requires
    // explicit multiplication. When the token has no known whole-token
    // meaning, retain each displayed variable as question-side evidence.
    if (
      compactMathSource &&
      !isCall &&
      tokens.length === beforeCount &&
      /^[A-Za-z]{2,}$/.test(raw)
    ) {
      for (const character of raw) add(character, { declaredKind: "variable" });
    }
  }
  return dedupePsetterContextItems(tokens);
}

export function normalizePsetterMathText(value) {
  const preserved = [];
  const protect = (character) => {
    const index = preserved.push(character) - 1;
    return `\uE000${index}\uE001`;
  };
  const protectedValue = String(value ?? "")
    .replace(AMBIGUOUS_GREEK_VARIANT_GLOBAL_PATTERN, protect)
    .replace(DOCUMENTED_GREEK_VARIANT_GLOBAL_PATTERN, protect)
    .replace(/[₀-₉⁰-⁹¹²³′″‴]/g, protect);
  return protectedValue
    .normalize("NFKC")
    .replace(/\uE000(\d+)\uE001/g, (_, index) => preserved[Number(index)] ?? "")
    .replace(/([A-Za-z])([₀-₉]+)/g, (_, base, digits) =>
      `${base}_${[...digits].map((digit) => "₀₁₂₃₄₅₆₇₈₉".indexOf(digit)).join("")}`,
    )
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, " ")
    .replace(/[−–—]/g, "-")
    .replace(/[×·]/g, "*");
}

export function dedupePsetterContextItems(items, limit = Number.POSITIVE_INFINITY) {
  const result = [];
  const seen = new Set();
  for (const item of items) {
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}
