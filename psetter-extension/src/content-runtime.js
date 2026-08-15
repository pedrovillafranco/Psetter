"use strict";
(() => {
  var Ln = [
    ".choicegroup",
    ".option-input",
    ".chemicalequationinput",
    ".coderesponse",
    ".cminput",
    ".matlabinput",
    ".schematic",
    ".jsinput",
  ].join(",");
  function Gn(e) {
    return !(
      e.dataset.psetMathEnhanced === "true" ||
      e.disabled ||
      e.readOnly ||
      (e.type !== "text" && e.type !== "search") ||
      e.closest(Ln) ||
      e.classList.contains("pset-math-internal")
    );
  }
  function $i(e) {
    let t = new Map(),
      i = (r, n, s) => {
        document.querySelectorAll(r).forEach((a) => {
          !Gn(a) || t.has(a) || t.set(a, { input: a, kind: n, confidence: s });
        });
      };
    return (
      i('.formulaequationinput input[type="text"]', "formula", "high"),
      i('.text-input-dynamath input[type="text"]', "math-text", "high"),
      i(
        '.capa_inputtype.textline input.math[type="text"]',
        "math-text",
        "high",
      ),
      e &&
        i(
          '.problem input[type="text"][id^="input_"], .problems-wrapper input[type="text"][id^="input_"]',
          "generic-text",
          "medium",
        ),
      [...t.values()]
    );
  }
  var PSETTER_CONFIG = globalThis.__psetterConfig ?? {
      settingsKey: "psetMathSettings",
      symbolsOpenKey: "psetMathSymbolsOpen",
      usageKey: "psetMathUsage",
      restoreHintKey: "psetterRestoreHintV1",
      feedbackPageUrl: "https://feedback.psetter.villafran.co/feedback",
      mitxHostname: "mitx.mit.edu",
    },
    PSETTER_REMOTE_API = globalThis.__psetterRemoteConfig,
    qe = {
      enabled: !0,
      inlineEnabledDefault: !0,
      defaultMode: "numeric",
      showGenericFields: !1,
      openDetails: !1,
    },
    at = PSETTER_CONFIG.settingsKey,
    psetterSymbolsOpenKey = PSETTER_CONFIG.symbolsOpenKey,
    psetterUsageKey = PSETTER_CONFIG.usageKey,
    psetterUsageQueue = Promise.resolve(),
    psetterRestoreHintKey = PSETTER_CONFIG.restoreHintKey,
    psetterRestoreHintQueue = Promise.resolve(),
    psetterIsPackagedDemo =
      location.protocol === "chrome-extension:" &&
      location.pathname === "/demo.html",
    psetterExtensionContextInvalidated = !1;
  function getExtensionApi() {
    if (psetterExtensionContextInvalidated) return null;
    try {
      return globalThis.chrome ?? null;
    } catch {
      psetterExtensionContextInvalidated = !0;
      return null;
    }
  }
  function notePsetterContextError(e) {
    if (isContextInvalidatedError(e)) {
      psetterExtensionContextInvalidated = !0;
      return !0;
    }
    return !1;
  }
  function getExtensionUrl(e) {
    try {
      let t = getExtensionApi();
      return t?.runtime?.getURL?.(e) ?? "";
    } catch (t) {
      // A live content script can outlast an unpacked-extension reload.
      // Treat the URL as unavailable during that teardown window.
      notePsetterContextError(t);
      return "";
    }
  }
  function isAllowedPsetterMessageOrigin(e) {
    if (!e || e === location.origin) return e === location.origin;
    try {
      let t = new URL(e);
      return t.protocol === "https:" &&
        (t.hostname === PSETTER_CONFIG.mitxHostname ||
          t.hostname.endsWith(`.${PSETTER_CONFIG.mitxHostname}`));
    } catch {
      return !1;
    }
  }
  function isContextInvalidatedError(e) {
    return /Extension context invalidated/i.test(
      e instanceof Error ? e.message : String(e ?? ""),
    );
  }
  // Reloading an unpacked extension invalidates already-running content
  // scripts. Suppress only that expected teardown rejection; all other
  // promise rejections retain their normal browser behavior.
  globalThis.__psetterGlobalCleanup?.();
  const psetterUnhandledRejection = (e) => {
    notePsetterContextError(e.reason) &&
      (e.preventDefault(), e.stopImmediatePropagation());
  };
  const psetterWindowError = (e) => {
    let t = e?.error ?? e?.message ?? "";
    notePsetterContextError(t) &&
      (e.preventDefault(), e.stopImmediatePropagation());
  };
  window.addEventListener("unhandledrejection", psetterUnhandledRejection);
  window.addEventListener("error", psetterWindowError, !0);
  globalThis.__psetterGlobalCleanup = () => {
    window.removeEventListener("unhandledrejection", psetterUnhandledRejection);
    window.removeEventListener("error", psetterWindowError, !0);
  };
  function Vn(e) {
    return e === "numeric" || e === "symbolic" || e === "literal";
  }
  function zi(e) {
    let t = e && typeof e == "object" ? e : {},
      i = typeof t.enabled == "boolean" ? t.enabled : qe.enabled;
    return {
      enabled: i,
      inlineEnabledDefault: i,
      defaultMode: Vn(t.defaultMode) ? t.defaultMode : qe.defaultMode,
      showGenericFields:
        typeof t.showGenericFields == "boolean"
          ? t.showGenericFields
          : qe.showGenericFields,
      openDetails:
        typeof t.openDetails == "boolean" ? t.openDetails : qe.openDetails,
    };
  }
  function settingsEqual(e, t) {
    return (
      !!e &&
      !!t &&
      e.enabled === t.enabled &&
      e.inlineEnabledDefault === t.inlineEnabledDefault &&
      e.defaultMode === t.defaultMode &&
      e.showGenericFields === t.showGenericFields &&
      e.openDetails === t.openDetails
    );
  }
  function normalizePsetterUsage(e) {
    let t = e && typeof e == "object" ? e.safeTermCombinations : 0,
      i = e && typeof e == "object" && e.dailySafeTermCombinations && typeof e.dailySafeTermCombinations == "object" ? e.dailySafeTermCombinations : {},
      r = {};
    for (let [n, s] of Object.entries(i))
      /^\d{4}-\d{2}-\d{2}$/.test(n) && Number.isSafeInteger(s) && s >= 0 && (r[n] = s);
    return {
      safeTermCombinations:
        Number.isSafeInteger(t) && t >= 0 ? t : 0,
      dailySafeTermCombinations: r,
    };
  }
  function psetterUsageDayKey(e = new Date()) {
    let t = e.getFullYear(),
      i = String(e.getMonth() + 1).padStart(2, "0"),
      r = String(e.getDate()).padStart(2, "0");
    return `${t}-${i}-${r}`;
  }
  function recordSafeTermCombination(e = 1) {
    if (psetterIsPackagedDemo) return Promise.resolve();
    let t = Number.isSafeInteger(e) && e > 0 ? e : 1;
    return (
      (psetterUsageQueue = psetterUsageQueue
        .then(async () => {
          let i = getExtensionApi();
          if (!i?.storage?.local) return;
          let r = await i.storage.local.get(psetterUsageKey),
            n = normalizePsetterUsage(r[psetterUsageKey]),
            s = psetterUsageDayKey(),
            o = { ...n.dailySafeTermCombinations, [s]: (n.dailySafeTermCombinations[s] ?? 0) + t },
            a = new Date();
          for (let [l] of Object.entries(o)) {
            let c = new Date(`${l}T00:00:00`);
            (Number.isNaN(c.getTime()) || (a - c) / 864e5 > 400) && delete o[l];
          }
          let d = { safeTermCombinations: n.safeTermCombinations + t, dailySafeTermCombinations: o };
          await i.storage.local.set({ [psetterUsageKey]: d });
        })
        .catch(() => {})),
      psetterUsageQueue
    );
  }
  async function _i() {
    try {
      let i = getExtensionApi();
      if (!i?.storage?.local?.get) return qe;
      let e = await i.storage.local.get(at);
      return zi(e[at]);
    } catch {
      // Chrome rejects pending extension API calls when the extension reloads.
      // The replacement content script will load the persisted settings normally.
      return qe;
    }
  }
  async function savePsetterSettings(e) {
    try {
      let i = getExtensionApi();
      return i?.storage?.local?.set
        ? (await i.storage.local.set({ [at]: e }), !0)
        : !1;
    } catch {
      return !1;
    }
  }
  async function loadPsetterSymbolsPreference() {
    try {
      let e = getExtensionApi();
      if (!e?.storage?.local?.get) return null;
      let t = await e.storage.local.get(psetterSymbolsOpenKey),
        i = t?.[psetterSymbolsOpenKey];
      return typeof i == "boolean" ? i : null;
    } catch {
      return null;
    }
  }
  function savePsetterSymbolsPreference(e) {
    try {
      let t = getExtensionApi();
      let i = t?.storage?.local?.set?.({ [psetterSymbolsOpenKey]: !!e });
      i?.catch?.(() => {});
    } catch {}
  }
  function normalizePsetterRestoreHintState(e) {
    let t = e && typeof e == "object" ? e.translationCount : 0;
    return {
      translationCount: Number.isSafeInteger(t) && t >= 0 ? t : 0,
    };
  }
  function recordPsetterRestoreHintTranslation() {
    return (psetterRestoreHintQueue = psetterRestoreHintQueue
      .then(async () => {
        let e = getExtensionApi();
        if (!e?.storage?.local?.get || !e?.storage?.local?.set)
          return { translationCount: 1, shouldShow: !0 };
        let t = await e.storage.local.get(psetterRestoreHintKey),
          i = normalizePsetterRestoreHintState(t?.[psetterRestoreHintKey]),
          r = i.translationCount + 1;
        await e.storage.local.set({
          [psetterRestoreHintKey]: { translationCount: r },
        });
        return { translationCount: r, shouldShow: r === 1 || r % 10 === 0 };
      })
      .catch(() => ({ translationCount: 1, shouldShow: !0 })));
  }
  function Pi(e) {
    try {
      let i = getExtensionApi();
      if (!i?.storage?.onChanged) return () => {};
      let t = (i, r) => {
        r !== "local" || !i[at] || e(zi(i[at].newValue));
      };
      return (
        i.storage.onChanged.addListener(t),
        () => {
          try {
            i.storage.onChanged.removeListener(t);
          } catch {}
        }
      );
    } catch {
      return () => {};
    }
  }
  var Mi = {
      "=": 1,
      "!=": 1,
      "~=": 1,
      "<": 1,
      "<=": 1,
      ">": 1,
      ">=": 1,
      "+": 2,
      "-": 2,
      "*": 3,
      "/": 3,
      "||": 3,
      "^": 5,
    },
    Fi = {
      alpha: "\\alpha",
      beta: "\\beta",
      gamma: "\\gamma",
      delta: "\\delta",
      epsilon: "\\epsilon",
      zeta: "\\zeta",
      eta: "\\eta",
      theta: "\\theta",
      iota: "\\iota",
      kappa: "\\kappa",
      lambda: "\\lambda",
      mu: "\\mu",
      nu: "\\nu",
      xi: "\\xi",
      omicron: "o",
      rho: "\\rho",
      sigma: "\\sigma",
      tau: "\\tau",
      upsilon: "\\upsilon",
      phi: "\\phi",
      chi: "\\chi",
      psi: "\\psi",
      omega: "\\omega",
    },
    Rt = class {
      constructor(t) {
        this.source = t;
      }
      source;
      position = 0;
      next() {
        for (; /\s/.test(this.source[this.position] ?? "");) this.position += 1;
        if (this.position >= this.source.length)
          return { kind: "eof", value: "" };
        let t = this.source.slice(this.position),
          i = t.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
        if (i)
          return (
            (this.position += i[0].length),
            { kind: "number", value: i[0] }
          );
        let r = t.match(/^[A-Za-z_][A-Za-z0-9_]*/);
        if (r)
          return (
            (this.position += r[0].length),
            { kind: "identifier", value: r[0] }
          );
        let n = t.slice(0, 2);
        if (["<=", ">=", "!=", "~=", "||"].includes(n))
          return ((this.position += 2), { kind: "operator", value: n });
        let s = this.source[this.position] ?? "";
        if (((this.position += 1), s === "("))
          return { kind: "lparen", value: s };
        if (s === ")") return { kind: "rparen", value: s };
        if (s === ",") return { kind: "comma", value: s };
        if ("+-*/^%=<>".includes(s)) return { kind: "operator", value: s };
        throw new Error(`Unexpected character: ${s}`);
      }
    },
    Ct = class {
      constructor(t) {
        this.tokenizer = t;
        this.current = t.next();
      }
      tokenizer;
      current;
      parse() {
        let t = this.parseExpression(0);
        if (this.current.kind !== "eof")
          throw new Error(`Unexpected token: ${this.current.value}`);
        return t;
      }
      advance() {
        let t = this.current;
        return ((this.current = this.tokenizer.next()), t);
      }
      parseExpression(t) {
        let i = this.parsePrefix();
        for (; this.current.kind === "operator" && this.current.value === "%";)
          (this.advance(), (i = { type: "percent", value: i }));
        for (;;) {
          if (this.current.kind === "operator") {
            let r = this.current.value,
              n = Mi[r];
            if (n === void 0 || n < t) break;
            this.advance();
            let s = r === "^",
              a = this.parseExpression(s ? n : n + 1);
            i = { type: "binary", operator: r, left: i, right: a };
            continue;
          }

          // Psetter expressions allow implicit multiplication (for example
          // `b^2 4ac`).  Treat an adjacent atom as a product instead of
          // letting the downstream MathQuill/MathML parser absorb the next
          // digit into the exponent (`b^24`).
          let r =
            this.current.kind === "number" ||
            this.current.kind === "identifier" ||
            this.current.kind === "lparen";
          if (!r || Mi["*"] < t) break;
          let n = this.parseExpression(Mi["*"] + 1);
          i = { type: "binary", operator: "*", left: i, right: n };
        }
        return i;
      }
      parsePrefix() {
        if (
          this.current.kind === "operator" &&
          (this.current.value === "+" || this.current.value === "-")
        )
          return {
            type: "unary",
            operator: this.advance().value,
            value: this.parseExpression(4),
          };
        if (this.current.kind === "number")
          return { type: "number", value: this.advance().value };
        if (this.current.kind === "identifier") {
          let t = this.advance().value;
          if (this.current.kind === "lparen") {
            this.advance();
            let i = [];
            if (this.current.kind !== "rparen")
              for (
                ;
                i.push(this.parseExpression(0)), this.current.kind === "comma";
              )
                this.advance();
            if (this.current.kind !== "rparen")
              throw new Error("Expected closing parenthesis.");
            return (this.advance(), { type: "call", name: t, args: i });
          }
          return { type: "symbol", name: t };
        }
        if (this.current.kind === "lparen") {
          this.advance();
          let t = this.parseExpression(0);
          if (this.current.kind !== "rparen")
            throw new Error("Expected closing parenthesis.");
          return (this.advance(), t);
        }
        throw new Error(
          `Expected an expression near \u201C${this.current.value}\u201D.`,
        );
      }
    };
  function de(e, t) {
    // These groups are for parsing precedence, not scalable delimiters.
    // MathQuill can stretch \left( across a nested fraction/root, leaving an
    // oversized opening parenthesis in the visual editor.
    return e.precedence < t ? `(${e.latex})` : e.latex;
  }
  function jn(e) {
    if (e === "pi") return "\\pi";
    if (e === "infty" || e === "infinity") return "\\infty";
    if (Fi[e]) return Fi[e];
    let t = e.match(/^([A-Za-z][A-Za-z0-9]*)_([A-Za-z0-9]+)$/);
    return t ? `${t[1]}_{${t[2]}}` : e;
  }
  function Ae(e) {
    if (e.type === "number") return { latex: e.value, precedence: 6 };
    if (e.type === "symbol") return { latex: jn(e.name), precedence: 6 };
    if (e.type === "percent")
      return { latex: `${de(Ae(e.value), 6)}\\%`, precedence: 6 };
    if (e.type === "unary") {
      let a = Ae(e.value);
      return { latex: `${e.operator}${de(a, 4)}`, precedence: 4 };
    }
    if (e.type === "call") {
      let a = e.args.map((p) => Ae(p).latex);
      if (e.name === "sqrt" && a[0])
        return { latex: `\\sqrt{${a[0]}}`, precedence: 6 };
      if (e.name === "abs" && a[0])
        return { latex: `\\left|${a[0]}\\right|`, precedence: 6 };
      let l = new Set([
          "sin",
          "cos",
          "tan",
          "sec",
          "csc",
          "cot",
          "sinh",
          "cosh",
          "tanh",
          "arcsin",
          "arccos",
          "arctan",
          "ln",
          "exp",
        ]),
        o = e.name === "log10" ? "log" : e.name === "log2" ? "log_2" : e.name;
      return {
        latex: `${l.has(o) ? `\\${o}` : `\\operatorname{${o}}`}(${a.join(",")})`,
        precedence: 6,
      };
    }
    let t = Ae(e.left),
      i = Ae(e.right),
      r = Mi[e.operator] ?? 1;
    if (e.operator === "/")
      return { latex: `\\frac{${t.latex}}{${i.latex}}`, precedence: r };
    if (e.operator === "^")
      return { latex: `${de(t, r)}^{${i.latex}}`, precedence: r };
    if (e.operator === "*")
      return { latex: `${de(t, r)}\\cdot ${de(i, r)}`, precedence: r };
    let s =
      {
        "<=": "\\le",
        ">=": "\\ge",
        "!=": "\\ne",
        "~=": "\\approx",
        "||": "\\parallel",
      }[e.operator] ?? e.operator;
    return {
      latex: `${de(t, r)}${s}${de(i, r + (e.operator === "-" ? 1 : 0))}`,
      precedence: r,
    };
  }
  function Bt(e) {
    let t = e.trim();
    if (!t) return "";
    if (/[<>]=?|!=/.test(t) || /-\s*\(\s*-/.test(t))
      return t
        .replace(/\*/g, "\\cdot ")
        .replace(/\bpi\b/g, "\\pi")
        .replace(/<=/g, "\\le ")
        .replace(/>=/g, "\\ge ")
        .replace(/!=/g, "\\ne ");
    try {
      return Ae(new Ct(new Rt(t)).parse()).latex;
    } catch {
      return t
        .replace(/\*/g, "\\cdot ")
        .replace(/\bpi\b/g, "\\pi")
        .replace(/<=/g, "\\le ")
        .replace(/>=/g, "\\ge ")
        .replace(/!=/g, "\\ne ");
    }
  }
  var mi = ["Error", "'missing'"];
  function Me(e) {
    return !!(typeof e == "number" || it(e) || (typeof e == "string" && nt(e)));
  }
  function it(e) {
    return e !== null && typeof e == "object" && "num" in e;
  }
  function rt(e) {
    return e !== null && typeof e == "object" && "sym" in e;
  }
  function xi(e) {
    return e !== null && typeof e == "object" && "str" in e;
  }
  function _r(e) {
    return (
      e !== null &&
      typeof e == "object" &&
      "dict" in e &&
      typeof e.dict == "object" &&
      !Array.isArray(e.dict) &&
      e.dict !== null
    );
  }
  function Ce(e) {
    return (
      e !== null &&
      typeof e == "object" &&
      "fn" in e &&
      Array.isArray(e.fn) &&
      e.fn.length > 0 &&
      typeof e.fn[0] == "string"
    );
  }
  function P(e) {
    return e == null
      ? null
      : typeof e == "object" && "str" in e
        ? e.str
        : typeof e != "string"
          ? null
          : e.length >= 2 && e.at(0) === "'" && e.at(-1) === "'"
            ? e.substring(1, e.length - 1)
            : nt(e) || At(e)
              ? null
              : e;
  }
  function Pr(e) {
    if (e == null || P(e) !== null) return null;
    let t = f(e);
    return t
      ? [
          t,
          ...T(e)
            .map((i) => Pr(i))
            .filter((i) => i !== null),
        ]
      : e;
  }
  function f(e) {
    return Array.isArray(e) ? e[0] : e == null ? "" : Ce(e) ? e.fn[0] : "";
  }
  function T(e) {
    return Array.isArray(e)
      ? e.slice(1)
      : e !== void 0 && Ce(e)
        ? e.fn.slice(1)
        : [];
  }
  function c(e, t) {
    return Array.isArray(e)
      ? (e[t] ?? null)
      : e === null || !Ce(e)
        ? null
        : (e.fn[t] ?? null);
  }
  function B(e) {
    return e == null
      ? 0
      : Array.isArray(e)
        ? Math.max(0, e.length - 1)
        : Ce(e)
          ? Math.max(0, e.fn.length - 1)
          : 0;
  }
  function Oi(e) {
    return e == null ? null : f(e) === "Hold" ? c(e, 1) : e;
  }
  function k(e) {
    return typeof e == "string" && At(e)
      ? e.length >= 2 && e.at(0) === "`" && e.at(-1) === "`"
        ? e.slice(1, -1)
        : e
      : e == null
        ? null
        : rt(e)
          ? e.sym
          : null;
  }
  function Di(e) {
    let t = f(e);
    if (t === "KeyValuePair" || t === "Tuple" || t === "Pair") {
      let [i, r] = T(e),
        n = P(i);
      return n ? [n, r ?? "Nothing"] : null;
    }
    return null;
  }
  function Fr(e) {
    if (e === null) return null;
    if (_r(e)) return e;
    let t = Di(e);
    if (t) return { dict: { [t[0]]: Ri(t[1]) ?? "Nothing" } };
    if (f(e) === "Dictionary") {
      let i = {};
      for (let r of T(e)) {
        let n = Di(r);
        n && (i[n[0]] = Ri(n[1]) ?? "Nothing");
      }
      return { dict: i };
    }
    return null;
  }
  function qt(e) {
    return {
      dict: Object.fromEntries(
        Object.entries(e).map(([t, i]) => [t, ii(i) ?? "Nothing"]),
      ),
    };
  }
  function Zn(e) {
    if (
      ((e = e
        .toLowerCase()
        .replace(/[nd]$/, "")
        .replace(/[\u0009-\u000d\u0020\u00a0]/g, "")),
      e === "nan")
    )
      return NaN;
    if (/^(infinity|\+infinity|oo|\+oo)$/i.test(e)) return 1 / 0;
    if (/^(-infinity|-oo)$/.test(e)) return -1 / 0;
    if (/\([0-9]+\)/.test(e)) {
      let [t, i, r, n] = e.match(/(.+)\(([0-9]+)\)(.*)$/) ?? [];
      e = i + r.repeat(Math.ceil(16 / r.length)) + (n ?? "");
    }
    return parseFloat(e);
  }
  function S(e) {
    return typeof e == "number"
      ? e
      : typeof e == "string" && nt(e)
        ? Zn(e)
        : e !== void 0 && it(e)
          ? S(e.num)
          : null;
  }
  function et(e) {
    if (e == null) return null;
    if (k(e) === "Half") return [1, 2];
    let t = f(e);
    if (!t) return null;
    let i = null,
      r = null;
    if (t === "Negate") {
      let n = et(T(e)[0]);
      if (n) return [-n[0], n[1]];
    }
    if (t === "Rational" || t === "Divide") {
      let [n, s] = T(e);
      ((i = S(n) ?? NaN), (r = S(s) ?? NaN));
    }
    if (t === "Power") {
      let [n, s] = T(e),
        a = S(s);
      a === 1 ? ((i = S(n)), (r = 1)) : a === -1 && ((i = 1), (r = S(n)));
    }
    if (t === "Multiply") {
      let [n, s] = T(e);
      if (f(s) === "Power") {
        let [a, l] = T(s);
        S(l) === -1 && ((i = S(n)), (r = S(a)));
      }
    }
    return i === null || r === null
      ? null
      : Number.isInteger(i) && Number.isInteger(r)
        ? [i, r]
        : null;
  }
  function ei(e, t) {
    let i = null;
    if ((Array.isArray(e) && (i = e), Ce(e) && (i = e.fn), i === null))
      return [];
    let r = 1,
      n = [];
    for (; r < i.length;) (n.push(t(i[r])), (r += 1));
    return n;
  }
  function He(e, t, i) {
    let r = f(t),
      n = f(i);
    return r === e && n === e
      ? [e, ...T(t), ...T(i)]
      : r === e
        ? [e, ...T(t), i]
        : n === e
          ? [e, t, ...T(i)]
          : [e, t, i];
  }
  function St(e) {
    if (e == null) return null;
    let t = f(e);
    if (t === "Delimiter") {
      if (((e = c(e, 1)), e === null)) return [];
      if (((t = f(e)), t !== "Sequence")) return [e];
    }
    return t !== "Sequence" ? null : T(e);
  }
  function M(e) {
    return e == null || e === "Nothing"
      ? !0
      : f(e) === "Sequence" && B(e) === 0;
  }
  function F(e) {
    return M(e) ? mi : e;
  }
  function ti(e) {
    return e[0] === "Square"
      ? ti(e.slice(1)) + 2
      : e.reduce((t, i) => t + tt(i), 0);
  }
  function tt(e) {
    if (e === null) return 0;
    if (typeof e == "number" || typeof e == "string" || Me(e) || rt(e) || xi(e))
      return 1;
    if (Array.isArray(e)) return ti(e);
    if ("fn" in e) return ti(e.fn);
    let t = Fr(e);
    if (t) {
      let i = t,
        r = Object.keys(i);
      return 1 + r.length + r.reduce((n, s) => n + tt(i[s]), 0);
    }
    return 0;
  }
  function nt(e) {
    return (
      /^(nan|oo|\+oo|-oo|infinity|\+infinity|-infinity)$/i.test(e) ||
      /^[+-]?(0|[1-9][0-9]*)(\.[0-9]+)?(\([0-9]+\))?([eE][+-]?[0-9]+)?$/.test(e)
    );
  }
  function At(e) {
    return (
      /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(e) ||
      (e.length >= 2 && e[0] === "`" && e[e.length - 1] === "`")
    );
  }
  function Un(e) {
    return e.length >= 2 && e[0] === "'" && e[e.length - 1] === "'"
      ? !0
      : !nt(e) && !At(e);
  }
  function ii(e) {
    if (typeof e == "string") return { str: e };
    if (typeof e == "number") return { num: e.toString() };
    if (typeof e == "boolean") return e ? "True" : "False";
    if (Array.isArray(e)) return ["List", ...e.map((t) => ii(t) ?? "Nothing")];
    if (e === null) return null;
    if (typeof e == "object") {
      let t = {};
      for (let i in e) t[i] = ii(e[i]) ?? "Nothing";
      return { dict: t };
    }
    return Ce(e) || rt(e) || it(e) || xi(e) || _r(e) ? e : null;
  }
  function Ri(e) {
    return e == null
      ? null
      : xi(e)
        ? e.str
        : it(e)
          ? parseFloat(e.num)
          : rt(e)
            ? e.sym
            : typeof e == "string" || typeof e == "number"
              ? e
              : Array.isArray(e)
                ? { fn: e }
                : e;
  }
  var A = 245,
    lt = 260,
    ye = 270,
    V = 275,
    H = 390,
    K = 600,
    Ci = 650,
    ot = 700,
    Bi = 810;
  function Yn(e) {
    return !("kind" in e) || e.kind === "expression";
  }
  function Hn(e) {
    return "kind" in e && e.kind === "symbol";
  }
  function yt(e) {
    return "kind" in e && e.kind === "matchfix";
  }
  function Mr(e) {
    return "kind" in e && e.kind === "infix";
  }
  function Or(e) {
    return "kind" in e && e.kind === "prefix";
  }
  function Dr(e) {
    return "kind" in e && e.kind === "postfix";
  }
  function Wn(e) {
    return "kind" in e && e.kind === "environment";
  }
  function Kn(e) {
    let t = [];
    for (let i = 0; i < e.length; i++) {
      let r = e.charCodeAt(i);
      if (r >= 55296 && r <= 56319) {
        let n = e.charCodeAt(i + 1);
        if (n >= 56320 && n <= 57343) {
          let s = r - 55296,
            a = n - 56320;
          ((r = 2 ** 16 + s * 2 ** 10 + a), i++);
        }
      }
      t.push(r);
    }
    return t;
  }
  var xt = 8205,
    qi = [127462, 127487];
  function Li(e) {
    return (
      e === xt ||
      e === 65038 ||
      e === 65039 ||
      (e >= 127995 && e <= 128e3) ||
      (e >= 129456 && e <= 129460) ||
      (e >= 917536 && e <= 917632)
    );
  }
  function Qn(e) {
    return e >= qi[0] && e <= qi[1];
  }
  function Jn(e) {
    if (/^[\u0020-\u00FF]*$/.test(e)) return e;
    let t = [],
      i = Kn(e),
      r = 0;
    for (; r < i.length;) {
      let n = i[r++],
        s = i[r];
      if (s === xt) {
        let a = r - 1;
        for (r += 2; i[r] === xt;) r += 2;
        t.push(String.fromCodePoint(...i.slice(a, 2 * r - a + 1)));
      } else if (Li(s)) {
        let a = r - 1;
        for (; Li(i[r]);) r += i[r] === xt ? 2 : 1;
        t.push(String.fromCodePoint(...i.slice(a, 2 * r - a - 1)));
      } else
        Qn(n)
          ? ((r += 1), t.push(String.fromCodePoint(...i.slice(r - 2, 2))))
          : t.push(String.fromCodePoint(n));
    }
    return t;
  }
  var Xn = {
      "\u2070": "0",
      "\xB9": "1",
      "\xB2": "2",
      "\xB3": "3",
      "\u2074": "4",
      "\u2075": "5",
      "\u2076": "6",
      "\u2077": "7",
      "\u2078": "8",
      "\u2079": "9",
      "\u207B": "-",
      "\u2071": "i",
      ⁿ: "n",
    },
    es = {
      "\u2080": "0",
      "\u2081": "1",
      "\u2082": "2",
      "\u2083": "3",
      "\u2084": "4",
      "\u2085": "5",
      "\u2086": "6",
      "\u2087": "7",
      "\u2088": "8",
      "\u2089": "9",
      "\u208B": "-",
    },
    Gi = new Map();
  function ts(e) {
    let t = Gi.get(e.source);
    if (!t) {
      let i = e.source.startsWith("^") ? e.source.slice(1) : e.source;
      ((t = new RegExp(i, "y")), Gi.set(e.source, t));
    }
    return t;
  }
  var is = class {
    s;
    pos;
    joined;
    offsets = null;
    obeyspaces = !1;
    constructor(e) {
      if (
        ((e = e.normalize("NFC")),
        (e = e.replace(/[\u200E\u200F\u2066-\u2069\u202A-\u202E]/g, "")),
        (e = e.replace(/\u2212/g, "-")),
        (e = e.replace(
          /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻ⁱⁿ]+/g,
          (t) =>
            `^{${Array.from(t)
              .map((i) => Xn[i])
              .join("")}}`,
        )),
        (e = e.replace(
          /[₀₁₂₃₄₅₆₇₈₉₋]+/g,
          (t) =>
            `_{${Array.from(t)
              .map((i) => es[i])
              .join("")}}`,
        )),
        (this.s = Jn(e)),
        (this.pos = 0),
        typeof this.s == "string")
      )
        this.joined = this.s;
      else {
        this.joined = this.s.join("");
        let t = new Array(this.s.length + 1),
          i = 0;
        for (let r = 0; r < this.s.length; r++)
          ((t[r] = i), (i += this.s[r].length));
        ((t[this.s.length] = i), (this.offsets = t));
      }
    }
    end() {
      return this.pos >= this.s.length;
    }
    get() {
      return this.pos < this.s.length ? this.s[this.pos++] : "";
    }
    peek() {
      return this.s[this.pos];
    }
    match(e) {
      let t = ts(e);
      typeof this.s == "string"
        ? (t.lastIndex = this.pos)
        : (t.lastIndex =
            this.offsets[this.pos < this.s.length ? this.pos : this.s.length]);
      let i = t.exec(this.joined);
      return i?.[0] ? ((this.pos += i[0].length), i[0]) : null;
    }
    next() {
      if (this.end()) return null;
      if (
        (!this.obeyspaces && this.match(/^[ \f\n\r\t\v\xA0\u2028\u2029]+/)) ||
        (this.obeyspaces && this.match(/^[ \f\n\r\t\v\xA0\u2028\u2029]/))
      )
        return "<space>";
      let e = this.get();
      if (e === "\\") {
        if (!this.end()) {
          let t = this.match(/^[a-zA-Z]+/);
          if (t) this.match(/^[ \f\n\r\t\v\xA0\u2028\u2029]*/);
          else if (((t = this.get()), t === " ")) return "<space>";
          return "\\" + t;
        }
      } else {
        if (e === "{") return "<{>";
        if (e === "}") return "<}>";
        if (e === "^") {
          if (this.peek() === "^") {
            this.get();
            let t = this.match(
              /^(\^(\^(\^(\^[0-9a-f])?[0-9a-f])?[0-9a-f])?[0-9a-f])?[0-9a-f][0-9a-f]/,
            );
            if (t)
              return String.fromCodePoint(
                parseInt(t.slice(t.lastIndexOf("^") + 1), 16),
              );
          }
          return e;
        } else if (e === "#") {
          if (!this.end()) {
            let t = !1;
            if (
              /[0-9?]/.test(this.peek()) &&
              ((t = !0), this.pos + 1 < this.s.length)
            ) {
              let i = this.s[this.pos + 1];
              t = /[^0-9A-Za-z]/.test(i);
            }
            return t ? "#" + this.get() : "#";
          }
        } else if (e === "$")
          return this.peek() === "$" ? (this.get(), "<$$>") : "<$>";
      }
      return e;
    }
  };
  function rs(e, t) {
    let i = e.next();
    if (!i) return [];
    let r = [];
    if (i !== "\\relax") {
      if (i === "\\noexpand") ((i = e.next()), i && r.push(i));
      else if (i === "\\obeyspaces") e.obeyspaces = !0;
      else if (i === "\\space" || i === "~") r.push("<space>");
      else if (i === "\\bgroup") r.push("<{>");
      else if (i === "\\egroup") r.push("<}>");
      else if (i === "\\string")
        ((i = e.next()),
          i &&
            (i[0] === "\\"
              ? Array.from(i).forEach((n) =>
                  r.push(n === "\\" ? "\\backslash" : n),
                )
              : i === "<{>"
                ? r.push("\\{")
                : i === "<space>"
                  ? r.push("~")
                  : i === "<}>" && r.push("\\}")));
      else if (i === "\\csname") {
        let n = "",
          s = !1,
          a = [];
        do
          (a.length === 0 && ((i = e.next()), (a = i ? [i] : [])),
            (s = a.length === 0),
            !s && i === "\\endcsname" && ((s = !0), a.shift()),
            s ||
              (s =
                i === "<$>" ||
                i === "<$$>" ||
                i === "<{>" ||
                i === "<}>" ||
                (!!i && i.length > 1 && i[0] === "\\")),
            s || (n += a.shift()));
        while (!s);
        (n && r.push("\\" + n), (r = r.concat(a)));
      } else if (i !== "\\endcsname")
        if (i.length > 1 && i[0] === "#") {
          let n = i.slice(1),
            s = t;
          r = r.concat(j(s?.[n] ?? s?.["?"] ?? "\\placeholder{}", t));
        } else r.push(i);
    }
    return r;
  }
  function j(e, t = []) {
    let i = e.toString().split(/\r?\n/),
      r = "",
      n = "";
    for (let l of i) {
      ((r += n), (n = " "));
      let o = l.match(/((?:\\%)|[^%])*/);
      o !== null && (r += o[0]);
    }
    let s = new is(r),
      a = [];
    do a.push(...rs(s, t));
    while (!s.end());
    return a;
  }
  function Rr(e) {
    return j(e).length;
  }
  function y(e) {
    let t = "",
      i = "";
    for (let r of e)
      r != null &&
        (typeof r == "string" &&
          (/[a-zA-Z]/.test(r[0]) && (i += t),
          /\\[a-zA-Z]+\*?$/.test(r) ? (t = " ") : (t = "")),
        (i += r.toString()));
    return i;
  }
  function De(e, t, i) {
    return (
      t.includes(e) && (t = `{${t}}`),
      /^[0-9]$/.test(i) ? `${t}${e}${i}` : `${t}${e}{${i}}`
    );
  }
  function ue(e) {
    let t = [];
    if (Array.isArray(e))
      for (let i of e)
        if (Array.isArray(i)) for (let r of i) t.push(r);
        else t.push(i);
    else t = [e];
    return y(
      t.map(
        (i) =>
          ({
            "<space>": " ",
            "<$$>": "$$",
            "<$>": "$",
            "<{>": "{",
            "<}>": "}",
          })[i] ?? i,
      ),
    );
  }
  var ri = [
    {
      latexTrigger: ["\\not", "<"],
      kind: "infix",
      associativity: "any",
      precedence: 246,
      parse: "NotLess",
    },
    {
      name: "NotLess",
      latexTrigger: ["\\nless"],
      kind: "infix",
      associativity: "any",
      precedence: 246,
    },
    {
      latexTrigger: ["<"],
      kind: "infix",
      associativity: "any",
      precedence: 245,
      parse: "Less",
    },
    {
      name: "Less",
      latexTrigger: ["\\lt"],
      kind: "infix",
      associativity: "any",
      precedence: 245,
    },
    {
      latexTrigger: ["<", "="],
      kind: "infix",
      associativity: "any",
      precedence: 241,
      parse: "LessEqual",
    },
    {
      name: "LessEqual",
      latexTrigger: ["\\le"],
      kind: "infix",
      associativity: "any",
      precedence: 241,
    },
    {
      latexTrigger: ["\\leq"],
      kind: "infix",
      associativity: "any",
      precedence: 241,
      parse: "LessEqual",
    },
    {
      latexTrigger: ["\\leqslant"],
      kind: "infix",
      associativity: "any",
      precedence: A + 5,
      parse: "LessEqual",
    },
    {
      name: "LessNotEqual",
      latexTrigger: ["\\lneqq"],
      kind: "infix",
      associativity: "any",
      precedence: A,
    },
    {
      name: "NotLessNotEqual",
      latexTrigger: ["\\nleqq"],
      kind: "infix",
      associativity: "any",
      precedence: A,
    },
    {
      name: "LessOverEqual",
      latexTrigger: ["\\leqq"],
      kind: "infix",
      associativity: "any",
      precedence: A + 5,
    },
    {
      name: "GreaterOverEqual",
      latexTrigger: ["\\geqq"],
      kind: "infix",
      associativity: "any",
      precedence: A + 5,
      parse: "GreaterEqual",
    },
    {
      name: "Equal",
      latexTrigger: ["="],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      latexTrigger: ["*", "="],
      kind: "infix",
      associativity: "right",
      precedence: A,
      parse: "StarEqual",
    },
    {
      name: "StarEqual",
      latexTrigger: ["\\star", "="],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "PlusEqual",
      latexTrigger: ["+", "="],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "MinusEqual",
      latexTrigger: ["-", "="],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "SlashEqual",
      latexTrigger: ["/", "="],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "EqualEqual",
      latexTrigger: ["=", "="],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "EqualEqualEqual",
      latexTrigger: ["=", "=", "="],
      kind: "infix",
      associativity: "right",
      precedence: A + 5,
    },
    {
      name: "TildeFullEqual",
      latexTrigger: ["\\cong"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "NotTildeFullEqual",
      latexTrigger: ["\\ncong"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "Approx",
      latexTrigger: ["\\approx"],
      kind: "infix",
      associativity: "right",
      precedence: 247,
    },
    {
      name: "NotApprox",
      latexTrigger: ["\\not", "\\approx"],
      kind: "infix",
      associativity: "right",
      precedence: 247,
    },
    {
      name: "ApproxEqual",
      latexTrigger: ["\\approxeq"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "NotApproxEqual",
      latexTrigger: ["\\not", "\\approxeq"],
      kind: "infix",
      associativity: "right",
      precedence: 250,
    },
    {
      name: "NotEqual",
      latexTrigger: ["\\ne"],
      kind: "infix",
      associativity: "right",
      precedence: 255,
    },
    {
      latexTrigger: ["\\neq"],
      kind: "infix",
      associativity: "right",
      precedence: 255,
      parse: "NotEqual",
    },
    {
      name: "Unequal",
      latexTrigger: ["!", "="],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "GreaterEqual",
      latexTrigger: ["\\ge"],
      kind: "infix",
      associativity: "right",
      precedence: 242,
    },
    {
      latexTrigger: ["\\geq"],
      kind: "infix",
      associativity: "right",
      precedence: 242,
      parse: "GreaterEqual",
    },
    {
      latexTrigger: [">", "="],
      kind: "infix",
      associativity: "right",
      precedence: 243,
      parse: "GreaterEqual",
    },
    {
      latexTrigger: ["\\geqslant"],
      kind: "infix",
      associativity: "right",
      precedence: A + 5,
      parse: "GreaterEqual",
    },
    {
      name: "GreaterNotEqual",
      latexTrigger: ["\\gneqq"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "NotGreaterNotEqual",
      latexTrigger: ["\\ngeqq"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      latexTrigger: [">"],
      kind: "infix",
      associativity: "right",
      precedence: 245,
      parse: "Greater",
    },
    {
      name: "Greater",
      latexTrigger: ["\\gt"],
      kind: "infix",
      associativity: "right",
      precedence: 245,
    },
    {
      name: "NotGreater",
      latexTrigger: ["\\ngtr"],
      kind: "infix",
      associativity: "right",
      precedence: 244,
    },
    {
      latexTrigger: ["\\not", ">"],
      kind: "infix",
      associativity: "right",
      precedence: 244,
      parse: "NotGreater",
    },
    {
      name: "RingEqual",
      latexTrigger: ["\\circeq"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "TriangleEqual",
      latexTrigger: ["\\triangleq"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "DotEqual",
      latexTrigger: ["\\doteq"],
      kind: "infix",
      associativity: "right",
      precedence: A + 5,
    },
    {
      name: "DotEqualDot",
      latexTrigger: ["\\doteqdot"],
      kind: "infix",
      associativity: "right",
      precedence: A + 5,
    },
    {
      name: "FallingDotEqual",
      latexTrigger: ["\\fallingdotseq"],
      kind: "infix",
      associativity: "right",
      precedence: A + 5,
    },
    {
      name: "RisingDotEqual",
      latexTrigger: ["\\fallingdotseq"],
      kind: "infix",
      associativity: "right",
      precedence: A + 5,
    },
    {
      name: "QuestionEqual",
      latexTrigger: ["\\questeq"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "MuchLess",
      latexTrigger: ["\\ll"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "MuchGreater",
      latexTrigger: ["\\gg"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "Precedes",
      latexTrigger: ["\\prec"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "Succeeds",
      latexTrigger: ["\\succ"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "PrecedesEqual",
      latexTrigger: ["\\preccurlyeq"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "SucceedsEqual",
      latexTrigger: ["\\curlyeqprec"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "NotPrecedes",
      latexTrigger: ["\\nprec"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "NotSucceeds",
      latexTrigger: ["\\nsucc"],
      kind: "infix",
      associativity: "right",
      precedence: A,
    },
    {
      name: "Between",
      latexTrigger: ["\\between"],
      kind: "infix",
      associativity: "right",
      precedence: A + 5,
    },
  ];
  function Cr(e) {
    return typeof e != "string"
      ? !1
      : ["Less", "LessEqual", "Greater", "GreaterEqual"].includes(e);
  }
  function Br(e) {
    return typeof e != "string" ? !1 : ["Equal", "NotEqual"].includes(e);
  }
  var yi = [
      "number",
      "finite_number",
      "complex",
      "finite_complex",
      "imaginary",
      "real",
      "finite_real",
      "rational",
      "finite_rational",
      "integer",
      "finite_integer",
      "non_finite_number",
    ],
    qr = ["indexed_collection", "list", "tuple"],
    Ti = [...qr, "collection", "set", "record", "dictionary"],
    ki = ["scalar", ...yi, "boolean", "string"],
    Lr = ["value", "color", ...Ti, ...ki],
    Gr = ["expression", "symbol", "function", ...Lr],
    Vr = ["any", "unknown", "nothing", "never", "error", ...Gr],
    jr = new Set(yi),
    ns = new Set(Ti),
    ss = new Set(ki),
    Tt = new Set(Vr);
  function as(e) {
    return typeof e == "string"
      ? Tt.has(e)
      : typeof e != "object" || !("kind" in e)
        ? !1
        : e.kind === "signature" ||
          e.kind === "union" ||
          e.kind === "intersection" ||
          e.kind === "negation" ||
          e.kind === "value" ||
          e.kind === "tuple" ||
          e.kind === "list" ||
          e.kind === "record" ||
          e.kind === "dictionary" ||
          e.kind === "set" ||
          e.kind === "symbol" ||
          e.kind === "expression" ||
          e.kind === "numeric" ||
          e.kind === "collection" ||
          e.kind === "indexed_collection" ||
          e.kind === "reference";
  }
  var ls = class {
      input;
      pos = 0;
      line = 1;
      column = 1;
      tokens = [];
      constructor(e) {
        this.input = e;
      }
      saveState() {
        return {
          pos: this.pos,
          line: this.line,
          column: this.column,
          tokens: [...this.tokens],
        };
      }
      restoreState(e) {
        ((this.pos = e.pos),
          (this.line = e.line),
          (this.column = e.column),
          (this.tokens = e.tokens));
      }
      error(e) {
        throw new Error(
          `Lexer error at line ${this.line}, column ${this.column}: ${e}`,
        );
      }
      peek(e = 0) {
        let t = this.pos + e;
        return t < this.input.length ? this.input[t] : "";
      }
      advance() {
        let e = this.input[this.pos++];
        return (
          e ===
          `
`
            ? (this.line++, (this.column = 1))
            : this.column++,
          e
        );
      }
      match(e) {
        if (this.input.slice(this.pos, this.pos + e.length) === e) {
          for (let t = 0; t < e.length; t++) this.advance();
          return !0;
        }
        return !1;
      }
      isEOF() {
        return this.pos >= this.input.length;
      }
      skipWhitespace() {
        for (; !this.isEOF() && /\s/.test(this.peek());) this.advance();
      }
      readIdentifier() {
        let e = "";
        for (; !this.isEOF() && /[a-zA-Z0-9_]/.test(this.peek());)
          e += this.advance();
        return e;
      }
      readVerbatimString() {
        if (!this.match("`")) return "";
        let e = "";
        for (; !this.isEOF() && this.peek() !== "`";)
          this.match("\\`")
            ? (e += "`")
            : this.match("\\\\")
              ? (e += "\\")
              : (e += this.advance());
        return (
          this.isEOF() && this.error("Unterminated verbatim string"),
          this.advance(),
          e
        );
      }
      readStringLiteral() {
        let e = this.advance(),
          t = "";
        for (; !this.isEOF() && this.peek() !== e;)
          this.match("\\" + e)
            ? (t += e)
            : this.match("\\\\")
              ? (t += "\\")
              : (t += this.advance());
        return (
          this.isEOF() && this.error("Unterminated string literal"),
          this.advance(),
          t
        );
      }
      readNumber() {
        let e = "";
        if (
          ((this.peek() === "-" || this.peek() === "+") &&
            (e += this.advance()),
          this.match("0x") || this.match("0X"))
        ) {
          for (e += "x"; !this.isEOF() && /[0-9a-fA-F]/.test(this.peek());)
            e += this.advance();
          return "0" + e;
        }
        if (this.match("0b") || this.match("0B")) {
          for (e += "b"; !this.isEOF() && /[01]/.test(this.peek());)
            e += this.advance();
          return "0" + e;
        }
        for (; !this.isEOF() && /[0-9]/.test(this.peek());) e += this.advance();
        if (this.peek() === "." && /[0-9]/.test(this.peek(1)))
          for (e += this.advance(); !this.isEOF() && /[0-9]/.test(this.peek());)
            e += this.advance();
        if (this.peek() === "e" || this.peek() === "E")
          for (
            e += this.advance(),
              (this.peek() === "+" || this.peek() === "-") &&
                (e += this.advance());
            !this.isEOF() && /[0-9]/.test(this.peek());
          )
            e += this.advance();
        return e;
      }
      createToken(e, t) {
        return {
          type: e,
          value: t,
          position: this.pos - t.length,
          line: this.line,
          column: this.column - t.length,
        };
      }
      nextToken() {
        if ((this.skipWhitespace(), this.isEOF()))
          return this.createToken("EOF", "");
        let e = this.pos,
          t = this.peek();
        if (this.match("->")) return this.createToken("->", "->");
        if (this.match("..")) return this.createToken("..", "..");
        if (this.match("+\u221E") || this.match("+oo"))
          return this.createToken(
            "PLUS_INFINITY",
            this.input.slice(e, this.pos),
          );
        if (this.match("-\u221E") || this.match("-oo"))
          return this.createToken(
            "MINUS_INFINITY",
            this.input.slice(e, this.pos),
          );
        if (this.match("+infinity"))
          return this.createToken("PLUS_INFINITY", "+infinity");
        if (this.match("-infinity"))
          return this.createToken("MINUS_INFINITY", "-infinity");
        if (/[a-zA-Z_]/.test(t)) {
          let i = this.readIdentifier();
          switch (i) {
            case "true":
              return this.createToken("TRUE", i);
            case "false":
              return this.createToken("FALSE", i);
            case "nan":
              return this.createToken("NAN", i);
            case "infinity":
              return this.createToken("INFINITY", i);
            case "oo":
              return this.createToken("INFINITY", i);
            default:
              return this.createToken("IDENTIFIER", i);
          }
        }
        switch (t) {
          case "|":
            return (this.advance(), this.createToken("|", "|"));
          case "&":
            return (this.advance(), this.createToken("&", "&"));
          case "!":
            return (this.advance(), this.createToken("!", "!"));
          case "^":
            return (this.advance(), this.createToken("^", "^"));
          case "(":
            return (this.advance(), this.createToken("(", "("));
          case ")":
            return (this.advance(), this.createToken(")", ")"));
          case "<":
            return (this.advance(), this.createToken("<", "<"));
          case ">":
            return (this.advance(), this.createToken(">", ">"));
          case "[":
            return (this.advance(), this.createToken("[", "["));
          case "]":
            return (this.advance(), this.createToken("]", "]"));
          case ",":
            return (this.advance(), this.createToken(",", ","));
          case ":":
            return (this.advance(), this.createToken(":", ":"));
          case "?":
            return (this.advance(), this.createToken("?", "?"));
          case "*":
            return (this.advance(), this.createToken("*", "*"));
          case "+":
            return /[0-9]/.test(this.peek(1))
              ? this.createToken("NUMBER_LITERAL", this.readNumber())
              : (this.advance(), this.createToken("+", "+"));
          case "x":
            return /[0-9]/.test(this.peek(1))
              ? (this.advance(), this.createToken("x", "x"))
              : (this.advance(), this.createToken("x", "x"));
        }
        if (t === '"' || t === "'")
          return this.createToken("STRING_LITERAL", this.readStringLiteral());
        if (t === "`")
          return this.createToken("VERBATIM_STRING", this.readVerbatimString());
        if (/[0-9]/.test(t) || (t === "-" && /[0-9]/.test(this.peek(1)))) {
          let i = this.readNumber();
          return (
            this.peek() === "x" && /[0-9]/.test(this.peek(1)),
            this.createToken("NUMBER_LITERAL", i)
          );
        }
        if (t === "\u221E")
          return (this.advance(), this.createToken("INFINITY", "\u221E"));
        this.error(`Unexpected character: ${t}`);
      }
      tokenize() {
        let e = [];
        for (; !this.isEOF();) {
          let t = this.nextToken();
          if (t && (e.push(t), t.type === "EOF")) break;
        }
        return e;
      }
      peekToken() {
        if (this.tokens.length === 0) {
          let e = this.nextToken();
          e && this.tokens.push(e);
        }
        return this.tokens[0] || this.createToken("EOF", "");
      }
      consumeToken() {
        if (this.tokens.length === 0) {
          let e = this.nextToken();
          if (e) return e;
        }
        return this.tokens.shift() || this.createToken("EOF", "");
      }
      matchToken(e) {
        return this.peekToken().type === e ? (this.consumeToken(), !0) : !1;
      }
      expectToken(e) {
        let t = this.consumeToken();
        return (t.type !== e && this.error(`Expected ${e}, got ${t.type}`), t);
      }
    },
    os = class {
      lexer;
      typeResolver;
      current;
      constructor(e, t) {
        ((this.lexer = new ls(e)),
          (this.typeResolver = t?.typeResolver ?? {
            forward: () => {},
            resolve: () => {},
            get names() {
              return [];
            },
          }),
          (this.current = this.lexer.consumeToken()));
      }
      error(e, t) {
        this.errorAtToken(this.current, e, t);
      }
      errorAtToken(e, t, i) {
        let r = this.lexer.input,
          n =
            r.split(`
`)[e.line - 1] || r,
          s = e.column,
          a = " ".repeat(Math.max(0, s - 1)) + "^",
          l = ["", "Invalid type", `|   ${n}`, `|   ${a}`, "|", `|   ${t}`];
        throw (
          i && l.push(`|   ${i}`),
          l.push(""),
          new Error(
            l.join(`
`),
          )
        );
      }
      advance() {
        let e = this.current;
        return ((this.current = this.lexer.consumeToken()), e);
      }
      match(e) {
        return this.current.type === e ? (this.advance(), !0) : !1;
      }
      expect(e) {
        return (
          this.current.type !== e &&
            this.error(`Expected ${e}, got ${this.current.type}`),
          this.advance()
        );
      }
      createNode(e, t = {}) {
        return {
          kind: e,
          position: this.current.position,
          line: this.current.line,
          column: this.current.column,
          ...t,
        };
      }
      parseType() {
        this.checkForNakedFunctionSignature();
        let e = this.parseUnionType();
        if ((e || this.error("Expected a type"), this.current.type !== "EOF"))
          if (
            this.current.type === "->" ||
            this.current.type === "+" ||
            this.current.type === "*" ||
            this.current.type === "?"
          )
            this.error(
              "Function signatures must be enclosed in parentheses",
              "For example `(x: number) -> number`",
            );
          else if (this.current.type === "(") {
            let t = this.lexer.input;
            t.includes("set(") ||
            t.includes("collection(") ||
            t.includes("list(") ||
            t.includes("tuple(")
              ? t.includes("set(")
                ? this.error("Use `set<integer>` instead of `set(integer)`.")
                : t.includes("collection(")
                  ? this.error(
                      "Use `collection<type>` instead of `collection(type)`.",
                      "For example `collection<number>`",
                    )
                  : t.includes("list(")
                    ? this.error(
                        "Use `list<type>` instead of `list(type)`.",
                        "For example `list<number>`",
                      )
                    : t.includes("tuple(") &&
                      this.error(
                        "Use `tuple<type1, type2>` instead of `tuple(type1, type2)`.",
                        "For example `tuple<string, number>`",
                      )
              : this.error("Unexpected token after type");
          } else this.error("Unexpected token after type");
        return e;
      }
      checkForNakedFunctionSignature() {
        if (this.current.type === "IDENTIFIER") {
          let e = this.lexer.saveState(),
            t = this.current;
          try {
            let i = this.current;
            if ((this.advance(), this.current.type === ":")) {
              this.advance();
              let r = !1,
                n = 0,
                s = 10;
              for (; this.current.type !== "EOF" && n < s;) {
                if (this.current.type === "->") {
                  r = !0;
                  break;
                }
                if (
                  this.current.type === "+" ||
                  this.current.type === "*" ||
                  this.current.type === "?"
                ) {
                  if ((this.advance(), this.current.type === "->")) {
                    r = !0;
                    break;
                  }
                  n++;
                }
                (this.advance(), n++);
              }
              r &&
                (this.lexer.restoreState(e),
                (this.current = t),
                this.errorAtToken(
                  i,
                  "Function signatures must be enclosed in parentheses",
                  "For example `(z: string*) -> boolean`",
                ));
            }
            (this.lexer.restoreState(e), (this.current = t));
          } catch (i) {
            if (
              (this.lexer.restoreState(e),
              (this.current = t),
              i instanceof Error &&
                i.message.includes("Function signatures must be enclosed"))
            )
              throw i;
          }
        }
      }
      parseUnionType() {
        let e = this.parseIntersectionType();
        if (!e) return;
        let t = [e];
        for (; this.match("|");) {
          let i = this.parseIntersectionType();
          (i || this.error("Expected type after |"), t.push(i));
        }
        return t.length === 1 ? t[0] : this.createNode("union", { types: t });
      }
      parseIntersectionType() {
        let e = this.parsePrimaryType();
        if (!e) return;
        let t = [e];
        for (; this.match("&");) {
          let i = this.parsePrimaryType();
          (i || this.error("Expected type after &"), t.push(i));
        }
        return t.length === 1
          ? t[0]
          : this.createNode("intersection", { types: t });
      }
      parsePrimaryType() {
        if (this.match("!")) {
          let e = this.parsePrimaryType();
          return (
            e || this.error("Expected type after !"),
            this.createNode("negation", { type: e })
          );
        }
        if (this.current.type === "(") {
          let e = this.parseFunctionSignature();
          if (e) return e;
          if (this.match("(")) {
            let t = this.parseUnionType();
            if (
              (t || this.error("Expected type after ("),
              this.current.type === ",")
            ) {
              let i = [
                this.createNode("named_element", { name: void 0, type: t }),
              ];
              for (; this.match(",");) {
                let r = this.parseUnionType();
                (r || this.error("Expected type after ,"),
                  i.push(
                    this.createNode("named_element", { name: void 0, type: r }),
                  ));
              }
              return (
                this.expect(")"),
                this.createNode("tuple", { elements: i })
              );
            }
            return (this.expect(")"), this.createNode("group", { type: t }));
          }
        }
        return (
          this.parseListType() ||
          this.parseTupleType() ||
          this.parseRecordType() ||
          this.parseDictionaryType() ||
          this.parseSetType() ||
          this.parseCollectionType() ||
          this.parseExpressionType() ||
          this.parseSymbolType() ||
          this.parseNumericType() ||
          this.parsePrimitiveType() ||
          this.parseValue() ||
          this.parseTypeReference()
        );
      }
      isFunctionSignature() {
        let e = this.lexer.saveState(),
          t = this.current;
        this.advance();
        let i = 1;
        for (; i > 0 && this.current.type !== "EOF";)
          (this.current.type === "(" ? i++ : this.current.type === ")" && i--,
            this.advance());
        let r = this.current.type === "->";
        return (this.lexer.restoreState(e), (this.current = t), r);
      }
      parseFunctionSignature() {
        if (this.current.type !== "(" || !this.isFunctionSignature()) return;
        let e = [];
        if ((this.advance(), !this.match(")"))) {
          do {
            let s = this.parseArgument();
            (s || this.error("Expected argument"), e.push(s));
          } while (this.match(","));
          this.expect(")");
        }
        this.expect("->");
        let t = this.parseUnionType();
        t || this.error("Expected return type after ->");
        let i = e.some((s) => s.modifier === "optional"),
          r = e.some(
            (s) =>
              s.modifier === "variadic_zero" || s.modifier === "variadic_one",
          ),
          n = e.filter(
            (s) =>
              s.modifier === "variadic_zero" || s.modifier === "variadic_one",
          ).length;
        return (
          i &&
            r &&
            this.error(
              "Variadic arguments cannot be used with optional arguments",
            ),
          n > 1 && this.error("There can be only one variadic argument"),
          this.createNode("function_signature", { arguments: e, returnType: t })
        );
      }
      parseArgument() {
        let e = this.parseNamedElement();
        if (!e) return;
        let t;
        return (
          this.match("?")
            ? (t = "optional")
            : this.match("*")
              ? (t = "variadic_zero")
              : this.match("+") && (t = "variadic_one"),
          this.createNode("argument", { element: e, modifier: t })
        );
      }
      parseNamedElement() {
        let e;
        if (
          this.current.type === "IDENTIFIER" ||
          this.current.type === "VERBATIM_STRING"
        ) {
          let i = this.current;
          if (this.lexer.peekToken().type === ":") {
            ((e = i.value), this.advance(), this.advance());
            let r = this.parseUnionType();
            return r
              ? this.createNode("named_element", { name: e, type: r })
              : void 0;
          }
        }
        let t = this.parseUnionType();
        if (t)
          return this.createNode("named_element", { name: void 0, type: t });
      }
      parseListType() {
        if (this.current.type === "IDENTIFIER") {
          let e = this.current,
            t = this.lexer.peekToken().type === "<";
          switch (e.value) {
            case "list":
              return t ? (this.advance(), this.parseListTypeImpl()) : void 0;
            case "vector":
              return t
                ? (this.advance(), this.parseVectorType())
                : (this.advance(),
                  this.createNode("list", {
                    elementType: this.createNode("primitive", {
                      name: "number",
                    }),
                    dimensions: void 0,
                  }));
            case "matrix":
              return t
                ? (this.advance(), this.parseMatrixType())
                : (this.advance(),
                  this.createNode("matrix", {
                    elementType: this.createNode("primitive", {
                      name: "number",
                    }),
                    dimensions: [
                      this.createNode("dimension", { size: -1 }),
                      this.createNode("dimension", { size: -1 }),
                    ],
                  }));
            case "tensor":
              return t
                ? (this.advance(), this.parseTensorType())
                : (this.advance(),
                  this.createNode("list", {
                    elementType: this.createNode("primitive", {
                      name: "number",
                    }),
                    dimensions: void 0,
                  }));
            default:
              return;
          }
        }
      }
      parseListTypeImpl() {
        let e = this.createNode("primitive", { name: "any" }),
          t;
        if (this.match("<")) {
          if (((t = this.parseDimensions()), !t)) {
            let i = this.parseUnionType();
            i &&
              ((e = i), this.match("^") && (t = this.parseCaretDimensions()));
          }
          this.expect(">");
        }
        return this.createNode("list", { elementType: e, dimensions: t });
      }
      parseVectorType() {
        let e = this.createNode("primitive", { name: "number" }),
          t;
        if (this.match("<")) {
          if (this.current.type === "NUMBER_LITERAL")
            t = parseInt(this.advance().value);
          else {
            let i = this.parseUnionType();
            i &&
              ((e = i),
              this.match("^") &&
                (this.current.type === "NUMBER_LITERAL"
                  ? (t = parseInt(this.advance().value))
                  : this.error("Expected number after ^")));
          }
          this.expect(">");
        }
        return this.createNode("vector", { elementType: e, size: t });
      }
      parseMatrixType() {
        let e = this.createNode("primitive", { name: "number" }),
          t;
        if (this.match("<")) {
          if (((t = this.parseDimensions()), !t)) {
            let i = this.parseUnionType();
            i &&
              ((e = i), this.match("^") && (t = this.parseCaretDimensions()));
          }
          this.expect(">");
        } else
          t = [
            this.createNode("dimension", { size: null }),
            this.createNode("dimension", { size: null }),
          ];
        return this.createNode("matrix", { elementType: e, dimensions: t });
      }
      parseTensorType() {
        let e = this.createNode("primitive", { name: "number" });
        if (this.match("<")) {
          let t = this.parseUnionType();
          (t && (e = t), this.expect(">"));
        }
        return this.createNode("tensor", { elementType: e });
      }
      parseDimensions() {
        let e = this.parseDimension();
        if (!e) return;
        let t = [e];
        for (;;) {
          let i = this.current;
          if (i.type === "IDENTIFIER" && /^(x\d+)+$/.test(i.value)) {
            this.advance();
            for (let r of i.value.match(/x(\d+)/g))
              t.push(
                this.createNode("dimension", { size: parseInt(r.slice(1)) }),
              );
          } else if (i.type === "IDENTIFIER" && i.value === "x") {
            let r = this.lexer.peekToken();
            (r.type !== "NUMBER_LITERAL" &&
              r.type !== "?" &&
              this.error(
                "Expected a positive integer literal or `?` after x. For example: `2x3` or `2x?`",
              ),
              this.advance(),
              t.push(this.parseDimension()));
          } else break;
        }
        return t;
      }
      parseDimension() {
        if (this.match("?"))
          return this.createNode("dimension", { size: null });
        if (this.current.type === "NUMBER_LITERAL") {
          let e = parseInt(this.advance().value);
          return this.createNode("dimension", { size: e });
        }
      }
      parseCaretDimensions() {
        let e = this.match("("),
          t = this.parseDimensions();
        return (e && this.expect(")"), t);
      }
      parseTupleType() {
        if (
          this.current.type === "IDENTIFIER" &&
          this.current.value === "tuple"
        ) {
          if (this.lexer.peekToken().type !== "<") return;
          (this.advance(), this.expect("<"));
          let e = [];
          if (this.current.type !== ">") {
            let t = this.parseNamedElement();
            (t || this.error("Expected tuple element"), e.push(t));
            let i = t.name !== void 0;
            for (; this.match(",");) {
              let r = this.parseNamedElement();
              (r || this.error("Expected tuple element"),
                i &&
                  !r.name &&
                  this.error(
                    "All tuple elements should be named, or none. Previous elements were named, but this one isn't.",
                  ),
                !i &&
                  r.name &&
                  this.error(
                    "All tuple elements should be named, or none. Previous elements were not named, but this one is.",
                  ),
                e.push(r));
            }
          }
          return (this.expect(">"), this.createNode("tuple", { elements: e }));
        }
      }
      parseRecordType() {
        if (
          this.current.type === "IDENTIFIER" &&
          this.current.value === "record"
        ) {
          this.advance();
          let e = [];
          if (this.match("<")) {
            if (this.current.type !== ">")
              do {
                let t = this.parseRecordEntry();
                (t || this.error("Expected record entry"), e.push(t));
              } while (this.match(","));
            this.expect(">");
          }
          return this.createNode("record", { entries: e });
        }
      }
      parseRecordEntry() {
        let e;
        if (this.current.type === "IDENTIFIER") e = this.advance().value;
        else if (this.current.type === "VERBATIM_STRING")
          e = this.advance().value;
        else return;
        this.expect(":");
        let t = this.parseUnionType();
        return (
          t || this.error("Expected value type"),
          this.createNode("record_entry", { key: e, valueType: t })
        );
      }
      parseDictionaryType() {
        if (
          this.current.type === "IDENTIFIER" &&
          this.current.value === "dictionary"
        ) {
          this.advance();
          let e = this.createNode("primitive", { name: "any" });
          if (this.match("<")) {
            let t = this.parseUnionType();
            (t && (e = t), this.expect(">"));
          }
          return this.createNode("dictionary", { valueType: e });
        }
      }
      parseSetType() {
        if (
          this.current.type === "IDENTIFIER" &&
          this.current.value === "set"
        ) {
          this.advance();
          let e = this.createNode("primitive", { name: "any" });
          if (this.match("<")) {
            let t = this.parseUnionType();
            (t && (e = t), this.expect(">"));
          }
          return this.createNode("set", { elementType: e });
        }
      }
      parseCollectionType() {
        if (this.current.type === "IDENTIFIER") {
          let e = this.current.value === "indexed_collection",
            t = this.current.value === "collection";
          if (e || t) {
            this.advance();
            let i = this.createNode("primitive", { name: "any" });
            if (this.match("<")) {
              let r = this.parseUnionType();
              (r && (i = r), this.expect(">"));
            }
            return this.createNode("collection", {
              elementType: i,
              indexed: e,
            });
          }
        }
      }
      parseExpressionType() {
        if (
          this.current.type === "IDENTIFIER" &&
          this.current.value === "expression"
        ) {
          if (this.lexer.peekToken().type !== "<") return;
          (this.advance(), this.expect("<"));
          let e = this.expect("IDENTIFIER").value;
          return (
            this.expect(">"),
            this.createNode("expression", { operator: e })
          );
        }
      }
      parseSymbolType() {
        if (
          this.current.type === "IDENTIFIER" &&
          this.current.value === "symbol"
        ) {
          if (this.lexer.peekToken().type !== "<") return;
          (this.advance(), this.expect("<"));
          let e = this.expect("IDENTIFIER").value;
          return (this.expect(">"), this.createNode("symbol", { name: e }));
        }
      }
      parseNumericType() {
        if (
          this.current.type === "IDENTIFIER" &&
          [
            "real",
            "finite_real",
            "rational",
            "finite_rational",
            "integer",
            "finite_integer",
          ].includes(this.current.value)
        ) {
          let e = this.advance().value;
          if (this.match("<")) {
            let t = this.parseValue();
            this.expect("..");
            let i = this.parseValue();
            this.expect(">");
            let r = t?.value ?? -1 / 0,
              n = i?.value ?? 1 / 0;
            return (
              (Number.isNaN(r) || Number.isNaN(n)) &&
                this.error(
                  "Invalid numeric type",
                  "Lower and upper bounds must be valid numbers",
                ),
              r > n &&
                this.error(
                  `Invalid range: ${r}..${n}`,
                  "The lower bound must be less than the upper bound",
                ),
              this.createNode("numeric", {
                baseType: e,
                lowerBound: t,
                upperBound: i,
              })
            );
          }
          return this.createNode("numeric", { baseType: e });
        }
      }
      parsePrimitiveType() {
        if (this.current.type === "IDENTIFIER") {
          let e = this.current.value;
          if (Tt.has(e))
            return (this.advance(), this.createNode("primitive", { name: e }));
        }
      }
      parseValue() {
        let e, t;
        switch (this.current.type) {
          case "STRING_LITERAL":
            ((e = this.advance().value), (t = "string"));
            break;
          case "NUMBER_LITERAL":
            ((e = parseFloat(this.advance().value)), (t = "number"));
            break;
          case "TRUE":
            (this.advance(), (e = !0), (t = "boolean"));
            break;
          case "FALSE":
            (this.advance(), (e = !1), (t = "boolean"));
            break;
          case "NAN":
            (this.advance(), (e = NaN), (t = "nan"));
            break;
          case "INFINITY":
          case "PLUS_INFINITY":
            (this.advance(), (e = 1 / 0), (t = "infinity"));
            break;
          case "MINUS_INFINITY":
            (this.advance(), (e = -1 / 0), (t = "infinity"));
            break;
          default:
            return;
        }
        return this.createNode("value", { value: e, valueType: t });
      }
      parseTypeReference() {
        let e =
          this.current.type === "IDENTIFIER" && this.current.value === "type";
        if ((e && this.advance(), this.current.type === "IDENTIFIER")) {
          let t = this.current,
            i = this.advance().value;
          return this.typeResolver.resolve(i)
            ? this.createNode("type_reference", { name: i, isForward: e })
            : e && this.typeResolver.forward(i)
              ? this.createNode("type_reference", { name: i, isForward: !0 })
              : (e ||
                  this.errorAtToken(
                    t,
                    `Unknown type "${i}"`,
                    "Syntax error. The type was not recognized.",
                  ),
                this.createNode("type_reference", { name: i, isForward: e }));
        }
      }
    };
  function us(e, t) {
    switch (e.kind) {
      case "function_signature":
        return t.visitFunctionSignature(e);
      case "union":
        return t.visitUnionType(e);
      case "intersection":
        return t.visitIntersectionType(e);
      case "negation":
        return t.visitNegationType(e);
      case "group":
        return t.visitGroupType(e);
      case "list":
        return t.visitListType(e);
      case "vector":
        return t.visitVectorType(e);
      case "matrix":
        return t.visitMatrixType(e);
      case "tensor":
        return t.visitTensorType(e);
      case "tuple":
        return t.visitTupleType(e);
      case "record":
        return t.visitRecordType(e);
      case "dictionary":
        return t.visitDictionaryType(e);
      case "set":
        return t.visitSetType(e);
      case "collection":
        return t.visitCollectionType(e);
      case "expression":
        return t.visitExpressionType(e);
      case "symbol":
        return t.visitSymbolType(e);
      case "numeric":
        return t.visitNumericType(e);
      case "primitive":
        return t.visitPrimitiveType(e);
      case "type_reference":
        return t.visitTypeReference(e);
      case "value":
        return t.visitValue(e);
      default:
        throw new Error(`Unknown node kind: ${e.kind}`);
    }
  }
  var cs = class {
    typeResolver;
    constructor(e) {
      this.typeResolver = e ?? {
        forward: () => {},
        resolve: () => {},
        get names() {
          return [];
        },
      };
    }
    buildType(e) {
      return us(e, this);
    }
    visitFunctionSignature(e) {
      let t = [],
        i = [],
        r,
        n;
      for (let l of e.arguments) {
        let o = this.buildNamedElement(l.element);
        switch (l.modifier) {
          case "optional":
            i.push(o);
            break;
          case "variadic_zero":
            ((r = o), (n = 0));
            break;
          case "variadic_one":
            ((r = o), (n = 1));
            break;
          default:
            t.push(o);
            break;
        }
      }
      let s = this.buildType(e.returnType),
        a = { kind: "signature", args: t.length > 0 ? t : void 0, result: s };
      return (
        i.length > 0 && (a.optArgs = i),
        r && ((a.variadicArg = r), (a.variadicMin = n)),
        a
      );
    }
    visitUnionType(e) {
      return { kind: "union", types: e.types.map((t) => this.buildType(t)) };
    }
    visitIntersectionType(e) {
      return {
        kind: "intersection",
        types: e.types.map((t) => this.buildType(t)),
      };
    }
    visitNegationType(e) {
      return { kind: "negation", type: this.buildType(e.type) };
    }
    visitGroupType(e) {
      return this.buildType(e.type);
    }
    visitListType(e) {
      let t = this.buildType(e.elementType),
        i = e.dimensions?.map((r) => this.buildDimension(r));
      return { kind: "list", elements: t, dimensions: i };
    }
    visitVectorType(e) {
      let t = this.buildType(e.elementType);
      return e.size !== void 0
        ? { kind: "list", elements: t, dimensions: [e.size] }
        : { kind: "list", elements: t };
    }
    visitMatrixType(e) {
      let t = this.buildType(e.elementType);
      if (e.dimensions) {
        let i = e.dimensions.map((r) => this.buildDimension(r));
        return { kind: "list", elements: t, dimensions: i };
      }
      return { kind: "list", elements: t, dimensions: [-1, -1] };
    }
    visitTensorType(e) {
      return { kind: "list", elements: this.buildType(e.elementType) };
    }
    visitTupleType(e) {
      return {
        kind: "tuple",
        elements: e.elements.map((t) => this.buildNamedElement(t)),
      };
    }
    visitRecordType(e) {
      if (e.entries.length === 0) return "record";
      let t = {};
      for (let i of e.entries) t[i.key] = this.buildType(i.valueType);
      return { kind: "record", elements: t };
    }
    visitDictionaryType(e) {
      let t = this.buildType(e.valueType);
      return this.isAnyType(t)
        ? "dictionary"
        : { kind: "dictionary", values: t };
    }
    visitSetType(e) {
      let t = this.buildType(e.elementType);
      return this.isAnyType(t) ? "set" : { kind: "set", elements: t };
    }
    visitCollectionType(e) {
      let t = this.buildType(e.elementType);
      return e.indexed
        ? this.isAnyType(t)
          ? "indexed_collection"
          : { kind: "indexed_collection", elements: t }
        : this.isAnyType(t)
          ? "collection"
          : { kind: "collection", elements: t };
    }
    visitExpressionType(e) {
      return { kind: "expression", operator: e.operator };
    }
    visitSymbolType(e) {
      return { kind: "symbol", name: e.name };
    }
    visitNumericType(e) {
      if (!e.lowerBound && !e.upperBound) return e.baseType;
      let t = e.lowerBound ? this.buildValue(e.lowerBound) : -1 / 0,
        i = e.upperBound ? this.buildValue(e.upperBound) : 1 / 0;
      return t === -1 / 0 && i === 1 / 0
        ? e.baseType
        : { kind: "numeric", type: e.baseType, lower: t, upper: i };
    }
    visitPrimitiveType(e) {
      return e.name;
    }
    visitTypeReference(e) {
      let t = this.typeResolver.resolve(e.name);
      if (t) return t;
      if (e.isForward) {
        let i = this.typeResolver.forward(e.name);
        if (i) return i;
      }
      return e.name;
    }
    visitValue(e) {
      return { kind: "value", value: e.value };
    }
    buildNamedElement(e) {
      let t = this.buildType(e.type);
      return e.name ? { name: e.name, type: t } : { type: t };
    }
    buildDimension(e) {
      return e.size ?? -1;
    }
    buildValue(e) {
      return e.value;
    }
    isAnyType(e) {
      return (
        e === "any" ||
        (typeof e == "object" &&
          "kind" in e &&
          e.kind === "primitive" &&
          "name" in e &&
          e.name === "any")
      );
    }
  };
  function ps(e, t) {
    return new cs(t).buildType(e);
  }
  var ut = new Map(),
    hs = 2048;
  function Zr(e) {
    if (e === null || typeof e != "object" || Object.isFrozen(e)) return e;
    Object.freeze(e);
    for (let t of Object.values(e)) Zr(t);
    return e;
  }
  function ni(e, t) {
    if (e === void 0) return;
    if (as(e)) return e;
    if (typeof e != "string") return;
    let i = t === void 0;
    if (i) {
      let r = ut.get(e);
      if (r !== void 0) return r;
    }
    try {
      let r = new os(e, { typeResolver: t }).parseType(),
        n = ps(r, t);
      return (i && (ut.size >= hs && ut.clear(), ut.set(e, Zr(n))), n);
    } catch (r) {
      throw new Error(
        `Failed to parse type "${e}": ${r instanceof Error ? r.message : String(r)}`,
      );
    }
  }
  var Vi = {
      number: yi,
      non_finite_number: [],
      finite_number: [
        "finite_complex",
        "finite_real",
        "finite_integer",
        "finite_rational",
      ],
      complex: [
        "finite_complex",
        "imaginary",
        "finite_real",
        "finite_rational",
        "finite_integer",
        "non_finite_number",
      ],
      finite_complex: [
        "imaginary",
        "finite_real",
        "finite_rational",
        "finite_integer",
      ],
      imaginary: [],
      real: [
        "rational",
        "integer",
        "finite_real",
        "finite_rational",
        "finite_integer",
        "non_finite_number",
      ],
      finite_real: ["finite_rational", "finite_integer"],
      rational: [
        "finite_rational",
        "finite_integer",
        "integer",
        "non_finite_number",
      ],
      finite_rational: ["finite_integer"],
      integer: ["finite_integer", "non_finite_number"],
      finite_integer: [],
      any: Vr,
      unknown: [],
      nothing: [],
      never: [],
      error: [],
      value: Lr,
      scalar: ki,
      collection: Ti,
      indexed_collection: qr,
      list: [],
      set: [],
      tuple: [],
      record: [],
      dictionary: [],
      function: [],
      symbol: [],
      boolean: [],
      string: [],
      color: [],
      expression: Gr,
    },
    Ur = (() => {
      let e = {},
        t = (i) => {
          if (e[i]) return e[i];
          let r = new Set([i]);
          e[i] = r;
          for (let n of Vi[i]) if (n !== i) for (let s of t(n)) r.add(s);
          return r;
        };
      for (let i of Object.keys(Vi)) t(i);
      return e;
    })();
  function Le(e, t) {
    return t === "any" || e === "never"
      ? !0
      : e === "unknown" || t === "unknown"
        ? !1
        : e === t
          ? !0
          : Ur[t].has(e);
  }
  function E(e, t) {
    if (
      (typeof e == "string" && !Tt.has(e) && (e = ni(e)),
      typeof t == "string" && !Tt.has(t) && (t = ni(t)),
      t === "any" || e === "never")
    )
      return !0;
    if (t === "never") return !1;
    if (t === "error") return e === "error";
    if (t === "nothing") return e === "nothing";
    if (e === "nothing") return !1;
    if (t === "unknown") return !0;
    if (e === "unknown") return !1;
    if (typeof t == "string")
      return typeof e == "string"
        ? Le(e, t)
        : e.kind === "value"
          ? typeof e.value == "boolean"
            ? t === "boolean"
            : typeof e.value == "number"
              ? Number.isInteger(e.value)
                ? Le("integer", t)
                : Le("real", t)
              : typeof e.value == "boolean"
                ? Le("boolean", t)
                : typeof e.value == "string"
                  ? Le("string", t)
                  : !1
          : e.kind === "union"
            ? e.types.every((i) => E(i, t))
            : e.kind === "intersection"
              ? e.types.some((i) => E(i, t))
              : e.kind === "negation"
                ? !E(e.type, t)
                : e.kind === "numeric"
                  ? !!E(e.type, t)
                  : t === "number"
                    ? Yr(e)
                    : t === "symbol"
                      ? si(e)
                      : t === "expression"
                        ? gs(e)
                        : t === "function"
                          ? Jr(e)
                          : t === "scalar"
                            ? Hr(e)
                            : t === "value"
                              ? Qr(e)
                              : t === "indexed_collection"
                                ? Kr(e)
                                : t === "collection"
                                  ? Wr(e)
                                  : t === "tuple"
                                    ? e.kind === "tuple"
                                    : t === "list"
                                      ? e.kind === "list"
                                      : t === "set"
                                        ? e.kind === "set"
                                        : t === "record"
                                          ? e.kind === "record"
                                          : t === "dictionary"
                                            ? e.kind === "dictionary"
                                            : !1;
    if (t.kind === "union")
      return typeof e != "string" && e.kind === "union"
        ? e.types.every((i) => t.types.some((r) => E(i, r)))
        : t.types.some((i) => E(e, i));
    if (t.kind === "expression") {
      if (e === "symbol") return !0;
      if (typeof e == "string") return !1;
      if (e.kind === "expression")
        return t.operator === "Symbol" ? si(e) : e.operator === t.operator;
      if (e.kind === "symbol") return !0;
    }
    if (typeof e == "string") return !1;
    if (t.kind === "reference") {
      if (e.kind === "reference") return e.name === t.name;
      if (t.alias === !0 && t.def) return E(e, t.def);
    }
    if (e.kind === "union") return e.types.some((i) => E(i, t));
    if (e.kind === "intersection" && t.kind === "intersection")
      return t.types.every((i) => e.types.some((r) => E(r, i)));
    if (e.kind === "intersection") return e.types.every((i) => E(i, t));
    if (t.kind === "intersection") return t.types.every((i) => E(e, i));
    if (e.kind === "signature" && t.kind === "signature") {
      if (!E(e.result, t.result)) return !1;
      if (e.optArgs || e.variadicArg) {
        if (t.args) {
          if (!e.args || e.args.length !== t.args.length) return !1;
          for (let i = 0; i < t.args.length; i++)
            if (!E(t.args[i].type, e.args[i].type)) return !1;
        } else if (e.args) return !1;
        if (t.optArgs) {
          if (!e.optArgs || e.optArgs.length !== t.optArgs.length) return !1;
          for (let i = 0; i < e.optArgs.length; i++)
            if (!E(t.optArgs[i].type, e.optArgs[i].type)) return !1;
        } else if (e.optArgs) return !1;
        if (t.variadicArg) {
          if (
            !e.variadicArg ||
            e.variadicMin != t.variadicMin ||
            !E(t.variadicArg.type, e.variadicArg.type)
          )
            return !1;
        } else if (e.variadicArg) return !1;
      } else {
        if (t.args && !e.args) return !1;
        let i = 0;
        if (t.args) {
          if (e.args.length < t.args.length) return !1;
          for (; i < t.args.length;) {
            if (!E(t.args[i].type, e.args[i].type)) return !1;
            i += 1;
          }
        }
        if (t.optArgs) {
          if (i >= e.args.length) return !0;
          for (let r = 0; r < t.optArgs.length; r++) {
            if (!E(t.optArgs[r].type, e.args[i].type)) return !1;
            if (((i += 1), i >= e.args.length)) return !0;
          }
        }
        if (t.variadicArg) {
          if (i >= e.args.length && t.variadicMin === 0) return !0;
          if (t.variadicMin > 0 && i + t.variadicMin > e.args.length) return !1;
          for (; i < e.args.length;) {
            if (!E(t.variadicArg.type, e.args[i].type)) return !1;
            i += 1;
          }
        }
      }
      return !0;
    }
    if (e.kind === "record" && t.kind === "record") {
      for (let i of Object.keys(t.elements))
        if (!(i in e.elements) || !E(e.elements[i], t.elements[i])) return !1;
      return !0;
    }
    if (e.kind === "dictionary" && t.kind === "dictionary")
      return E(e.values, t.values);
    if (t.kind === "indexed_collection")
      return e.kind === "indexed_collection" || e.kind === "list"
        ? E(e.elements, t.elements)
        : e.kind === "tuple"
          ? e.elements.every((i) => E(i.type, t.elements))
          : !1;
    if (t.kind === "collection") {
      if (
        e.kind === "collection" ||
        e.kind === "indexed_collection" ||
        e.kind === "list"
      )
        return E(e.elements, t.elements);
      if (e.kind === "tuple")
        return e.elements.every((i) => E(i.type, t.elements));
      if (e.kind === "set") return E(e.elements, t.elements);
      if (e.kind === "dictionary")
        return E(
          { kind: "tuple", elements: [{ type: "string" }, { type: e.values }] },
          t.elements,
        );
      if (e.kind === "record")
        return E(
          {
            kind: "tuple",
            elements: [
              { type: "string" },
              { type: Xr(...Object.values(e.elements)) },
            ],
          },
          t.elements,
        );
    }
    if (e.kind === "tuple" && t.kind === "tuple") {
      if (e.elements.length !== t.elements.length) return !1;
      for (let i = 0; i < e.elements.length; i++) {
        let r = e.elements[i],
          n = t.elements[i];
        if (!E(r.type, n.type) || r.name !== n.name) return !1;
      }
      return !0;
    }
    if (t.kind === "list" && e.kind === "list") {
      if (!E(e.elements, t.elements)) return !1;
      if (t.dimensions) {
        if (!e.dimensions || e.dimensions.length !== t.dimensions.length)
          return !1;
        for (let i = 0; i < e.dimensions.length; i++)
          if (t.dimensions[i] !== -1 && e.dimensions[i] !== t.dimensions[i])
            return !1;
      }
      return !0;
    }
    if (e.kind === "symbol" && t.kind === "symbol") return e.name === t.name;
    if (e.kind === "numeric" && t.kind === "numeric")
      return !(
        !E(e.type, t.type) ||
        (e.lower ?? -1 / 0) < (t.lower ?? -1 / 0) ||
        (e.upper ?? 1 / 0) > (t.upper ?? 1 / 0)
      );
    if (t.kind === "set" && e.kind === "set")
      return !!E(e.elements, t.elements);
    if (e.kind === "negation" && t.kind === "negation")
      return E(e.type, t.type);
    if (t.kind === "negation") return !E(e, t.type);
    if (t.kind === "value" && e.kind === "value") return t.value === e.value;
    if (e.kind === "value") {
      if (typeof e.value == "boolean") return E("boolean", t);
      if (typeof e.value == "number")
        return Number.isInteger(e.value) ? E("integer", t) : E("real", t);
      if (typeof e.value == "string") return E("string", t);
    }
    return !1;
  }
  function Yr(e) {
    return typeof e == "string"
      ? jr.has(e)
      : e.kind === "value"
        ? typeof e.value == "number"
        : e.kind === "numeric";
  }
  function Hr(e) {
    return Yr(e)
      ? !0
      : typeof e == "string"
        ? ss.has(e)
        : e.kind === "value"
          ? ["string", "boolean", "number"].includes(typeof e.value)
          : !1;
  }
  function Wr(e) {
    return Kr(e)
      ? !0
      : typeof e == "string"
        ? ns.has(e)
        : ["collection", "set", "record", "dictionary"].includes(e.kind);
  }
  function Kr(e) {
    return typeof e == "string"
      ? !1
      : ["indexed_collection", "list", "tuple"].includes(e.kind);
  }
  function Qr(e) {
    return Hr(e) || Wr(e);
  }
  function Jr(e) {
    return e === "function" || (typeof e != "string" && e.kind === "signature");
  }
  function gs(e) {
    return (typeof e == "string" &&
      ["expression", "symbol", "function"].includes(e)) ||
      Qr(e) ||
      Jr(e) ||
      si(e)
      ? !0
      : typeof e == "string"
        ? !1
        : e.kind === "expression";
  }
  function si(e) {
    return e === "symbol"
      ? !0
      : typeof e == "string"
        ? !1
        : e.kind === "symbol"
          ? !0
          : e.kind === "expression"
            ? e.operator === "Symbol"
            : !1;
  }
  function ds(e, t) {
    return e === t
      ? e
      : e === "nothing" || t === "nothing"
        ? "nothing"
        : e === "any"
          ? t
          : t === "any"
            ? e
            : e === "never"
              ? t
              : t === "never"
                ? e
                : e === "unknown"
                  ? t
                  : t === "unknown" || E(e, t)
                    ? e
                    : E(t, e)
                      ? t
                      : "never";
  }
  function fs(e, t) {
    if (e === t) return e;
    if (e === "any" || t === "any") return "any";
    if (e === "never") return t;
    if (t === "never") return e;
    if (e === "unknown") return t;
    if (t === "unknown") return e;
    if (e === "nothing") return t;
    if (t === "nothing") return e;
    if (E(e, t)) return t;
    if (E(t, e)) return e;
    let i = Ts(e, t);
    return ms.has(i) ? xs(e, t) : i;
  }
  var ms = new Set([
    "scalar",
    "value",
    "function",
    "expression",
    "collection",
    "indexed_collection",
    "list",
    "set",
    "tuple",
    "record",
    "dictionary",
    "map",
    "any",
  ]);
  function xs(e, t) {
    let i = [],
      r = new Set(),
      n = (s) => {
        if (typeof s == "object" && s.kind === "union") {
          for (let l of s.types) n(l);
          return;
        }
        let a = typeof s == "string" ? s : JSON.stringify(s);
        r.has(a) || (r.add(a), i.push(s));
      };
    return (n(e), n(t), i.length === 1 ? i[0] : { kind: "union", types: i });
  }
  function ys(...e) {
    return e.length === 0
      ? "nothing"
      : e.length === 1
        ? e[0]
        : e.reduce((t, i) => ds(t, i));
  }
  function Xr(...e) {
    return e.length === 0
      ? "nothing"
      : e.length === 1
        ? e[0]
        : e.reduce((t, i) => fs(t, i));
  }
  var ji = [
      "non_finite_number",
      "finite_integer",
      "integer",
      "finite_rational",
      "rational",
      "finite_real",
      "real",
      "imaginary",
      "finite_complex",
      "complex",
      "finite_number",
      "number",
      "list",
      "record",
      "dictionary",
      "set",
      "tuple",
      "indexed_collection",
      "collection",
      "scalar",
      "value",
      "function",
      "expression",
    ],
    Zi = new Map();
  function Ts(e, t) {
    if (e === t) return e;
    if (e === "any" || t === "any") return "any";
    if (e === "never") return t;
    if (t === "never") return e;
    if (e === "unknown") return t;
    if (t === "unknown") return e;
    if (e === "nothing") return t;
    if (t === "nothing") return e;
    if (typeof e == "string" && typeof t == "string") {
      let i = e < t ? `${e}|${t}` : `${t}|${e}`,
        r = Zi.get(i);
      if (r === void 0) {
        r = "any";
        for (let n of ji) {
          let s = Ur[n];
          if (s.has(e) && s.has(t)) {
            r = n;
            break;
          }
        }
        Zi.set(i, r);
      }
      return r;
    }
    for (let i of ji) if (E(e, i) && E(t, i)) return i;
    return "any";
  }
  var en = 3,
    tn = 1,
    rn = 2,
    ks = 4,
    bs = 5,
    vs = 6,
    Ns = 7,
    Is = 8,
    Es = 9,
    Ss = 10,
    As = 11;
  function G(e, t = 0) {
    if (typeof e == "string") return e;
    let i = "";
    switch (e.kind) {
      case "value":
        typeof e.value == "string"
          ? (i = `"${e.value}"`)
          : typeof e.value == "boolean"
            ? (i = e.value ? "true" : "false")
            : (i = e.value.toString());
        break;
      case "reference":
        i = e.name;
        break;
      case "negation":
        i = `!${G(e.type, en)}`;
        break;
      case "union":
        i = e.types.map((a) => G(a, tn)).join(" | ");
        break;
      case "intersection":
        i = e.types.map((a) => G(a, rn)).join(" & ");
        break;
      case "expression":
        i = `expression<${Ui(e.operator)}>`;
        break;
      case "symbol":
        i = `symbol<${Ui(e.name)}>`;
        break;
      case "numeric":
        Number.isFinite(e.lower) && Number.isFinite(e.upper)
          ? (i = `${e.type}<${e.lower}..${e.upper}>`)
          : Number.isFinite(e.lower)
            ? (i = `${e.type}<${e.lower}..>`)
            : Number.isFinite(e.upper)
              ? (i = `${e.type}<..${e.upper}>`)
              : (i = `${e.type}`);
        break;
      case "list":
        if (
          e.dimensions &&
          typeof e.elements == "string" &&
          jr.has(e.elements)
        ) {
          if (e.dimensions === void 0)
            e.elements === "number" && (i = "tensor");
          else if (e.dimensions.length === 1)
            e.elements === "number"
              ? e.dimensions[0] < 0
                ? (i = "vector")
                : (i = `vector<${e.dimensions[0]}>`)
              : e.dimensions[0] < 0
                ? (i = `vector<${G(e.elements)}>`)
                : (i = `vector<${G(e.elements)}^${e.dimensions[0]}>`);
          else if (e.dimensions.length === 2) {
            let a = e.dimensions;
            e.elements === "number"
              ? a[0] < 0 && a[1] < 0
                ? (i = "matrix")
                : (i = `matrix<${a[0]}x${a[1]}>`)
              : a[0] < 0 && a[1] < 0
                ? (i = `matrix<${G(e.elements)}>`)
                : (i = `matrix<${G(e.elements)}^(${a[0]}x${a[1]})>`);
          }
        }
        if (!i) {
          let a = e.dimensions
            ? e.dimensions.length === 1
              ? `^${e.dimensions[0].toString()}`
              : `^(${e.dimensions.join("x")})`
            : "";
          i = `list<${G(e.elements)}${a}>`;
        }
        break;
      case "record":
        i = `record<${Object.entries(e.elements)
          .map(([a, l]) => `${a}: ${G(l)}`)
          .join(", ")}>`;
        break;
      case "dictionary":
        i = `dictionary<${G(e.values)}>`;
        break;
      case "set":
        i = `set<${G(e.elements)}>`;
        break;
      case "collection":
        i = `collection<${G(e.elements)}>`;
        break;
      case "indexed_collection":
        i = `indexed_collection<${G(e.elements)}>`;
        break;
      case "tuple":
        if (e.elements.length === 0) i = "tuple";
        else if (e.elements.length === 1) {
          let [a] = e.elements;
          i = `tuple<${we(a)}>`;
        } else i = "tuple<" + e.elements.map((a) => we(a)).join(", ") + ">";
        break;
      case "signature":
        let r = e.args ? e.args.map((a) => we(a)).join(", ") : "",
          n = e.optArgs ? e.optArgs.map((a) => we(a) + "?").join(", ") : "",
          s = e.variadicArg
            ? e.variadicMin === 0
              ? `${we(e.variadicArg)}*`
              : `${we(e.variadicArg)}+`
            : "";
        i = `(${[r, n, s].filter((a) => a).join(", ")}) -> ${G(e.result)}`;
        break;
      default:
        i = "error";
    }
    return t > 0 && t > ws(e.kind) ? `(${i})` : i;
  }
  function we(e) {
    return e.name ? `${e.name}: ${G(e.type)}` : G(e.type);
  }
  function Ui(e) {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(e) ? e : `\`${e}\``;
  }
  function ws(e) {
    switch (e) {
      case "negation":
        return en;
      case "union":
        return tn;
      case "intersection":
        return rn;
      case "list":
        return ks;
      case "record":
        return bs;
      case "dictionary":
        return vs;
      case "set":
        return Ns;
      case "collection":
      case "indexed_collection":
        return Is;
      case "tuple":
        return Es;
      case "signature":
        return Ss;
      case "value":
        return As;
      default:
        return 0;
    }
  }
  var be = class C {
      static unknown = new C("unknown");
      static number = new C("number");
      static non_finite_number = new C("non_finite_number");
      static finite_number = new C("finite_number");
      static finite_integer = new C("finite_integer");
      static finite_real = new C("finite_real");
      static string = new C("string");
      static dictionary = new C("dictionary");
      static setNumber = new C("set<number>");
      static setComplex = new C("set<complex>");
      static setImaginary = new C("set<imaginary>");
      static setReal = new C("set<real>");
      static setRational = new C("set<rational>");
      static setFiniteInteger = new C("set<finite_integer>");
      static setInteger = new C("set<integer>");
      type;
      static widen(...t) {
        return new C(Xr(...t.map((i) => (i instanceof C ? i.type : i))));
      }
      static narrow(...t) {
        return new C(ys(...t.map((i) => (i instanceof C ? i.type : i))));
      }
      constructor(t, i) {
        typeof t == "string" ? (this.type = ni(t, i)) : (this.type = t);
      }
      matches(t) {
        return t instanceof C ? E(this.type, t.type) : E(this.type, t);
      }
      is(t) {
        return E(this.type, t) && E(t, this.type);
      }
      get isUnknown() {
        return this.type === "unknown";
      }
      toString() {
        return G(this.type);
      }
      toJSON() {
        return G(this.type);
      }
      [Symbol.toPrimitive](t) {
        return t === "string" ? this.toString() : null;
      }
      valueOf() {
        return G(this.type);
      }
    },
    $s = [
      { name: "True", kind: "symbol", latexTrigger: ["\\top"] },
      { kind: "symbol", latexTrigger: "\\mathrm{True}", parse: "True" },
      { kind: "symbol", latexTrigger: "\\operatorname{True}", parse: "True" },
      { kind: "symbol", latexTrigger: "\\mathsf{T}", parse: "True" },
      { name: "False", kind: "symbol", latexTrigger: ["\\bot"] },
      { kind: "symbol", latexTrigger: "\\operatorname{False}", parse: "False" },
      { kind: "symbol", latexTrigger: "\\mathsf{F}", parse: "False" },
      { name: "And", kind: "infix", latexTrigger: ["\\land"], precedence: 235 },
      {
        kind: "infix",
        latexTrigger: ["\\wedge"],
        parse: "And",
        precedence: 235,
      },
      { kind: "infix", latexTrigger: "\\&", parse: "And", precedence: 235 },
      {
        kind: "infix",
        latexTrigger: "\\operatorname{and}",
        parse: "And",
        precedence: 235,
      },
      { name: "Or", kind: "infix", latexTrigger: ["\\lor"], precedence: 230 },
      { kind: "infix", latexTrigger: ["\\vee"], parse: "Or", precedence: 230 },
      {
        kind: "infix",
        latexTrigger: "\\parallel",
        parse: "Or",
        precedence: 230,
      },
      {
        kind: "infix",
        latexTrigger: "\\operatorname{or}",
        parse: "Or",
        precedence: 230,
      },
      {
        name: "Xor",
        kind: "infix",
        latexTrigger: ["\\veebar"],
        precedence: 232,
      },
      {
        name: "Not",
        kind: "prefix",
        latexTrigger: ["\\lnot"],
        precedence: 880,
      },
      {
        kind: "prefix",
        latexTrigger: ["\\neg"],
        parse: "Not",
        precedence: 880,
      },
      {
        name: "Nand",
        kind: "infix",
        latexTrigger: ["\\barwedge"],
        precedence: 232,
      },
      { name: "Nor", kind: "infix", latexTrigger: ["\u22BD"], precedence: 232 },
      { kind: "function", symbolTrigger: "and", parse: "And" },
      { kind: "function", symbolTrigger: "or", parse: "Or" },
      { kind: "function", symbolTrigger: "not", parse: "Not" },
      {
        name: "Implies",
        kind: "infix",
        precedence: 220,
        associativity: "right",
        latexTrigger: ["\\implies"],
        serialize: "\\implies",
      },
      {
        latexTrigger: ["\\Rightarrow"],
        kind: "infix",
        precedence: 220,
        associativity: "right",
        parse: "Implies",
      },
      {
        latexTrigger: ["\\rightarrow"],
        kind: "infix",
        precedence: 220,
        associativity: "right",
        parse: "Implies",
      },
      {
        latexTrigger: ["\\Longrightarrow"],
        kind: "infix",
        precedence: 220,
        associativity: "right",
        parse: "Implies",
      },
      {
        latexTrigger: ["\\longrightarrow"],
        kind: "infix",
        precedence: 220,
        associativity: "right",
        parse: "Implies",
      },
      {
        latexTrigger: ["=", ">"],
        kind: "infix",
        precedence: 220,
        associativity: "right",
        parse: (e, t, i) => {
          if (e.options.strict !== !1) return null;
          let r = e.parseExpression({ ...i, minPrec: 220 });
          return r === null ? null : ["Implies", t, r];
        },
      },
      {
        name: "Equivalent",
        latexTrigger: ["\\iff"],
        kind: "infix",
        associativity: "right",
        precedence: 219,
      },
      {
        latexTrigger: ["\\Leftrightarrow"],
        kind: "infix",
        associativity: "right",
        precedence: 219,
        parse: "Equivalent",
      },
      {
        latexTrigger: ["\\leftrightarrow"],
        kind: "infix",
        associativity: "right",
        precedence: 219,
        parse: "Equivalent",
      },
      {
        latexTrigger: ["\\Longleftrightarrow"],
        kind: "infix",
        associativity: "right",
        precedence: 219,
        parse: "Equivalent",
      },
      {
        latexTrigger: ["\\longleftrightarrow"],
        kind: "infix",
        associativity: "right",
        precedence: 219,
        parse: "Equivalent",
      },
      {
        latexTrigger: ["<", "=", ">"],
        kind: "infix",
        precedence: 219,
        associativity: "right",
        parse: (e, t, i) => {
          if (e.options.strict !== !1) return null;
          let r = e.parseExpression({ ...i, minPrec: 219 });
          return r === null ? null : ["Equivalent", t, r];
        },
      },
      {
        latexTrigger: ["\\equiv"],
        kind: "infix",
        associativity: "right",
        precedence: 219,
        parse: (e, t, i) => {
          let r = e.parseExpression({ ...i, minPrec: 219 }),
            n = e.index,
            s = e.parseExpression({ ...i, minPrec: 219 });
          return s !== null && f(s) === "Mod"
            ? ["Congruent", t, r, F(c(s, 1))]
            : ((e.index = n), ["Equivalent", t, F(r)]);
        },
      },
      {
        name: "Proves",
        kind: "infix",
        latexTrigger: ["\\vdash"],
        precedence: 220,
        associativity: "right",
        serialize: "\\vdash",
      },
      {
        name: "Entails",
        kind: "infix",
        latexTrigger: ["\\vDash"],
        precedence: 220,
        associativity: "right",
        serialize: "\\vDash",
      },
      {
        name: "Satisfies",
        kind: "infix",
        latexTrigger: ["\\models"],
        precedence: 220,
        associativity: "right",
        serialize: "\\models",
      },
      {
        name: "ForAll",
        kind: "prefix",
        latexTrigger: ["\\forall"],
        precedence: 200,
        serialize: Ge("\\forall"),
        parse: Te("ForAll"),
      },
      {
        name: "Exists",
        kind: "prefix",
        latexTrigger: ["\\exists"],
        precedence: 200,
        serialize: Ge("\\exists"),
        parse: Te("Exists"),
      },
      {
        name: "ExistsUnique",
        kind: "prefix",
        latexTrigger: ["\\exists", "!"],
        precedence: 200,
        serialize: Ge("\\exists!"),
        parse: Te("ExistsUnique"),
      },
      {
        name: "NotForAll",
        kind: "prefix",
        latexTrigger: ["\\lnot", "\\forall"],
        precedence: 200,
        serialize: Ge("\\lnot\\forall"),
        parse: Te("NotForAll"),
      },
      {
        name: "NotExists",
        kind: "prefix",
        latexTrigger: ["\\lnot", "\\exists"],
        precedence: 200,
        serialize: Ge("\\lnot\\exists"),
        parse: Te("NotExists"),
      },
      {
        name: "KroneckerDelta",
        kind: "prefix",
        latexTrigger: ["\\delta", "_"],
        precedence: 200,
        serialize: (e, t) => {
          let i = T(t);
          return i.length === 0
            ? "\\delta"
            : i.every((r) => k(r))
              ? `\\delta_{${i.map((r) => e.serialize(r)).join("")}}`
              : `\\delta_{${i.map((r) => e.serialize(r)).join(", ")}}`;
        },
        parse: (e) => {
          let t = e.parseGroup();
          if (t === null) {
            let r = e.parseToken();
            return r ? ["KroneckerDelta", r] : null;
          }
          let i = St(t);
          return i && i.length <= 2
            ? ["KroneckerDelta", ...i]
            : f(t) === "InvisibleOperator"
              ? ["KroneckerDelta", ...T(t)]
              : t !== null
                ? ["KroneckerDelta", t]
                : null;
        },
      },
      {
        name: "Boole",
        kind: "matchfix",
        openTrigger: "[",
        closeTrigger: "]",
        parse: (e, t) => {
          let i = f(t);
          return !i || !ri.some((r) => r.name === i) ? null : ["Boole", t];
        },
      },
      {
        kind: "matchfix",
        openTrigger: "\\llbracket",
        closeTrigger: "\\rrbracket",
        parse: (e, t) => {
          let i = f(t);
          return !i || !ri.some((r) => r.name === i) ? null : ["Boole", t];
        },
      },
      {
        name: "Predicate",
        serialize: (e, t) => {
          let i = T(t);
          if (i.length === 0) return "";
          let r = i[0],
            n = typeof r == "string" ? r : e.serialize(r);
          if (i.length === 1) return n;
          let s = i.slice(1).map((a) => e.serialize(a));
          return `${n}(${s.join(", ")})`;
        },
      },
    ];
  function Ge(e) {
    return (t, i) => {
      let r = T(i);
      if (r.length === 0) return e;
      if (r.length === 1) return `${e} ${t.serialize(r[0])}`;
      let n = t.serialize(r[0]),
        s = t.serialize(r[1]);
      return `${e} ${n}, ${s}`;
    };
  }
  function Yi(e, t) {
    return (
      e.peek === "\\to" ||
      e.peek === "\\rightarrow" ||
      e.peek === "\\implies" ||
      e.peek === "\\Rightarrow" ||
      e.peek === "\\iff" ||
      e.peek === "\\Leftrightarrow" ||
      e.peek === "\\land" ||
      e.peek === "\\wedge" ||
      e.peek === "\\lor" ||
      e.peek === "\\vee" ||
      (t?.condition?.(e) ?? !1)
    );
  }
  function Te(e) {
    return (t, i) => {
      let r = t.index,
        n = t.options.quantifierScope !== "loose",
        s = t.parseSymbol(i);
      if (s) {
        if (
          (t.skipSpace(),
          t.match(",") ||
            t.match("\\mid") ||
            t.match(".") ||
            t.match(":") ||
            t.match("\\colon"))
        ) {
          let u = n ? { ...i, condition: (g) => Yi(g, i) } : i;
          t.enterQuantifierScope();
          let p = t.parseExpression(u);
          return (t.exitQuantifierScope(), [e, s, F(p)]);
        }
        t.enterQuantifierScope();
        let o = t.parseEnclosure();
        if ((t.exitQuantifierScope(), o)) return [e, s, F(o)];
      }
      t.index = r;
      let a = {
          ...i,
          condition: (o) =>
            o.peek === ":" || o.peek === "\\colon" || (i?.condition?.(o) ?? !1),
        },
        l = t.parseExpression(a);
      if (l === null) return null;
      if ((t.skipSpace(), t.matchAny([",", "\\mid", ":", "\\colon"]))) {
        let o = n ? { ...i, condition: (p) => Yi(p, i) } : i;
        t.enterQuantifierScope();
        let u = t.parseExpression(o);
        return (t.exitQuantifierScope(), [e, l, F(u)]);
      }
      if (t.match("(")) {
        t.enterQuantifierScope();
        let o = t.parseExpression(i);
        return (t.exitQuantifierScope(), t.match(")") ? [e, l, F(o)] : null);
      }
      return null;
    };
  }
  var zs = {
    x: "First",
    y: "Second",
    z: "Third",
    real: "Real",
    re: "Real",
    imag: "Imaginary",
    im: "Imaginary",
    count: "Length",
    total: "Sum",
    max: "Max",
    min: "Min",
  };
  function Lt(e) {
    return zs[e] ?? null;
  }
  function _s(e, t) {
    if ((e.skipVisualSpace(), e.match("\\operatorname"))) {
      let r = e.parseStringGroup();
      if (r === null) return null;
      let n = Lt(r.trim());
      return n === null ? null : [n, t];
    }
    let i = e.peek;
    if (typeof i == "string" && i.startsWith("\\")) {
      let r = i.slice(1),
        n = Lt(r);
      return n !== null ? (e.nextToken(), [n, t]) : null;
    }
    if (typeof i == "string" && /^[a-zA-Z]$/.test(i)) {
      let r = k(t);
      if (r !== null && e.getSymbolType(r).matches("dictionary")) {
        let s = "";
        for (; typeof e.peek == "string" && /^[a-zA-Z]$/.test(e.peek);)
          s += e.nextToken();
        return ["At", t, { str: s }];
      }
      let n = Lt(i);
      return n === null ? null : (e.nextToken(), [n, t]);
    }
    return null;
  }
  function Hi(e, t, i) {
    (e.addBoundary(i), e.skipVisualSpace());
    let r = e.parseExpression({ minPrec: 0 });
    return r === null || (e.skipVisualSpace(), !e.matchBoundary())
      ? (e.removeBoundary(), null)
      : ["When", t, r];
  }
  function Gt(e, t, i, r, n) {
    if (t && t.minPrec >= r) return null;
    let s = i ? [i] : ["Nothing"],
      a = !1;
    for (; !a;) {
      for (a = !0, e.skipSpace(); e.match(n);)
        (s.push("Nothing"), e.skipSpace());
      if ((e.skipVisualSpace(), e.atTerminator(t))) s.push("Nothing");
      else {
        let l = e.parseExpression({ ...t, minPrec: r });
        (s.push(l ?? "Nothing"), (a = l === null));
      }
      a || (e.skipSpace(), (a = !e.match(n)), a || e.skipVisualSpace());
    }
    return s;
  }
  function le(e = "") {
    return (t, i) => {
      if (!i) return "";
      let r = T(i);
      if (r.length === 0) return "";
      if (r.length === 1) return t.serialize(r[0]);
      e =
        {
          "&": "\\&",
          ":": "\\colon",
          "|": "\\mvert",
          "-": "-",
          "\xB7": "\\cdot",
          "\u2012": "-",
          "\u2013": "--",
          "\u2014": "---",
          "\u2015": "-",
          "\u2022": "\\bullet",
          "\u2026": "\\ldots",
        }[e] ?? e;
      let n = r.reduce((s, a) => (s.push(t.serialize(a), e), s), []);
      return (n.pop(), y(n));
    };
  }
  var Ps = [
    {
      surface: "if",
      kind: "prefix",
      precedence: 245,
      operatorname: !0,
      build: Bs,
    },
    {
      surface: "for",
      kind: "prefix",
      precedence: 245,
      operatorname: !0,
      build: qs,
    },
    {
      surface: "for",
      kind: "infix",
      precedence: 19,
      associativity: "none",
      operatorname: !0,
      build: (e, t, i) => sn(e, t, i),
    },
    {
      surface: "break",
      kind: "prefix",
      precedence: 245,
      operatorname: !0,
      build: () => ["Break"],
    },
    {
      surface: "continue",
      kind: "prefix",
      precedence: 245,
      operatorname: !0,
      build: () => ["Continue"],
    },
    {
      surface: "return",
      kind: "prefix",
      precedence: 245,
      operatorname: !0,
      build: (e, t) => ["Return", e.parseExpression(t) ?? "Nothing"],
    },
    {
      surface: "for all",
      kind: "prefix",
      precedence: 200,
      build: (e, t) => Te("ForAll")(e, t),
    },
    {
      surface: "there exists",
      kind: "prefix",
      precedence: 200,
      build: (e, t) => Te("Exists")(e, t),
    },
    {
      surface: "where",
      kind: "infix",
      precedence: 21,
      associativity: "none",
      operatorname: !0,
      build: (e, t, i) => Ls(e, t, i),
    },
    {
      surface: "such that",
      kind: "infix",
      precedence: 21,
      associativity: "right",
      build: (e, t, i) => [
        "Colon",
        t,
        e.parseExpression({ ...i, minPrec: 21 }) ?? "Nothing",
      ],
    },
    {
      surface: "and",
      kind: "infix",
      precedence: 235,
      associativity: "right",
      build: (e, t, i) => [
        "And",
        t,
        e.parseExpression({ ...i, minPrec: 235 }) ?? "Nothing",
      ],
    },
    {
      surface: "or",
      kind: "infix",
      precedence: 230,
      associativity: "right",
      build: (e, t, i) => [
        "Or",
        t,
        e.parseExpression({ ...i, minPrec: 230 }) ?? "Nothing",
      ],
    },
    {
      surface: "iff",
      kind: "infix",
      precedence: 219,
      associativity: "right",
      build: (e, t, i) => [
        "Equivalent",
        t,
        e.parseExpression({ ...i, minPrec: 219 }) ?? "Nothing",
      ],
    },
    {
      surface: "if and only if",
      kind: "infix",
      precedence: 219,
      associativity: "right",
      build: (e, t, i) => [
        "Equivalent",
        t,
        e.parseExpression({ ...i, minPrec: 219 }) ?? "Nothing",
      ],
    },
  ];
  function Fs() {
    let e = [];
    for (let t of Ps) {
      let i = t.surface;
      for (let r of ["\\text", "\\keyword"])
        if (t.kind === "prefix") {
          let n = t.build;
          e.push({
            latexTrigger: [r],
            kind: "prefix",
            precedence: t.precedence,
            parse: (s, a) => {
              let l = s.index;
              return ai(s, i) ? n(s, a) : ((s.index = l), null);
            },
          });
        } else {
          let n = t.build;
          e.push({
            latexTrigger: [r],
            kind: "infix",
            associativity: t.associativity ?? "right",
            precedence: t.precedence,
            parse: (s, a, l) => {
              let o = s.index;
              return ai(s, i) ? n(s, a, l) : ((s.index = o), null);
            },
          });
        }
      if (t.operatorname)
        if (t.kind === "prefix") {
          let r = t.build;
          e.push({
            symbolTrigger: i,
            kind: "prefix",
            precedence: t.precedence,
            parse: (n, s) => r(n, s),
          });
        } else {
          let r = t.build;
          e.push({
            symbolTrigger: i,
            kind: "infix",
            associativity: t.associativity ?? "right",
            precedence: t.precedence,
            parse: (n, s, a) => r(n, s, a),
          });
        }
    }
    return (e.push({ latexTrigger: ["\\keyword"], parse: (t) => J(t) }), e);
  }
  function Q(e, t, i) {
    let r = e.options.keywordStyle ?? "text";
    if (r === "keyword") return `\\keyword{${t}}`;
    if (r === "operatorname") return `\\operatorname{${t}}`;
    let n = i?.lead ? " " : "",
      s = i?.trail ? " " : "";
    return `\\text{${n}${t}${s}}`;
  }
  var Ms = [
    {
      latexTrigger: ["\\placeholder"],
      kind: "symbol",
      parse: (e) => {
        for (; e.match("<space>"););
        if (e.match("[")) for (; !e.match("]") && !e.atBoundary;) e.nextToken();
        for (; e.match("<space>"););
        if (e.match("<{>"))
          for (; !e.match("<}>") && !e.atBoundary;) e.nextToken();
        return "Nothing";
      },
    },
    { name: "ContinuationPlaceholder", latexTrigger: ["\\dots"] },
    { latexTrigger: ["\\ldots"], parse: "ContinuationPlaceholder" },
    { latexTrigger: [".", ".", "."], parse: "ContinuationPlaceholder" },
    {
      name: "Function",
      latexTrigger: ["\\mapsto"],
      kind: "infix",
      precedence: ye,
      parse: (e, t, i) => {
        let r = [];
        if (
          (f(t) === "Delimiter" && (t = c(t, 1) ?? "Nothing"),
          f(t) === "Sequence")
        )
          for (let s of T(t)) {
            if (!k(s)) return null;
            r.push(k(s));
          }
        else {
          if (!k(t)) return null;
          r = [k(t)];
        }
        let n = e.parseExpression({ minPrec: ye }) ?? "Nothing";
        return (
          f(n) === "Delimiter" && (n = c(n, 1) ?? "Nothing"),
          f(n) === "Sequence" && (n = ["Block", ...T(n)]),
          ["Function", n, ...r]
        );
      },
      serialize: (e, t) => {
        let i = T(t);
        return i.length < 1
          ? "()\\mapsto()"
          : i.length === 1
            ? y(["()", "\\mapsto", e.serialize(c(t, 1))])
            : i.length === 2
              ? y([e.serialize(c(t, 2)), "\\mapsto", e.serialize(c(t, 1))])
              : y([
                  e.wrapString(
                    T(t)
                      ?.slice(1)
                      .map((r) => e.serialize(r))
                      .join(", "),
                    "normal",
                  ),
                  "\\mapsto",
                  e.serialize(c(t, 1)),
                ]);
      },
    },
    {
      name: "Apply",
      kind: "function",
      symbolTrigger: "apply",
      serialize: (e, t) => {
        let i = c(t, 1),
          r = f(i);
        if (r === "InverseFunction" || r === "Derivative") {
          let a = e.options.applyFunctionStyle(t, e.level),
            l = T(t).slice(1);
          return (
            e.serializeFunction(i, e.dictionary.ids.get(r)) +
            e.wrapString(l.map((o) => e.serialize(o)).join(", "), a)
          );
        }
        let n = c(t, 2);
        if (typeof i == "string" || !n) {
          let a = T(t).slice(1);
          return e.serialize(a);
        }
        if (B(t) === 2) return y([e.wrap(i, 20), "\\lhd", e.wrap(n, 20)]);
        let s = e.options.applyFunctionStyle(t, e.level);
        return y([
          "\\operatorname{apply}",
          e.wrapString(
            e.serialize(r) + ", " + e.serialize(["List", ...T(t)]),
            s,
          ),
        ]);
      },
    },
    { latexTrigger: "\\lhd", kind: "infix", precedence: 20, parse: "Apply" },
    {
      latexTrigger: "\\rhd",
      kind: "infix",
      precedence: 20,
      parse: (e, t, i) => [
        "Apply",
        e.parseExpression({ minPrec: 21 }) ?? "Nothing",
        t,
      ],
    },
    {
      name: "EvaluateAt",
      openTrigger: ".",
      closeTrigger: "|",
      kind: "matchfix",
      serialize: (e, t) => {
        let i = c(t, 1);
        if (!i) return "";
        let r = T(t).slice(1);
        if (f(i) === "Function") {
          let n = T(i).slice(1),
            s = c(i, 1);
          if ((f(s) === "Block" && B(s) === 1 && (s = c(s, 1)), n.length > 0))
            return `\\left.\\left(${e.serialize(s)}\\right)\\right|_{${n.map((a, l) => `${e.serialize(a)}=${e.serialize(r[l])}`).join(", ")}}`;
        }
        return `\\left.\\left(${e.serialize(i)}\\right)\\right|_{${r.map((n) => e.serialize(n)).join(", ")}}`;
      },
    },
    {
      name: "Assign",
      latexTrigger: "\\coloneq",
      kind: "infix",
      associativity: "right",
      precedence: lt,
      serialize: (e, t) => {
        let i = Oi(c(t, 1));
        if (f(c(t, 2)) === "Function") {
          let r = c(t, 2),
            n = Oi(c(r, 1)),
            s = T(r).slice(1);
          return y([
            e.serialize(i),
            e.wrapString(
              s.map((a) => e.serialize(a)).join(", "),
              e.options.applyFunctionStyle(t, e.level),
            ),
            "\\coloneq",
            e.serialize(n),
          ]);
        }
        return y([e.serialize(i), "\\coloneq", e.serialize(c(t, 2))]);
      },
      parse: pt,
    },
    {
      latexTrigger: "\\coloneqq",
      kind: "infix",
      associativity: "right",
      precedence: lt,
      parse: pt,
    },
    {
      latexTrigger: "\\colonequals",
      kind: "infix",
      associativity: "right",
      precedence: lt,
      parse: pt,
    },
    {
      latexTrigger: [":", "="],
      kind: "infix",
      associativity: "right",
      precedence: lt,
      parse: pt,
    },
    {
      name: "Colon",
      latexTrigger: ":",
      kind: "infix",
      associativity: "right",
      precedence: 240,
      serialize: (e, t) =>
        y([e.serialize(c(t, 1)), "\\colon", e.serialize(c(t, 2))]),
    },
    {
      latexTrigger: "\\colon",
      kind: "infix",
      associativity: "right",
      precedence: 240,
      parse: "Colon",
    },
    {
      name: "BaseForm",
      serialize: (e, t) => {
        let i = S(c(t, 2)) ?? NaN;
        if (isFinite(i) && i >= 2 && i <= 36) {
          let r = S(c(t, 1)) ?? NaN;
          if (isFinite(r) && Number.isInteger(r)) {
            let n = Number(r).toString(i),
              s = 0;
            if (
              (i === 2 || i === 10
                ? (s = 4)
                : i === 16
                  ? (s = 2)
                  : i > 16 && (s = 4),
              s > 0)
            ) {
              let a = n;
              n = "";
              for (let l = 0; l < a.length; l++)
                (l > 0 && l % s === 0 && (n = "\\, " + n),
                  (n = a[a.length - l - 1] + n));
            }
            return `(\\text{${n}}_{${i}}`;
          }
        }
        return (
          "\\operatorname{BaseForm}(" +
          e.serialize(c(t, 1)) +
          ", " +
          e.serialize(c(t, 2)) +
          ")"
        );
      },
    },
    { name: "Sequence", serialize: le(" ") },
    { name: "InvisibleOperator", serialize: le("") },
    {
      name: "Delimiter",
      serialize: (e, t) => {
        let i = e.options.groupStyle(t, e.level + 1),
          r = c(t, 1),
          n = {
            Set: "{,}",
            List: "[,]",
            Tuple: "(,)",
            Single: "(,)",
            Pair: "(,)",
            Triple: "(,)",
            Sequence: "(,)",
            String: '""',
          }[f(r)],
          s = n ? r : ["Sequence", r];
        if (((n ??= "(,)"), B(t) > 1)) {
          let p = P(c(t, 2));
          typeof p == "string" && p.length <= 3 && (n = p);
        }
        let [a, l, o] = ["", "", ""];
        n.length === 3
          ? ([a, l, o] = n)
          : n.length === 2
            ? ([a, o] = n)
            : n.length === 1 && (l = n);
        let u = r ? (s ? le(l)(e, s) : e.serialize(r)) : "";
        return e.wrapString(u, i, a + o);
      },
    },
    { name: "Tuple", serialize: (e, t) => y(["(", le(",")(e, t), ")"]) },
    { name: "Pair", serialize: (e, t) => y(["(", le(",")(e, t), ")"]) },
    { name: "Triple", serialize: (e, t) => y(["(", le(",")(e, t), ")"]) },
    { name: "Single", serialize: (e, t) => y(["(", le(",")(e, t), ")"]) },
    {
      name: "Domain",
      serialize: (e, t) =>
        f(t) === "Error" ? e.serialize(t) : `\\mathbf{${e.serialize(c(t, 1))}}`,
    },
    {
      latexTrigger: ["\\mathtip"],
      parse: (e) => {
        let t = e.parseGroup();
        return (e.parseGroup(), t);
      },
    },
    {
      latexTrigger: ["\\texttip"],
      parse: (e) => {
        let t = e.parseGroup();
        return (e.parseGroup(), t);
      },
    },
    { latexTrigger: ["\\error"], parse: (e) => ["Error", e.parseGroup()] },
    {
      name: "Error",
      serialize: (e, t) => {
        let i = c(t, 1);
        if (P(i) === "missing")
          return `\\error{${e.options.missingSymbol ?? "\\placeholder{}"}}`;
        let r = Ds(e, t) || "\\blacksquare",
          n = f(i) === "ErrorCode" ? P(c(i, 1)) : P(i);
        return n === "incompatible-type"
          ? k(c(i, 3)) === "Undefined"
            ? `\\mathtip{\\error{${r}}}{\\notin ${e.serialize(c(i, 2))}}`
            : `\\mathtip{\\error{${r}}}{\\in ${e.serialize(c(i, 3))}\\notin ${e.serialize(c(i, 2))}}`
          : typeof n == "string"
            ? `\\error{${r}}`
            : `\\error{${r}}`;
      },
    },
    {
      name: "ErrorCode",
      serialize: (e, t) => {
        let i = P(c(t, 1));
        return i === "missing"
          ? (e.options.missingSymbol ?? "\\placeholder{}")
          : i === "unexpected-command" ||
              i === "unexpected-operator" ||
              i === "unexpected-token" ||
              i === "invalid-symbol" ||
              i === "unknown-environment" ||
              i === "unexpected-base" ||
              i === "incompatible-type"
            ? ""
            : `\\texttip{\\error{\\blacksquare}}{\\mathtt{${i}}}`;
      },
    },
    { name: "FromLatex", serialize: (e, t) => `\\texttt{${Wi(P(c(t, 1)))}}` },
    {
      name: "Latex",
      serialize: (e, t) =>
        t === null ? "" : y(ei(t, (i) => P(i) ?? e.serialize(i))),
    },
    {
      name: "LatexString",
      serialize: (e, t) => (t === null ? "" : y(ei(t, (i) => e.serialize(i)))),
    },
    { name: "LatexTokens", serialize: Os },
    { kind: "postfix", precedence: 850, latexTrigger: ["."], parse: _s },
    {
      name: "At",
      kind: "postfix",
      precedence: 810,
      latexTrigger: ["["],
      parse: jt("]"),
      serialize: (e, t) => {
        let i = T(t),
          r = e.serialize(i[0] ?? "Nothing"),
          n = i.slice(1).map((s) => e.serialize(s));
        return e.indexStyle(t, e.level) === "bracket"
          ? y([r, "[", n.join(", "), "]"])
          : De("_", r, n.join(","));
      },
    },
    {
      kind: "postfix",
      precedence: 810,
      latexTrigger: ["\\lbrack"],
      parse: jt("\\rbrack"),
    },
    {
      kind: "postfix",
      precedence: 810,
      latexTrigger: ["\\left", "\\lbrack"],
      parse: jt("\\right", "\\rbrack"),
    },
    {
      name: "When",
      kind: "postfix",
      precedence: 800,
      latexTrigger: ["\\left", "\\{"],
      parse: (e, t) => Hi(e, t, ["\\right", "\\}"]),
      serialize: (e, t) => {
        let i = c(t, 1),
          r = c(t, 2);
        if (!i || !r) return "";
        let n = (f(r) === "And" ? (T(r) ?? []) : [r])
          .map((s) => `\\left\\{${e.serialize(s)}\\right\\}`)
          .join("");
        return `${e.serialize(i)}${n}`;
      },
    },
    {
      kind: "postfix",
      precedence: 800,
      latexTrigger: ["\\{"],
      parse: (e, t) => Hi(e, t, ["\\}"]),
    },
    {
      kind: "postfix",
      latexTrigger: ["_"],
      parse: (e, t, i) => {
        let r = e.parseGroup() ?? e.parseToken();
        r === null &&
          e.options.strict === !1 &&
          e.peek === "(" &&
          (r = e.parseEnclosure());
        let n = k(t);
        return r !== null &&
          ((n && e.getSymbolType(n).matches("indexed_collection")) ||
            f(t) === "List")
          ? (f(r) === "Delimiter" && (r = c(r, 1) ?? "Nothing"),
            f(r) === "Sequence" ? ["At", t, ...T(r)] : ["At", t, r])
          : ["Subscript", t, r];
      },
    },
    {
      name: "List",
      kind: "matchfix",
      openTrigger: "[",
      closeTrigger: "]",
      parse: nn,
      serialize: Cs,
    },
    { kind: "matchfix", openTrigger: "(", closeTrigger: ")", parse: Rs },
    {
      latexTrigger: [","],
      kind: "infix",
      precedence: 20,
      parse: (e, t, i) => {
        let r = Gt(e, i, t, 20, ",");
        return r === null
          ? null
          : ["Delimiter", ["Sequence", ...r], { str: "," }];
      },
    },
    {
      latexTrigger: [","],
      kind: "prefix",
      precedence: 20,
      parse: (e, t) => {
        let i = Gt(e, t, null, 20, ",");
        return i === null
          ? null
          : ["Delimiter", ["Sequence", ...i], { str: "," }];
      },
    },
    {
      name: "Range",
      latexTrigger: [".", "."],
      kind: "infix",
      precedence: 800,
      parse: ct,
      serialize: (e, t) => {
        let i = T(t);
        if (i.length === 0) return "";
        if (i.length === 1) return "1.." + e.serialize(c(t, 1));
        if (i.length === 2)
          return e.wrap(c(t, 1), 10) + ".." + e.wrap(c(t, 2), 10);
        if (i.length === 3) {
          let r = S(c(t, 3)),
            n = S(c(t, 1));
          return r !== null && n !== null
            ? e.wrap(c(t, 1), 10) +
                ".." +
                e.wrap(n + r, 10) +
                ".." +
                e.wrap(c(t, 2), 10)
            : e.wrap(c(t, 1), 10) +
                "..(" +
                (e.wrap(c(t, 1), V) + "+" + e.wrap(c(t, 3), V)) +
                ").." +
                e.wrap(c(t, 2), 10);
        }
        return "";
      },
    },
    {
      latexTrigger: [".", ".", "."],
      kind: "infix",
      precedence: 800,
      parse: ct,
    },
    { latexTrigger: ["\\ldots"], kind: "infix", precedence: 800, parse: ct },
    { latexTrigger: ["\\dots"], kind: "infix", precedence: 800, parse: ct },
    {
      latexTrigger: [";"],
      kind: "infix",
      precedence: 19,
      parse: (e, t, i) => {
        let r = Gt(e, i, t, 19, ";");
        return r === null
          ? null
          : r.some((n) => f(n) === "Assign")
            ? Gs(r)
            : ["Delimiter", ["Sequence", ...r], "';'"];
      },
    },
    ...Fs(),
    {
      name: "Block",
      serialize: (e, t) => {
        let i = T(t);
        return !i || i.length === 0
          ? ""
          : i
              .filter((r) => f(r) !== "Declare")
              .map((r) => e.serialize(r))
              .join("; ");
      },
    },
    {
      name: "If",
      serialize: (e, t) => {
        let i = T(t);
        return !i || i.length < 3
          ? ""
          : y([
              Q(e, "if", { trail: !0 }),
              e.serialize(i[0]),
              Q(e, "then", { lead: !0, trail: !0 }),
              e.serialize(i[1]),
              Q(e, "else", { lead: !0, trail: !0 }),
              e.serialize(i[2]),
            ]);
      },
    },
    {
      name: "Loop",
      serialize: (e, t) => {
        let i = T(t);
        if (!i || i.length < 2) return "";
        let r = i[0],
          n = i.slice(1);
        if (!n.every((a) => f(a) === "Element"))
          return y([
            "\\operatorname{Loop}(",
            e.serialize(r),
            ", ",
            e.serialize(n[0]),
            ")",
          ]);
        if (n.length === 1) {
          let a = n[0],
            l = c(a, 1),
            o = c(a, 2);
          if (f(o) === "Range") {
            let u = c(o, 1),
              p = c(o, 2);
            return y([
              Q(e, "for", { trail: !0 }),
              e.serialize(l),
              Q(e, "from", { lead: !0, trail: !0 }),
              e.serialize(u),
              Q(e, "to", { lead: !0, trail: !0 }),
              e.serialize(p),
              Q(e, "do", { lead: !0, trail: !0 }),
              e.serialize(r),
            ]);
          }
          return y([
            e.serialize(r),
            " \\operatorname{for} ",
            e.serialize(l),
            " = ",
            e.serialize(o),
          ]);
        }
        let s = n
          .map((a) => {
            let l = c(a, 1),
              o = c(a, 2);
            return y([e.serialize(l), " = ", e.serialize(o)]);
          })
          .join(", ");
        return y([e.serialize(r), " \\operatorname{for} ", s]);
      },
    },
    { name: "Break", serialize: (e) => Q(e, "break") },
    { name: "Continue", serialize: (e) => Q(e, "continue") },
    {
      name: "Return",
      serialize: (e, t) => {
        let i = c(t, 1);
        return !i || k(i) === "Nothing"
          ? Q(e, "return")
          : y([Q(e, "return", { trail: !0 }), e.serialize(i)]);
      },
    },
    {
      name: "Text",
      serialize: (e, t) => {
        let i = T(t);
        if (i.length === 0) return "";
        let r = -1,
          n = -1;
        for (let l = 0; l < i.length; l++)
          P(i[l]) !== null && (r < 0 && (r = l), (n = l));
        if (r < 0) return y(i.map((l) => e.serialize(l)));
        let s = [];
        for (let l = 0; l < r; l++) s.push(e.serialize(i[l]));
        let a = "";
        for (let l = r; l <= n; l++) {
          let o = P(i[l]);
          o !== null
            ? (a += Wi(o))
            : f(i[l]) === "Annotated" || f(i[l]) === "Text"
              ? (a += e.serialize(i[l]))
              : (a += "$" + e.serialize(i[l]) + "$");
        }
        s.push("\\text{" + a + "}");
        for (let l = n + 1; l < i.length; l++) s.push(e.serialize(i[l]));
        return y(s);
      },
    },
    {
      name: "String",
      latexTrigger: ["\\text"],
      parse: (e) => J(e),
      serialize: (e, t) => {
        let i = T(t);
        return i.length === 0
          ? "\\text{}"
          : y(["\\text{", i.map((r) => e.serialize(r)).join(""), "}"]);
      },
    },
    {
      name: "Subscript",
      latexTrigger: ["_"],
      kind: "infix",
      serialize: (e, t) =>
        B(t) === 2
          ? e.serialize(c(t, 1)) + "_{" + e.serialize(c(t, 2)) + "}"
          : "_{" + e.serialize(c(t, 1)) + "}",
    },
    { name: "Superplus", latexTrigger: ["^", "+"], kind: "postfix" },
    { name: "Subplus", latexTrigger: ["_", "+"], kind: "postfix" },
    {
      name: "Superminus",
      latexTrigger: ["^", "-"],
      kind: "postfix",
      parse: (e, t) =>
        e.options.strict === !1 && /^[0-9]$/.test(e.peek)
          ? null
          : ["Superminus", t],
    },
    { name: "Subminus", latexTrigger: ["_", "-"], kind: "postfix" },
    {
      latexTrigger: ["^", "*"],
      kind: "postfix",
      parse: (e, t) => ["Superstar", t],
    },
    {
      latexTrigger: ["_", "*"],
      kind: "postfix",
      parse: (e, t) => ["Substar", t],
    },
    { name: "Substar", latexTrigger: ["_", "\\star"], kind: "postfix" },
    { name: "Superdagger", latexTrigger: ["^", "\\dagger"], kind: "postfix" },
    {
      latexTrigger: ["^", "\\dag"],
      kind: "postfix",
      parse: (e, t) => ["Superdagger", t],
    },
    {
      name: "Prime",
      latexTrigger: ["^", "\\prime"],
      kind: "postfix",
      parse: (e, t) => ne(e, t, 1),
      serialize: (e, t) => {
        let i = S(c(t, 2)) ?? 1,
          r = e.serialize(c(t, 1));
        return i === 1
          ? r + "^\\prime"
          : i === 2
            ? r + "^\\doubleprime"
            : i === 3
              ? r + "^\\tripleprime"
              : r + "^{(" + e.serialize(c(t, 2)) + ")}";
      },
    },
    {
      latexTrigger: "^{\\prime\\prime}",
      kind: "postfix",
      parse: (e, t) => ne(e, t, 2),
    },
    {
      latexTrigger: "^{\\prime\\prime\\prime}",
      kind: "postfix",
      parse: (e, t) => ne(e, t, 3),
    },
    {
      latexTrigger: ["^", "\\doubleprime"],
      kind: "postfix",
      parse: (e, t) => ne(e, t, 2),
    },
    {
      latexTrigger: ["^", "\\tripleprime"],
      kind: "postfix",
      parse: (e, t) => ne(e, t, 3),
    },
    {
      latexTrigger: "'",
      kind: "postfix",
      precedence: 810,
      parse: (e, t) => ne(e, t, 1),
    },
    {
      latexTrigger: "\\prime",
      kind: "postfix",
      precedence: 810,
      parse: (e, t) => ne(e, t, 1),
    },
    {
      latexTrigger: "\\doubleprime",
      kind: "postfix",
      precedence: 810,
      parse: (e, t) => ne(e, t, 2),
    },
    {
      latexTrigger: "\\tripleprime",
      kind: "postfix",
      precedence: 810,
      parse: (e, t) => ne(e, t, 3),
    },
    {
      latexTrigger: ["^", "<{>", "("],
      kind: "postfix",
      parse: (e, t, i) => {
        let r = k(t);
        if (!r || !e.getSymbolType(r).matches("function")) return null;
        e.addBoundary([")"]);
        let n = e.parseExpression(i);
        return e.matchBoundary()
          ? e.match("<}>")
            ? ["Derivative", t, n]
            : null
          : (e.removeBoundary(), null);
      },
    },
    {
      name: "InverseFunction",
      latexTrigger: "^{-1",
      kind: "postfix",
      parse: (e, t) => {
        if (f(t) === "Matrix") return (e.match("<}>"), ["Inverse", t]);
        let i = k(t);
        if (!i) return null;
        let r = e.getSymbolType(i);
        if (r.matches(new be("matrix")))
          return (e.match("<}>"), ["Inverse", t]);
        if (!r.matches("function")) return null;
        let n = 0;
        for (; !e.atEnd && !e.match("<}>");)
          if (e.match("'")) n++;
          else if (e.match("\\prime")) n++;
          else if (e.match("\\doubleprime")) n += 2;
          else if (e.match("\\tripleprime")) n += 3;
          else return null;
        return n === 1
          ? ["Derivative", ["InverseFunction", t]]
          : n > 0
            ? ["Derivative", ["InverseFunction", t], n]
            : ["InverseFunction", t];
      },
      serialize: (e, t) => e.serialize(c(t, 1)) + "^{-1}",
    },
    {
      name: "Derivative",
      serialize: (e, t) => {
        let i = S(c(t, 2)) ?? 1,
          r = e.serialize(c(t, 1));
        return i === 1
          ? r + "^{\\prime}"
          : i === 2
            ? r + "^{\\doubleprime}"
            : i === 3
              ? r + "^{\\tripleprime}"
              : r + "^{(" + e.serialize(c(t, 2)) + ")}";
      },
    },
    {
      name: "D",
      serialize: (e, t) => {
        if (f(t) !== "D") return "D";
        let i = c(t, 1),
          r = c(t, 2);
        if (!i || !r) return "D";
        let n = 1,
          s = i;
        for (; f(s) === "D";) {
          let u = c(s, 2);
          if (k(u) === k(r)) (n++, (s = c(s, 1)));
          else break;
        }
        let a = s;
        f(s) === "Function" && (a = c(s, 1) ?? s);
        let l = e.serialize(a),
          o = e.serialize(r);
        return n === 1
          ? `\\frac{\\mathrm{d}}{\\mathrm{d}${o}}${l}`
          : `\\frac{\\mathrm{d}^{${n}}}{\\mathrm{d}${o}^{${n}}}${l}`;
      },
    },
    {
      name: "NewtonDerivative1",
      latexTrigger: ["\\dot"],
      kind: "prefix",
      precedence: 740,
      parse: (e) => {
        let t = e.parseGroup();
        if (t === null) return null;
        let i = e.options.timeDerivativeVariable;
        return ["D", t, i];
      },
    },
    {
      name: "NewtonDerivative2",
      latexTrigger: ["\\ddot"],
      kind: "prefix",
      precedence: 740,
      parse: (e) => {
        let t = e.parseGroup();
        if (t === null) return null;
        let i = e.options.timeDerivativeVariable;
        return ["D", ["D", t, i], i];
      },
    },
    {
      name: "NewtonDerivative3",
      latexTrigger: ["\\dddot"],
      kind: "prefix",
      precedence: 740,
      parse: (e) => {
        let t = e.parseGroup();
        if (t === null) return null;
        let i = e.options.timeDerivativeVariable;
        return ["D", ["D", ["D", t, i], i], i];
      },
    },
    {
      name: "NewtonDerivative4",
      latexTrigger: ["\\ddddot"],
      kind: "prefix",
      precedence: 740,
      parse: (e) => {
        let t = e.parseGroup();
        if (t === null) return null;
        let i = e.options.timeDerivativeVariable;
        return ["D", ["D", ["D", ["D", t, i], i], i], i];
      },
    },
    {
      name: "EulerDerivative",
      latexTrigger: ["D"],
      kind: "expression",
      parse: (e) => {
        let t = 1,
          i = null,
          r = !1;
        for (; !r;)
          if (e.match("_")) {
            if (((i = e.parseGroup() ?? e.parseToken()), !i)) return null;
          } else if (e.match("^")) {
            let a = e.parseGroup() ?? e.parseToken();
            t = S(a) ?? 1;
          } else r = !0;
        if (!i || k(i) === null) return null;
        e.skipSpace();
        let n = e.parseExpression({ minPrec: 740 });
        if (!n) return null;
        let s = n;
        for (let a = 0; a < t; a++) s = ["D", s, i];
        return s;
      },
    },
    {
      kind: "environment",
      name: "Which",
      symbolTrigger: "cases",
      parse: Vt,
      serialize: (e, t) => {
        let i = [],
          r = T(t);
        if (r.length > 0)
          for (let n = 0; n <= r.length - 2; n += 2) {
            let s = [];
            (s.push(e.serialize(r[n + 1])),
              s.push(e.serialize(r[n])),
              i.push(s.join("&")));
          }
        return y(["\\begin{cases}", i.join("\\\\"), "\\end{cases}"]);
      },
    },
    { kind: "environment", symbolTrigger: "dcases", parse: Vt },
    { kind: "environment", symbolTrigger: "rcases", parse: Vt },
  ];
  function J(e, t) {
    if (!e.match("<{>")) return "''";
    let i = [],
      r = "",
      n = null,
      s = () => {
        (n !== null && r
          ? i.push(["Annotated", `'${r}'`, qt(n)])
          : r && i.push(`'${r}'`),
          (r = ""),
          (n = null));
      };
    for (; !e.atEnd && !e.match("<}>");)
      if (e.peek === "<{>") (s(), i.push(J(e)));
      else if (e.match("\\textbf")) (s(), i.push(J(e, { fontWeight: "bold" })));
      else if (e.match("\\textmd"))
        (s(), i.push(J(e, { fontStyle: "normal" })));
      else if (e.match("\\textup"))
        (s(), i.push(J(e, { fontStyle: "normal" })));
      else if (e.match("\\textsl"))
        (s(), i.push(J(e, { fontStyle: "italic" })));
      else if (e.match("\\textit"))
        (s(), i.push(J(e, { fontStyle: "italic" })));
      else if (e.match("\\texttt"))
        (s(), i.push(J(e, { fontFamily: "monospace" })));
      else if (e.match("\\textsf"))
        (s(), i.push(J(e, { fontFamily: "sans-serif" })));
      else if (e.match("\\textcolor")) {
        let l = e.index,
          o = e.parseStringGroup();
        if (o !== null) {
          s();
          let u = J(e);
          i.push(["Annotated", u, qt({ color: o })]);
        } else ((e.index = l), (r += "\\textcolor"));
      } else if (e.match("\\color")) {
        let l = e.parseStringGroup();
        l !== null && (s(), (n = { color: l }));
      } else if (e.match("<space>")) r += " ";
      else if (e.match("<$>")) {
        let l = e.index,
          o = e.parseExpression() ?? "Nothing";
        (e.skipSpace(),
          e.match("<$>") ? (s(), i.push(o)) : ((r += "$"), (e.index = l)));
      } else if (e.match("<$$>")) {
        let l = e.index,
          o = e.parseExpression() ?? "Nothing";
        (e.skipSpace(),
          e.match("<$$>") ? (s(), i.push(o)) : ((r += "$$"), (e.index = l)));
      } else {
        let l = e.parseChar() ?? e.nextToken();
        r +=
          {
            "\\enskip": "\u2002",
            "\\enspace": "\u2002",
            "\\quad": "\u2003",
            "\\qquad": "\u2003\u2003",
            "\\space": "\u2003",
            "\\ ": "\u2003",
            "\\;": "\u2004",
            "\\,": "\u2009",
            "\\:": "\u205F",
            "\\!": "",
            "\\{": "{",
            "\\}": "}",
            "\\$": "$",
            "\\&": "&",
            "\\#": "#",
            "\\%": "%",
            "\\_": "_",
            "\\textbackslash": "\\",
            "\\textasciitilde": "~",
            "\\textasciicircum": "^",
            "\\textless": "<",
            "\\textgreater": ">",
            "\\textbar": "|",
            "\\textunderscore": "_",
            "\\textbraceleft": "{",
            "\\textbraceright": "}",
            "\\textasciigrave": "`",
            "\\textquotesingle": "'",
            "\\textquotedblleft": "\u201C",
            "\\textquotedblright": "\u201D",
            "\\textquotedbl": '"',
            "\\textquoteleft": "\u2018",
            "\\textquoteright": "\u2019",
            "\\textbullet": "\u2022",
            "\\textdagger": "\u2020",
            "\\textdaggerdbl": "\u2021",
            "\\textsection": "\xA7",
            "\\textparagraph": "\xB6",
            "\\textperiodcentered": "\xB7",
            "\\textellipsis": "\u2026",
            "\\textemdash": "\u2014",
            "\\textendash": "\u2013",
            "\\textregistered": "\xAE",
            "\\texttrademark": "\u2122",
            "\\textdegree": "\xB0",
          }[l] ?? l;
      }
    s();
    let a;
    return (
      i.length === 1
        ? (a = i[0])
        : i.every((l) => P(l) !== null)
          ? (a = "'" + i.map((l) => P(l)).join("") + "'")
          : (a = ["Text", ...i]),
      t ? ["Annotated", a, qt(t)] : a
    );
  }
  function Os(e, t) {
    return t === null
      ? ""
      : y(
          ei(t, (i) => {
            let r = P(i);
            return r === null
              ? e.serialize(i)
              : r === "<{>"
                ? "{"
                : r === "<}>"
                  ? "}"
                  : r === "<$>"
                    ? "$"
                    : r === "<$$>"
                      ? "$$"
                      : r === "<space>"
                        ? " "
                        : r;
          }),
        );
  }
  function Wi(e) {
    return e === null
      ? ""
      : e.replace(
          /[{}\[\]\\:\-\$%]/g,
          (t) =>
            ({
              "{": "\\lbrace ",
              "}": "\\rbrace ",
              "[": "\\lbrack ",
              "]": "\\rbrack ",
              ":": "\\colon ",
              "\\": "\\backslash ",
            })[t] ?? "\\" + t,
        );
  }
  function Ds(e, t) {
    let i = c(t, 2);
    return i
      ? f(i) === "LatexString"
        ? (P(c(i, 1)) ?? "")
        : f(i) === "Hold"
          ? e.serialize(c(i, 1))
          : e.serialize(i)
      : "";
  }
  function ne(e, t, i) {
    for (; !e.atEnd;)
      if (e.match("'") || e.match("\\prime")) i++;
      else if (e.match("\\doubleprime")) i += 2;
      else if (e.match("\\tripleprime")) i += 3;
      else break;
    let r = f(t);
    if (r === "Derivative" || r === "Prime") {
      let l = S(c(t, 2)) ?? 1;
      return [r, F(c(t, 1)), l + i];
    }
    let n = k(t),
      s = (n && e.getSymbolType(n).matches("function")) || f(t);
    e.skipSpace();
    let a = e.parseArguments("enclosure");
    if (a && a.length > 0) {
      let l = a[0],
        o = k(l) ?? "x",
        u = typeof t == "string" ? [t, ...a] : ["Apply", t, ...a];
      for (let p = 0; p < i; p++) u = ["D", u, o];
      return u;
    }
    return s
      ? i === 1
        ? ["Derivative", t]
        : ["Derivative", t, i]
      : i === 1
        ? ["Prime", F(t)]
        : ["Prime", F(t), i];
  }
  function Rs(e, t) {
    if (M(t)) return ["Delimiter"];
    let i = f(t);
    if (i === "Delimiter" && c(t, 2) !== null) {
      let r = P(c(t, 2));
      if (r?.length === 1)
        return ["Delimiter", c(t, 1) ?? "Nothing", { str: `(${r})` }];
    }
    return i === "Matrix" && (P(c(t, 2)) ?? "..") === ".."
      ? ["Matrix", c(t, 1)]
      : ["Delimiter", t];
  }
  function nn(e, t) {
    if (M(t)) return ["List"];
    let i = f(t);
    if (i === "Range" || i === "Linspace") return t;
    if (i === "Sequence") {
      let r = T(t);
      return Ki(r, e) || ["List", ...r];
    }
    if (i === "Delimiter") {
      let r = P(c(t, 2)) ?? "...";
      if (r === ";" || r === ".;.")
        return ["List", ...(T(c(t, 1)) ?? []).map((n) => nn(e, n))];
      if (r === "," || r === ".,.") {
        if (((t = c(t, 1)), f(t) === "Sequence")) {
          let n = T(t);
          return Ki(n, e) || ["List", ...n];
        }
        return ["List", t ?? "Nothing"];
      }
    }
    return ["List", t];
  }
  function Ki(e, t) {
    if (e.length < 4) return null;
    let i = e[e.length - 2];
    if (k(i) !== "ContinuationPlaceholder") return null;
    let r = e.slice(0, -2),
      n = e[e.length - 1];
    if (r.length < 2) return null;
    let s = r.map(S);
    if (s.some((u) => u === null)) return null;
    let a = s,
      l = a[a.length - 1] - a[a.length - 2],
      o = t.options.tolerance;
    if (Math.abs(l) < o) return t.error("degenerate-range-step", t.index);
    for (let u = 1; u < a.length; u++)
      if (Math.abs(a[u] - a[u - 1] - l) > o)
        return t.error("inconsistent-range-samples", t.index);
    return ["Range", a[0], n, l];
  }
  function Cs(e, t) {
    return B(t) > 1 &&
      T(t).every((i) => {
        let r = f(i);
        return Br(r) || Cr(r);
      })
      ? y(["\\begin{cases}", le("\\\\")(e, t), "\\end{cases}"])
      : y(["\\bigl\\lbrack", le(", ")(e, t), "\\bigr\\rbrack"]);
  }
  function ct(e, t) {
    if (t === null) return null;
    let i = e.parseExpression({ minPrec: 270 });
    if (i === null) return null;
    if (f(i) === "Range") {
      let r = c(i, 1),
        n = c(i, 2);
      return r && n ? ["Range", t, n, ["Subtract", r, t]] : null;
    }
    return ["Range", t, i];
  }
  var kt = {
    "(": "(",
    ")": ")",
    "[": "\\lbrack",
    "]": "\\rbrack",
    "\u27E6": "\\llbrack",
    "\u27E7": "\\rrbrack",
    "{": "\\lbrace",
    "}": "\\rbrace",
    "<": "\\langle",
    ">": "\\rangle",
    "\u2016": "\\Vert",
    "\\": "\\backslash",
    "\u2308": "\\lceil",
    "\u2309": "\\rceil",
    "\u230A": "\\lfloor",
    "\u230B": "\\rfloor",
    "\u231C": "\\ulcorner",
    "\u231D": "\\urcorner",
    "\u231E": "\\llcorner",
    "\u231F": "\\lrcorner",
    "\u23B0": "\\lmoustache",
    "\u23B1": "\\rmoustache",
  };
  function pt(e, t, i) {
    let r = (i?.minPrec ?? 0) >= 19,
      n = k(t);
    if (n && n.includes("_")) {
      let l = n.indexOf("_"),
        o = n.substring(0, l),
        u = n.substring(l + 1),
        p = parseInt(u, 10),
        g = !isNaN(p) && String(p) === u ? p : u,
        d =
          g !== "" &&
          (typeof g == "number" || (typeof g == "string" && g.length === 1));
      (e.getSymbolType(o).matches("indexed_collection") || (!r && d)) &&
        (t = ["Subscript", o, g]);
    }
    if (
      f(t) === "InvisibleOperator" &&
      B(t) === 2 &&
      f(c(t, 2)) === "Delimiter"
    ) {
      let l = k(c(t, 1));
      if (!l) return null;
      let o = e.parseExpression({ ...(i ?? {}), minPrec: 20 });
      if (o === null) return null;
      let u = c(c(t, 2), 1),
        p = [];
      return (
        f(u) === "Sequence" ? (p = [...T(u)]) : u && (p = [u]),
        ["Assign", l, ["Function", o, ...(p ?? [])]]
      );
    }
    if (f(t) === "Subscript" && k(c(t, 1))) {
      let l = k(c(t, 1));
      if (!e.getSymbolType(l).matches("indexed_collection")) {
        let p = c(t, 2),
          g =
            (p !== null && typeof p == "string" ? p : void 0) ??
            (p !== null && typeof p == "number" ? String(p) : void 0);
        if (g && r) {
          let d = e.parseExpression({ ...(i ?? {}), minPrec: 20 });
          return d === null ? null : ["Assign", l + "_" + g, d];
        }
      }
      let o = e.parseExpression({ ...(i ?? {}), minPrec: 20 });
      if (o === null) return null;
      let u = c(t, 2);
      return P(u) !== null
        ? ["Assign", t, o]
        : k(u)
          ? ["Assign", t, o]
          : ["Assign", t, o];
    }
    let s = f(t);
    if (s) {
      let l = T(t),
        o = e.parseExpression({ ...(i ?? {}), minPrec: 20 });
      return o === null ? null : ["Assign", s, ["Function", o, ...l]];
    }
    if (!k(t)) return null;
    let a = e.parseExpression({ ...(i ?? {}), minPrec: 20 });
    return a === null ? null : ["Assign", t, a];
  }
  function Vt(e) {
    let t = e.parseTabular();
    if (!t) return ["List"];
    if (
      t.every((r) => {
        if (r.length !== 1) return !1;
        let n = f(r[0]);
        return Cr(n) || Br(n);
      })
    )
      return ["List", ...t.map((r) => r[0])];
    let i = [];
    for (let r of t)
      if (r.length === 1) (i.push("True"), i.push(r[0]));
      else if (r.length === 2) {
        let n = P(r[1]);
        (i.push(n ? "True" : (Pr(r[1]) ?? "True")), i.push(r[0]));
      }
    return ["Which", ...i];
  }
  function ai(e, t) {
    let i = e.index;
    if (!e.match("<{>")) return ((e.index = i), !1);
    for (; e.match("<space>"););
    for (let r = 0; r < t.length; r++)
      if (t[r] === " ") {
        if (!e.match("<space>")) return ((e.index = i), !1);
        for (; e.match("<space>"););
      } else {
        if (e.peek !== t[r]) return ((e.index = i), !1);
        e.nextToken();
      }
    for (; e.match("<space>"););
    return e.match("<}>") ? !0 : ((e.index = i), !1);
  }
  function ve(e, t) {
    let i = e.index;
    if ((e.skipVisualSpace(), e.match("\\text") || e.match("\\keyword"))) {
      if (ai(e, t)) return !0;
      e.index = i;
    }
    let r = e.index,
      n = e.parseSymbol();
    return n !== null && k(n) === t ? !0 : ((e.index = r), !1);
  }
  function Ne(e, t) {
    let i = e.index,
      r = ve(e, t);
    return ((e.index = i), r);
  }
  function Bs(e, t) {
    e.skipVisualSpace();
    let i = e.parseExpression({ minPrec: 0, condition: (s) => Ne(s, "then") });
    if (i === null || !ve(e, "then")) return null;
    e.skipVisualSpace();
    let r = e.parseExpression({ minPrec: 0, condition: (s) => Ne(s, "else") });
    if (r === null || !ve(e, "else")) return null;
    e.skipVisualSpace();
    let n = e.parseExpression(t) ?? "Nothing";
    return ["If", i, r, n];
  }
  function qs(e, t) {
    let i = e.parseExpression({ minPrec: 0, condition: (a) => Ne(a, "from") }),
      r = i ? k(i) : null;
    if (!r || !ve(e, "from")) return null;
    let n = e.parseExpression({ minPrec: 0, condition: (a) => Ne(a, "to") });
    if (n === null || !ve(e, "to")) return null;
    let s = e.parseExpression({ minPrec: 0, condition: (a) => Ne(a, "do") });
    return s === null || !ve(e, "do")
      ? null
      : [
          "Loop",
          e.parseExpression(t) ?? "Nothing",
          ["Element", r, ["Range", n, s]],
        ];
  }
  function sn(e, t, i) {
    let r = {
        minPrec: 21,
        condition: (s) => {
          if (i?.condition?.(s)) return !0;
          let a = s.index;
          s.skipVisualSpace();
          let l = s.peek === ",";
          return ((s.index = a), !!(l || Ne(s, "where") || Ne(s, "with")));
        },
      },
      n = [];
    do {
      e.skipVisualSpace();
      let s = e.parseExpression(r);
      if (s === null) break;
      let a = f(s);
      if (a !== "Equal" && a !== "Assign") return null;
      let l = c(s, 1),
        o = c(s, 2);
      if (!l || !o) return null;
      (n.push(["Element", l, o]), e.skipVisualSpace());
    } while (e.match(","));
    return n.length === 0 ? null : ["Loop", t, ...n];
  }
  function Ls(e, t, i) {
    let r = {
        minPrec: 21,
        condition: (l) => {
          if (i?.condition?.(l)) return !0;
          let o = l.index;
          l.skipVisualSpace();
          let u = l.peek === ",";
          return ((l.index = o), u);
        },
      },
      n = [];
    do {
      e.skipVisualSpace();
      let l = e.parseExpression(r);
      if (!l) break;
      (n.push(l), e.skipVisualSpace());
    } while (e.match(","));
    if (n.length === 0) return null;
    let s = e.index;
    if (ve(e, "for")) {
      let l = sn(e, t, i);
      if (l) {
        let o = [];
        for (let u of n) {
          let p = li(u);
          (f(p) === "Assign" && o.push(["Declare", c(p, 1)]), o.push(p));
        }
        return (o.push(l), ["Block", ...o]);
      }
      e.index = s;
    }
    let a = [];
    for (let l of n) {
      let o = li(l);
      (f(o) === "Assign" && a.push(["Declare", c(o, 1)]), a.push(o));
    }
    return (a.push(t), ["Block", ...a]);
  }
  function Gs(e) {
    let t = [];
    for (let i of e) {
      let r = li(i);
      (f(r) === "Assign" && t.push(["Declare", c(r, 1)]), t.push(r));
    }
    return ["Block", ...t];
  }
  function li(e) {
    if (f(e) !== "Assign") return e;
    let t = c(e, 1);
    if (f(t) !== "Subscript") return e;
    let i = k(c(t, 1));
    if (!i) return e;
    let r = c(t, 2),
      n =
        (typeof r == "string" ? r : void 0) ??
        (typeof r == "number" ? String(r) : void 0);
    return n ? ["Assign", `${i}_${n}`, c(e, 2) ?? "Nothing"] : e;
  }
  function jt(...e) {
    return (t, i) => {
      if (!k(i) && f(i) !== "List") return null;
      let r = null;
      return (
        e.length === 0 && (r = t.parseGroup()),
        (r ??= t.parseExpression({ minPrec: 0 })),
        r === null ||
        (e.length > 0 && !t.matchAll(e)) ||
        (e.length === 0 && P(r) !== null)
          ? null
          : (f(r) === "Delimiter" && (r = c(r, 1) ?? "Nothing"),
            f(r) === "Sequence" ? ["At", i, ...T(r)] : ["At", i, r])
      );
    };
  }
  var Re = [
      ["alpha", "\\alpha", 945],
      ["beta", "\\beta", 946],
      ["gamma", "\\gamma", 947],
      ["delta", "\\delta", 948],
      ["epsilon", "\\epsilon", 949],
      ["epsilonSymbol", "\\varepsilon", 1013],
      ["zeta", "\\zeta", 950],
      ["eta", "\\eta", 951],
      ["theta", "\\theta", 952],
      ["thetaSymbol", "\\vartheta", 977],
      ["iota", "\\iota", 953],
      ["kappa", "\\kappa", 954],
      ["kappaSymbol", "\\varkappa", 1008],
      ["lambda", "\\lambda", 955],
      ["mu", "\\mu", 956],
      ["nu", "\\nu", 957],
      ["xi", "\\xi", 958],
      ["omicron", "\\omicron", 959],
      ["pi", "\\pi", 960],
      ["piSymbol", "\\varpi", 982],
      ["rho", "\\rho", 961],
      ["rhoSymbol", "\\varrho", 1009],
      ["sigma", "\\sigma", 963],
      ["finalSigma", "\\varsigma", 962],
      ["tau", "\\tau", 964],
      ["phi", "\\phi", 981],
      ["phiLetter", "\\varphi", 966],
      ["upsilon", "\\upsilon", 965],
      ["chi", "\\chi", 967],
      ["psi", "\\psi", 968],
      ["omega", "\\omega", 969],
      ["Alpha", "\\Alpha", 913],
      ["Beta", "\\Beta", 914],
      ["Gamma", "\\Gamma", 915],
      ["Delta", "\\Delta", 916],
      ["Epsilon", "\\Epsilon", 917],
      ["Zeta", "\\Zeta", 918],
      ["Eta", "\\Eta", 919],
      ["Theta", "\\Theta", 920],
      ["Iota", "\\Iota", 921],
      ["Kappa", "\\Kappa", 922],
      ["Lambda", "\\Lambda", 923],
      ["Mu", "\\Mu", 924],
      ["Nu", "\\Nu", 925],
      ["Xi", "\\Xi", 926],
      ["Omicron", "\\Omicron", 927],
      ["Rho", "\\Rho", 929],
      ["Sigma", "\\Sigma", 931],
      ["Tau", "\\Tau", 932],
      ["Phi", "\\Phi", 934],
      ["Upsilon", "\\Upsilon", 933],
      ["Chi", "\\Chi", 935],
      ["Psi", "\\Psi", 936],
      ["Omega", "\\Omega", 937],
      ["digamma", "\\digamma", 989],
      ["aleph", "\\aleph", 8501],
      ["bet", "\\beth", 8502],
      ["gimel", "\\gimel", 8503],
      ["dalet", "\\daleth", 8504],
      ["ell", "\\ell", 8499],
      ["turnedCapitalF", "\\Finv", 8498],
      ["turnedCapitalG", "\\Game", 8513],
      ["weierstrass", "\\wp", 8472],
      ["eth", "\\eth", 240],
      ["invertedOhm", "\\mho", 8487],
      ["hBar", "\\hbar", 295],
      ["hSlash", "\\hslash", 8463],
      ["blackClubSuit", "\\clubsuit", 9827],
      ["whiteHeartSuit", "\\heartsuit", 9825],
      ["blackSpadeSuit", "\\spadesuit", 9824],
      ["whiteDiamondSuit", "\\diamondsuit", 9826],
      ["sharp", "\\sharp", 9839],
      ["flat", "\\flat", 9837],
      ["natural", "\\natural", 9838],
    ],
    Vs = [
      ...Re.map(([e, t, i]) => ({
        kind: "symbol",
        name: e,
        latexTrigger: [t],
        parse: e,
      })),
      ...Re.map(([e, t, i]) => ({
        kind: "symbol",
        latexTrigger: [String.fromCodePoint(i)],
        parse: e,
      })),
    ],
    js = [
      { name: "To", latexTrigger: ["\\to"], kind: "infix", precedence: 270 },
      {
        latexTrigger: ["-", ">"],
        kind: "infix",
        precedence: 270,
        parse: (e, t, i) => {
          if (e.options.strict !== !1) return null;
          let r = e.parseExpression({ ...i, minPrec: 270 });
          return r === null ? null : ["To", t, r];
        },
      },
    ];
  function te(e, t, i) {
    if (M(e)) return null;
    let r,
      n = f(e);
    if (n === "Delimiter") {
      let l = P(c(e, 2));
      if (l !== "," && l !== "(,)" && l !== "[,]") return null;
      let o = c(e, 1);
      f(o) === "Sequence" ? (r = [...T(o)]) : (r = o ? [o] : []);
    } else if (n === "Sequence") r = [...T(e)];
    else return null;
    if (r.length !== 2) return null;
    let [s, a] = r;
    return ["Interval", t ? ["Open", s] : s, i ? ["Open", a] : a];
  }
  var Qi = new Set([
      "Less",
      "LessEqual",
      "Greater",
      "GreaterEqual",
      "Equal",
      "NotEqual",
      "And",
      "Or",
      "Not",
    ]),
    Zs = [
      { name: "AlgebraicNumbers", latexTrigger: "\\overline\\Q" },
      { latexTrigger: "\\bar\\Q", parse: "AlgebraicNumbers" },
      { name: "ComplexNumbers", latexTrigger: ["\\C"] },
      { latexTrigger: "\\mathbb{C}", parse: "ComplexNumbers" },
      { name: "UpperHalfPlane", latexTrigger: "\\mathbb{C}^+" },
      { latexTrigger: "\\mathbb{C}^{+}", parse: "UpperHalfPlane" },
      { latexTrigger: "\\C^+", parse: "UpperHalfPlane" },
      { latexTrigger: "\\C^{+}", parse: "UpperHalfPlane" },
      { name: "ImaginaryNumbers", latexTrigger: ["\\imaginaryI", "\\R"] },
      { name: "EmptySet", latexTrigger: ["\\emptyset"] },
      { latexTrigger: ["\\varnothing"], parse: "EmptySet" },
      { name: "Integers", latexTrigger: ["\\Z"] },
      { latexTrigger: "\\mathbb{Z}", parse: "Integers" },
      { name: "RationalNumbers", latexTrigger: ["\\Q"] },
      { latexTrigger: "\\mathbb{Q}", parse: "RationalNumbers" },
      { name: "RealNumbers", latexTrigger: ["\\R"] },
      { latexTrigger: "\\mathbb{R}", parse: "RealNumbers" },
      { name: "TranscendentalNumbers", latexTrigger: "\\R-\\bar\\Q" },
      {
        latexTrigger: "\\R\\backslash\\bar\\Q",
        parse: "TranscendentalNumbers",
      },
      { name: "NegativeNumbers", latexTrigger: "\\R_{<0}" },
      { latexTrigger: "\\R^-", parse: "NegativeNumbers" },
      { latexTrigger: "\\R^{-}", parse: "NegativeNumbers" },
      { latexTrigger: "\\R^-", parse: "NegativeNumbers" },
      { latexTrigger: "\\R_-", parse: "NegativeNumbers" },
      { latexTrigger: "\\R_{-}", parse: "NegativeNumbers" },
      { latexTrigger: "\\R^{\\lt}", parse: "NegativeNumbers" },
      { latexTrigger: "\\R^{<}", parse: "NegativeNumbers" },
      { latexTrigger: "\\R^{\\lt0}", parse: "NegativeNumbers" },
      { latexTrigger: "\\R^{<0}", parse: "NegativeNumbers" },
      { name: "NonPositiveNumbers", latexTrigger: "\\R_{\\le0}" },
      { latexTrigger: "\\R^{\\leq0}", parse: "NonPositiveNumbers" },
      { latexTrigger: "\\R^{-0}", parse: "NonPositiveNumbers" },
      { latexTrigger: "\\R^{\\leq}", parse: "NonPositiveNumbers" },
      { latexTrigger: "\\R^{0-}", parse: "NonPositiveNumbers" },
      { name: "PositiveNumbers", latexTrigger: "\\R_{>0}" },
      { latexTrigger: "\\R^+", parse: "PositiveNumbers" },
      { latexTrigger: "\\R^{+}", parse: "PositiveNumbers" },
      { latexTrigger: "\\R_+", parse: "PositiveNumbers" },
      { latexTrigger: "\\R_{+}", parse: "PositiveNumbers" },
      { latexTrigger: "\\R^{\\gt}", parse: "PositiveNumbers" },
      { latexTrigger: "\\R^{\\gt 0}", parse: "PositiveNumbers" },
      { latexTrigger: "\\R^{>}", parse: "PositiveNumbers" },
      { latexTrigger: "\\R^{>0}", parse: "PositiveNumbers" },
      { name: "NonNegativeNumbers", latexTrigger: "\\R_{\\geq0}" },
      { latexTrigger: "\\R^{0+}", parse: "NonNegativeNumbers" },
      { latexTrigger: "\\R^{\\geq}", parse: "NonNegativeNumbers" },
      { name: "ExtendedRealNumbers", latexTrigger: "\\overline\\R" },
      { latexTrigger: "\\bar\\R", parse: "ExtendedRealNumbers" },
      { name: "NegativeIntegers", latexTrigger: "\\Z_{<0}" },
      { latexTrigger: "\\Z_{\\lt0}", parse: "NegativeIntegers" },
      { latexTrigger: "\\Z^-", parse: "NegativeIntegers" },
      { latexTrigger: "\\Z^{-}", parse: "NegativeIntegers" },
      { latexTrigger: "\\Z_-", parse: "NegativeIntegers" },
      { latexTrigger: "\\Z_{-}", parse: "NegativeIntegers" },
      { latexTrigger: "\\Z^{\\lt}", parse: "NegativeIntegers" },
      { name: "NonPositiveIntegers", latexTrigger: "\\Z_{\\le0}" },
      { latexTrigger: "\\Z_{\\leq0}", parse: "NonPositiveIntegers" },
      { latexTrigger: "\\Z_{<0}", parse: "NonPositiveIntegers" },
      { name: "PositiveIntegers", latexTrigger: "\\N^*" },
      { latexTrigger: "\\Z_{>0}", parse: "PositiveIntegers" },
      { latexTrigger: "\\Z_{\\gt0}", parse: "PositiveIntegers" },
      { latexTrigger: "\\Z^{+}", parse: "PositiveIntegers" },
      { latexTrigger: "\\Z_+", parse: "PositiveIntegers" },
      { latexTrigger: "\\Z_{+}", parse: "PositiveIntegers" },
      { latexTrigger: "\\Z^{\\gt}", parse: "PositiveIntegers" },
      { latexTrigger: "\\Z^{\\gt0}", parse: "PositiveIntegers" },
      { latexTrigger: "\\N^+", parse: "PositiveIntegers" },
      { latexTrigger: "\\N^{+}", parse: "PositiveIntegers" },
      { latexTrigger: "\\N^*", parse: "PositiveIntegers" },
      { latexTrigger: "\\N^{*}", parse: "PositiveIntegers" },
      { latexTrigger: "\\N^\\star", parse: "PositiveIntegers" },
      { latexTrigger: "\\N^{\\star}", parse: "PositiveIntegers" },
      { latexTrigger: "\\N_1", parse: "PositiveIntegers" },
      { latexTrigger: "\\N_{1}", parse: "PositiveIntegers" },
      { name: "NonNegativeIntegers", latexTrigger: ["\\N"] },
      { latexTrigger: "\\Z^{+0}", parse: "NonNegativeIntegers" },
      { latexTrigger: "\\Z^{\\geq}", parse: "NonNegativeIntegers" },
      { latexTrigger: "\\Z^{\\geq0}", parse: "NonNegativeIntegers" },
      { latexTrigger: "\\Z^{0+}", parse: "NonNegativeIntegers" },
      { latexTrigger: "\\mathbb{N}", parse: "NonNegativeIntegers" },
      { latexTrigger: "\\N_0", parse: "NonNegativeIntegers" },
      { latexTrigger: "\\N_{0}", parse: "NonNegativeIntegers" },
      { name: "ExtendedIntegers", latexTrigger: "\\overline\\Z" },
      { latexTrigger: "\\bar\\Z", parse: "ExtendedIntegers" },
      { name: "ExtendedRationalNumbers", latexTrigger: "\\overline\\Q" },
      { latexTrigger: "\\bar\\Q", parse: "ExtendedRationalNumbers" },
      { name: "ExtendedComplexNumbers", latexTrigger: "\\overline\\C" },
      { latexTrigger: "\\bar\\C", parse: "ExtendedComplexNumbers" },
      {
        latexTrigger: ["^", "\\complement"],
        kind: "postfix",
        parse: (e, t) => ["Complement", t],
      },
      {
        name: "Complement",
        latexTrigger: ["^", "<{>", "\\complement", "<}>"],
        kind: "postfix",
        serialize: (e, t) => y([e.serialize(c(t, 1)), "^\\complement"]),
      },
      {
        name: "Intersection",
        latexTrigger: ["\\cap"],
        kind: "infix",
        precedence: 350,
      },
      { name: "Interval", serialize: Ji },
      {
        kind: "matchfix",
        openTrigger: ["["],
        closeTrigger: [")"],
        parse: (e, t) => te(t, !1, !0),
      },
      {
        kind: "matchfix",
        openTrigger: ["\\lbrack"],
        closeTrigger: ["\\rparen"],
        parse: (e, t) => te(t, !1, !0),
      },
      {
        kind: "matchfix",
        openTrigger: ["\\lbrack"],
        closeTrigger: [")"],
        parse: (e, t) => te(t, !1, !0),
      },
      {
        kind: "matchfix",
        openTrigger: ["["],
        closeTrigger: ["\\rparen"],
        parse: (e, t) => te(t, !1, !0),
      },
      {
        kind: "matchfix",
        openTrigger: ["("],
        closeTrigger: ["]"],
        parse: (e, t) => te(t, !0, !1),
      },
      {
        kind: "matchfix",
        openTrigger: ["\\lparen"],
        closeTrigger: ["\\rbrack"],
        parse: (e, t) => te(t, !0, !1),
      },
      {
        kind: "matchfix",
        openTrigger: ["\\lparen"],
        closeTrigger: ["]"],
        parse: (e, t) => te(t, !0, !1),
      },
      {
        kind: "matchfix",
        openTrigger: ["("],
        closeTrigger: ["\\rbrack"],
        parse: (e, t) => te(t, !0, !1),
      },
      {
        kind: "matchfix",
        openTrigger: ["]"],
        closeTrigger: ["["],
        parse: (e, t) => te(t, !0, !0),
      },
      {
        kind: "matchfix",
        openTrigger: ["\\rbrack"],
        closeTrigger: ["\\lbrack"],
        parse: (e, t) => te(t, !0, !0),
      },
      { name: "Multiple", serialize: Ji },
      {
        name: "Union",
        latexTrigger: ["\\cup"],
        kind: "infix",
        precedence: 350,
      },
      {
        name: "Divides",
        latexTrigger: ["\\mid"],
        kind: "infix",
        precedence: 160,
      },
      {
        name: "Set",
        kind: "matchfix",
        openTrigger: "{",
        closeTrigger: "}",
        parse: (e, t) => {
          if (M(t)) return "EmptySet";
          f(t) == "Delimiter" && P(c(t, 2)) === "," && (t = c(t, 1));
          let i = f(t);
          if (i === "Divides") {
            let r = c(t, 1),
              n = c(t, 2);
            if (r !== null && n !== null) return ["Set", r, ["Condition", n]];
          }
          if (i === "Colon") {
            let r = c(t, 1),
              n = c(t, 2);
            if (r !== null && n !== null) {
              let s = f(r);
              return s !== null && Qi.has(s)
                ? ["Which", r, n]
                : ["Set", r, ["Condition", n]];
            }
          }
          if (i === "Sequence") {
            let r = T(t),
              n = r.filter((s) => f(s) === "Colon");
            if (
              n.length > 0 &&
              n.every((s) => {
                let a = c(s, 1),
                  l = a !== null ? f(a) : null;
                return l !== null && Qi.has(l);
              })
            ) {
              let s = [];
              for (let a = 0; a < r.length; a++) {
                let l = r[a];
                if (f(l) === "Colon") {
                  let o = c(l, 1),
                    u = c(l, 2);
                  if (o === null || u === null) return ["Set", ...r];
                  s.push(o, u);
                } else {
                  if (a !== r.length - 1) return ["Set", ...r];
                  s.push("True", l);
                }
              }
              return ["Which", ...s];
            }
            return ["Set", ...r];
          }
          return ["Set", t];
        },
        serialize: (e, t) => {
          if (B(t) === 2 && f(c(t, 2)) === "Condition") {
            let i = c(t, 2);
            return y([
              "\\lbrace",
              e.serialize(c(t, 1)),
              "\\mid",
              e.serialize(c(i, 1)),
              "\\rbrace",
            ]);
          }
          return y([
            "\\lbrace",
            T(t)
              .map((i) => e.serialize(i))
              .join(", "),
            "\\rbrace",
          ]);
        },
      },
      {
        name: "SetMinus",
        latexTrigger: ["\\setminus"],
        kind: "infix",
        precedence: 650,
      },
      {
        name: "SymmetricDifference",
        latexTrigger: ["\\triangle"],
        kind: "infix",
        precedence: A,
      },
      {
        latexTrigger: ["\\ni"],
        kind: "infix",
        associativity: "none",
        precedence: 160,
        parse: (e, t, i) => {
          let r = e.parseExpression(i);
          return r === null ? null : ["Element", r, t];
        },
      },
      {
        name: "Element",
        latexTrigger: ["\\in"],
        kind: "infix",
        precedence: 240,
      },
      {
        name: "NotElement",
        latexTrigger: ["\\notin"],
        kind: "infix",
        precedence: 240,
      },
      {
        name: "NotSubset",
        latexTrigger: ["\\nsubset"],
        kind: "infix",
        associativity: "none",
        precedence: 240,
      },
      {
        name: "NotSuperset",
        latexTrigger: ["\\nsupset"],
        kind: "infix",
        associativity: "none",
        precedence: 240,
      },
      {
        name: "NotSubsetNotEqual",
        latexTrigger: ["\\nsubseteq"],
        kind: "infix",
        associativity: "none",
        precedence: 240,
      },
      {
        name: "NotSupersetNotEqual",
        latexTrigger: ["\\nsupseteq"],
        kind: "infix",
        associativity: "none",
        precedence: 240,
      },
      {
        name: "SquareSubset",
        latexTrigger: ["\\sqsubset"],
        kind: "infix",
        associativity: "none",
        precedence: 265,
      },
      {
        name: "SquareSubsetEqual",
        latexTrigger: ["\\sqsubseteq"],
        kind: "infix",
        associativity: "none",
        precedence: 265,
      },
      {
        name: "SquareSuperset",
        latexTrigger: ["\\sqsupset"],
        kind: "infix",
        associativity: "none",
        precedence: 265,
      },
      {
        name: "SquareSupersetEqual",
        latexTrigger: ["\\sqsupseteq"],
        kind: "infix",
        associativity: "none",
        precedence: 265,
      },
      {
        name: "Subset",
        latexTrigger: ["\\subset"],
        kind: "infix",
        associativity: "none",
        precedence: 240,
      },
      {
        latexTrigger: ["\\subsetneq"],
        kind: "infix",
        associativity: "none",
        precedence: 240,
        parse: "Subset",
      },
      {
        latexTrigger: ["\\varsubsetneqq"],
        kind: "infix",
        associativity: "none",
        precedence: 240,
        parse: "Subset",
      },
      {
        name: "SubsetEqual",
        latexTrigger: ["\\subseteq"],
        kind: "infix",
        associativity: "none",
        precedence: 240,
      },
      {
        name: "Superset",
        latexTrigger: ["\\supset"],
        kind: "infix",
        associativity: "none",
        precedence: 240,
      },
      {
        latexTrigger: ["\\supsetneq"],
        kind: "infix",
        associativity: "none",
        precedence: 240,
        parse: "Superset",
      },
      {
        latexTrigger: ["\\varsupsetneq"],
        kind: "infix",
        associativity: "none",
        precedence: 240,
        parse: "Superset",
      },
      {
        name: "SupersetEqual",
        latexTrigger: ["\\supseteq"],
        kind: "infix",
        associativity: "none",
        precedence: 240,
      },
    ];
  function Ji(e, t) {
    if (t === null) return "";
    let i = f(t);
    if (!i) return "";
    if (i === "Range")
      return y([
        "\\mathopen\\lbrack",
        e.serialize(c(t, 1)),
        ", ",
        e.serialize(c(t, 2)),
        "\\mathclose\\rbrack",
      ]);
    if (i === "Interval") {
      let n = c(t, 1),
        s = c(t, 2),
        a = !1,
        l = !1;
      return (
        f(n) === "Open" && ((n = c(n, 1)), (a = !0)),
        f(s) === "Open" && ((s = c(s, 1)), (l = !0)),
        y([
          a ? "\\lparen" : "\\lbrack",
          e.serialize(n),
          ", ",
          e.serialize(s),
          l ? "\\rparen" : "\\rbrack",
        ])
      );
    }
    let r = e.numericSetStyle(t, e.level);
    return "";
  }
  function Us(e, t) {
    return "normal";
  }
  function Ys(e, t) {
    return "normal";
  }
  function Hs(e, t) {
    return t > 2 ? "solidus" : "radical";
  }
  function Ws(e, t) {
    if (t > 3) return "inline-solidus";
    if (f(e) === "Divide") {
      let [i, r] = T(e),
        [n, s] = [tt(i), tt(r)];
      if (n > 5 && Ks(r)) return "inline-solidus";
      if (s <= 2 && n > 5) return "factor";
      let a = f(r);
      if (n <= 2 && s > 5 && a !== "Sqrt" && a !== "Root") return "reciprocal";
    }
    return "quotient";
  }
  function Ks(e) {
    if (e === null) return !1;
    let t = c(e, 1);
    if (t === null || tt(t) > 2) return !1;
    switch (f(e)) {
      case "Power": {
        let i = S(c(e, 2));
        return i !== null && Number.isInteger(i) && i >= 2;
      }
      case "Square":
      case "Sqrt":
        return !0;
      default:
        return !1;
    }
  }
  function Qs(e, t) {
    return "boolean";
  }
  function Js(e, t) {
    return "solidus";
  }
  function Xs(e, t) {
    return "compact";
  }
  function ea(e, t) {
    return "subscript";
  }
  function Fe(e, t, i) {
    e.indexOf("#1") < 0 && e.indexOf("#2") < 0 && (e = `#1 ${e} #2`);
    let r = e
      .split(/(#\d+)/)
      .filter((n) => n.trim() !== "")
      .map((n) => n.trim());
    return y(
      r.map((n) => {
        switch (n) {
          case "#1":
            return t;
          case "#2":
            return i;
          default:
            return n;
        }
      }),
    );
  }
  function an(e, t) {
    if (t === "none") return e;
    if (t === "0...360") {
      let i = e % 360;
      return (i < 0 ? i + 360 : i) || 0;
    }
    if (t === "-180...180") {
      let i = e % 360;
      return (i > 180 && (i -= 360), i < -180 && (i += 360), i || 0);
    }
    return e;
  }
  function ta(e) {
    let t = e < 0 ? -1 : 1,
      i = Math.abs(e),
      r = Math.floor(i),
      n = (i - r) * 60,
      s = Math.floor(n),
      a = (n - s) * 60,
      l = Math.round(a * 1e3) / 1e3,
      o = s,
      u = r;
    return (
      l >= 60 && ((l = 0), o++),
      o >= 60 && ((o = 0), u++),
      { deg: t * u || 0, min: t * o || 0, sec: l === 0 ? 0 : t * l }
    );
  }
  function ln(e) {
    let { deg: t, min: i, sec: r } = ta(e),
      n = `${t}\xB0`;
    if (Math.abs(r) > 0.001) {
      let s = r % 1 === 0 ? r.toString() : r.toFixed(2);
      n += `${Math.abs(i)}'${Math.abs(Number(s))}"`;
    } else Math.abs(i) > 0 ? (n += `${Math.abs(i)}'`) : (n += `0'0"`);
    return n;
  }
  function ia(e) {
    if (f(e) !== "Multiply") return [[], []];
    let t = [],
      i = [];
    for (let r of T(e))
      if (f(r) === "Power") {
        let n = c(r, 1),
          s = c(r, 2);
        if (f(s) === "Negate") {
          let a = c(s, 1);
          n && a && i.push(["Power", n, a]);
        } else {
          let a = S(s) ?? NaN;
          a === -1
            ? n && i.push(n)
            : a < 0
              ? n && i.push(["Power", n, -a])
              : t.push(r);
        }
      } else if ((f(r) === "Rational" && B(r) === 2) || f(r) === "Divide") {
        let n = c(r, 1),
          s = c(r, 2);
        (S(n) !== 1 && t.push(n), S(s) !== 1 && i.push(s));
      } else {
        let n = et(r);
        n !== null ? (n[0] !== 1 && t.push(n[0]), i.push(n[1])) : t.push(r);
      }
    return [t, i];
  }
  function ra(e) {
    let t = e.parseOptionalGroup(),
      i = e.parseGroup() ?? e.parseToken();
    if (M(i)) {
      let r = e.error("missing", e.index);
      return t !== null ? ["Root", r, F(t)] : ["Sqrt", r];
    }
    return t !== null ? ["Root", i, t] : ["Sqrt", i];
  }
  function na(e) {
    if (typeof e == "number") return -e;
    if (typeof e == "string")
      return e.startsWith("-")
        ? e.slice(1)
        : e.startsWith("+")
          ? "-" + e.slice(1)
          : "-" + e;
    let t = e.num;
    return t.startsWith("-")
      ? { num: t.slice(1) }
      : t.startsWith("+")
        ? { num: "-" + t.slice(1) }
        : { num: "-" + t };
  }
  function We(e, t, i, r) {
    return i == null
      ? "\\sqrt{}"
      : ((r = r ?? 2),
        t === "solidus"
          ? e.wrapShort(i) + "^{1/" + e.serialize(r) + "}"
          : t === "quotient"
            ? e.wrapShort(i) + "^{\\frac{1}{" + e.serialize(r) + "}}"
            : S(r) === 2
              ? "\\sqrt{" + e.serialize(i) + "}"
              : "\\sqrt[" + e.serialize(r) + "]{" + e.serialize(i) + "}");
  }
  function sa(e, t) {
    e.level -= 1;
    let i = f(t),
      r = "",
      n = c(t, 1);
    if (i === "Negate") r = "-" + e.wrap(n, V + 1);
    else if (i === "Subtract") {
      r = e.wrap(n, V);
      let s = c(t, 2);
      if (s !== null) {
        let a = e.wrap(s, V);
        a[0] === "-"
          ? (r += "+" + a.slice(1))
          : a[0] === "+"
            ? (r += "-" + a.slice(1))
            : (r = r + "-" + a);
      }
    } else if (i === "Add") {
      if (e.options.prettify && B(t) === 2 && e.options.invisiblePlus !== "+") {
        let [l, o] = [c(t, 1), c(t, 2)],
          [u, p] = [l, o],
          g = S(u),
          d = et(p);
        if (
          ((g === null || d === null) &&
            (([u, p] = [o, l]), (g = S(u)), (d = et(p))),
          g !== null &&
            d !== null &&
            isFinite(g) &&
            Number.isInteger(g) &&
            g >= 0 &&
            g <= 1e3 &&
            isFinite(d[0]) &&
            isFinite(d[1]) &&
            d[0] > 0 &&
            d[0] <= 100 &&
            d[1] <= 100)
        )
          return (
            (r = Fe(e.options.invisiblePlus, e.serialize(u), e.serialize(p))),
            (e.level += 1),
            r
          );
      }
      if (e.options.prettify && B(t) === 2) {
        let [l, o] = Qe(n),
          [u, p] = Qe(c(t, 2));
        if (o < 0 && p > 0)
          return ((r = e.wrap(u, V) + "-" + e.wrap(l, V)), (e.level += 1), r);
      }
      r = e.serialize(n);
      let s = B(t) + 1,
        a = T(t);
      for (let l = 2; l < s; l++)
        if (((n = a[l - 1]), e.options.prettify)) {
          let [o, u] = Qe(n),
            p = e.wrap(o, V);
          u > 0
            ? p.startsWith("+") || p.startsWith("-")
              ? (r += p)
              : (r += "+" + p)
            : p.startsWith("+")
              ? (r += "-" + p.slice(1))
              : p.startsWith("-")
                ? (r += "+" + p.slice(1))
                : (r += "-" + p);
        } else {
          let o = e.wrap(n, V);
          o[0] === "-" || o[0] === "+" ? (r += o) : (r += "+" + o);
        }
    }
    return ((e.level += 1), r);
  }
  function on(e, t) {
    if (t === null) return "";
    e.level -= 1;
    let i = "";
    if (e.options.prettify === !0) {
      let [o, u] = ia(t);
      u.length > 0 &&
        (u.length === 1 && u[0] === 1
          ? o.length === 0
            ? (i = "1")
            : o.length === 1
              ? (i = e.serialize(o[0]))
              : (i = on(e, ["Multiply", ...o]))
          : (i = e.serialize([
              "Divide",
              o.length === 1 ? o[0] : ["Multiply", ...o],
              u.length === 1 ? u[0] : ["Multiply", ...u],
            ])));
    }
    if (i) return ((e.level += 1), i);
    let r = !1,
      n = null,
      s = B(t) + 1,
      a = T(t);
    e.options.prettify === !0 &&
      a.length === 2 &&
      Me(a[1]) &&
      !Me(a[0]) &&
      (a = [a[1], a[0]]);
    let l = !1;
    for (let o = 1; o < s; o++) {
      if (((n = a[o - 1]), n === null)) continue;
      let u;
      if (Me(n)) {
        ((u = e.serialize(n)),
          u === "-1" && !i
            ? ((i = ""), (r = !r))
            : (u[0] === "-" && ((u = u.slice(1)), (r = !r)),
              i ? (i = Fe(e.options.multiply, i, u)) : (i = u)),
          (l = !0));
        continue;
      }
      if (f(n) === "Power") {
        let p = et(c(n, 2));
        if (p != null) {
          let [g, d] = p;
          if (g === 1 && d !== null) {
            ((i += We(e, e.rootStyle(n, e.level), c(n, 1), d)), (l = !1));
            continue;
          }
        }
      }
      if (f(n) === "Power" && !isNaN(S(c(n, 1)) ?? NaN)) {
        ((u = e.serialize(n)),
          i ? (i = Fe(e.options.multiply, i, u)) : (i = u),
          (l = !0));
        continue;
      }
      if (
        (f(n) === "Negate" && ((n = c(n, 1)), (r = !r)), (u = e.wrap(n, H)), !i)
      )
        i = u;
      else {
        let p = f(n);
        (l && (p === "Divide" || p === "Rational")) || /^\d/.test(u)
          ? (i = Fe(e.options.multiply, i, u))
          : e.options.invisibleMultiply
            ? (i = Fe(e.options.invisibleMultiply, i, u))
            : (i = y([i, u]));
      }
      l = !1;
    }
    return ((e.level += 1), r ? "-" + i : i);
  }
  function ht(e) {
    let t = e.parseGroup(),
      i = null;
    if (
      (t === null
        ? ((t = e.parseToken()), (i = e.parseToken()), (t = F(t)), (i = F(i)))
        : ((t = M(t) ? e.error("missing", e.index) : t),
          (i = e.parseGroup()),
          (i = M(i) ? e.error("missing", e.index) : i)),
      f(t) === "PartialDerivative" &&
        (f(i) === "PartialDerivative" ||
          (f(i) === "Multiply" && f(c(i, 1)) === "PartialDerivative")))
    ) {
      let n = c(t, 3) ?? null,
        s = c(t, 1);
      s == null && (s = F(e.parseExpression()));
      let a = [];
      if (f(i) === "Multiply") {
        for (let l of T(i))
          if (f(l) === "PartialDerivative") {
            let o = c(l, 2);
            o && a.push(o);
          }
      } else {
        let l = c(i, 2);
        l && a.push(l);
      }
      return (
        a.length > 1 && (a = ["List", ...a]),
        ["PartialDerivative", s, ...a, n === null ? 1 : n]
      );
    }
    let r = k(t);
    if (r === "d" || r === "d_upright" || r === "differentialD") {
      let n = [],
        s = (a) => {
          if (!a) return;
          let l = k(a);
          if (l && l !== "d" && l !== "d_upright" && l !== "differentialD") {
            n.push(a);
            return;
          }
          let o = f(a);
          if (o === "Sequence" || o === "Multiply" || o === "InvisibleOperator")
            for (let u of T(a)) s(u);
        };
      if ((s(i), n.length === 0)) {
        let a = k(i);
        a && a.length > 1 && a[0] === "d" && n.push(a.slice(1));
      }
      if (n.length > 0) return ["D", F(e.parseExpression()), ...n];
    }
    return ["Divide", t, i];
  }
  function Xi(e, t) {
    if (t === null) return "";
    let i = F(c(t, 1)),
      r = F(c(t, 2)),
      n = e.options.prettify ? e.fractionStyle(t, e.level) : "quotient";
    if (n === "inline-solidus" || n === "nice-solidus") {
      let o = e.wrapShort(i),
        u = e.wrapShort(r);
      return n === "inline-solidus"
        ? `${o}/${u}`
        : `{}^{${o}}\\!\\!/\\!{}_{${u}}`;
    } else {
      if (n === "reciprocal")
        return S(i) === 1
          ? e.wrap(r) + "^{-1}"
          : e.wrap(i) + e.wrap(r) + "^{-1}";
      if (n === "factor")
        return S(r) === 1
          ? e.wrap(i)
          : "\\frac{1}{" +
              e.serialize(r) +
              "}" +
              e.wrapString(e.serialize(i), e.groupStyle(t, 1));
    }
    let s = "\\frac";
    n === "block-quotient"
      ? (s = "\\dfrac")
      : n === "inline-quotient" && (s = "\\tfrac");
    let a = e.serialize(i),
      l = e.serialize(r);
    return `${s}{${a}}{${l}}`;
  }
  function Zt(e, t) {
    if (!t) return "";
    let i = f(t),
      r = F(c(t, 1));
    if (i === "Sqrt") return We(e, e.rootStyle(t, e.level - 1), r, 2);
    let n = F(c(t, 2));
    if (i === "Root") return We(e, e.rootStyle(t, e.level - 1), r, n);
    if (e.options.prettify) {
      let s = S(n) ?? 1;
      if (s === -1) return e.serialize(["Divide", "1", r]);
      if (s < 0) return e.serialize(["Divide", "1", ["Power", r, -s]]);
      if (f(n) === "Divide" || f(n) === "Rational") {
        let a = S(c(n, 1)),
          l = S(c(n, 2));
        if (a === 1) {
          let o = e.rootStyle(t, e.level);
          return We(e, o, r, c(n, 2));
        }
        if (a === -1)
          return l === 2
            ? e.serialize(["Divide", "1", ["Sqrt", r]])
            : e.serialize(["Divide", "1", ["Root", r, c(n, 2) ?? mi]]);
        if (l === 2)
          return `${e.serialize(["Sqrt", r])}^{${e.serialize(c(n, 1))}}`;
      } else if (f(n) === "Power" && S(c(n, 2)) === -1) {
        let a = e.rootStyle(t, e.level);
        return We(e, a, r, c(n, 1));
      }
    }
    return De(
      "^",
      ((s) => (s.startsWith("-") ? e.wrapString(s, "normal") : s))(
        e.wrapShort(r),
      ),
      e.serialize(n),
    );
  }
  function Ve(e, t) {
    e.skipSpace();
    let i = e.index,
      r = e.parseNumber(),
      n = null,
      s = null;
    if (r !== null && (e.match("'") || e.match("\\prime"))) {
      ((n = S(r)), e.skipSpace());
      let o = e.index,
        u = e.parseNumber();
      u !== null && (e.match('"') || e.match("\\doubleprime"))
        ? (s = S(u))
        : (e.index = o);
    } else return ((e.index = i), ["Degrees", t]);
    let a = S(t);
    if (a !== null && n !== null) {
      let o = a + n / 60;
      return (s !== null && (o += s / 3600), ["Degrees", o]);
    }
    let l = [["Quantity", t, "deg"]];
    return (
      l.push(["Quantity", r, "arcmin"]),
      s !== null && l.push(["Quantity", s, "arcsec"]),
      ["Add", ...l]
    );
  }
  var aa = [
    { name: "CatalanConstant", symbolTrigger: "G" },
    { name: "GoldenRatio", latexTrigger: "\\varphi" },
    { name: "EulerGamma", latexTrigger: "\\gamma" },
    {
      name: "Degrees",
      latexTrigger: ["\\degree"],
      kind: "postfix",
      precedence: 880,
      parse: (e, t) => Ve(e, t),
      serialize: (e, t) => {
        let i = e.options,
          r = c(t, 1);
        if (
          i.dmsFormat ||
          (i.angleNormalization && i.angleNormalization !== "none")
        ) {
          let n = S(r);
          if (n !== null) {
            let s = n;
            return (
              i.angleNormalization &&
                i.angleNormalization !== "none" &&
                (s = an(s, i.angleNormalization)),
              i.dmsFormat ? ln(s) : `${s}\xB0`
            );
          }
        }
        return y([e.serialize(r), "\\degree"]);
      },
    },
    {
      latexTrigger: ["\\degree"],
      kind: "postfix",
      precedence: 880,
      parse: (e, t) => Ve(e, t),
    },
    {
      latexTrigger: ["^", "<{>", "\\circ", "<}>"],
      kind: "postfix",
      parse: (e, t) => Ve(e, t),
    },
    {
      latexTrigger: ["^", "\\circ"],
      kind: "postfix",
      parse: (e, t) => Ve(e, t),
    },
    {
      latexTrigger: ["\xB0"],
      kind: "postfix",
      precedence: 880,
      parse: (e, t) => Ve(e, t),
    },
    {
      latexTrigger: ["\\ang"],
      parse: (e) => {
        let t = e.parseGroup();
        return t === null ? ["Degrees"] : ["Degrees", t];
      },
    },
    {
      name: "DMS",
      serialize: (e, t) => {
        let i = S(c(t, 1)),
          r = S(c(t, 2)),
          n = S(c(t, 3));
        if (i !== null) {
          let a = r ?? 0,
            l = n ?? 0,
            o = `${i}\xB0`;
          return (
            (a !== 0 || l !== 0) && (o += `${a}'`),
            l !== 0 && (o += `${l}"`),
            o
          );
        }
        let s = [];
        for (let a of [1, 2, 3]) {
          let l = c(t, a);
          l !== null && s.push(e.serialize(l));
        }
        return `\\operatorname{DMS}(${s.join(", ")})`;
      },
    },
    { latexTrigger: ["\\infty"], parse: "PositiveInfinity" },
    { latexTrigger: ["\\infin"], parse: "PositiveInfinity" },
    { name: "PositiveInfinity", serialize: (e) => e.options.positiveInfinity },
    { name: "NegativeInfinity", serialize: (e) => e.options.negativeInfinity },
    {
      name: "ComplexInfinity",
      latexTrigger: ["\\tilde", "\\infty"],
      serialize: "\\tilde\\infty",
    },
    {
      latexTrigger: ["\\tilde", "<{>", "\\infty", "<}>"],
      parse: "ComplexInfinity",
    },
    { name: "Pi", kind: "symbol", latexTrigger: ["\\pi"] },
    { latexTrigger: ["\u03C0"], parse: "Pi" },
    {
      name: "ExponentialE",
      latexTrigger: ["\\exponentialE"],
      parse: "ExponentialE",
      serialize: "\\exponentialE",
    },
    { latexTrigger: "\\operatorname{e}", parse: "ExponentialE" },
    { latexTrigger: "\\mathrm{e}", parse: "ExponentialE" },
    {
      kind: "function",
      symbolTrigger: "exp",
      parse: (e) => {
        let t = e.parseArguments("implicit");
        return t === null ? "Exp" : ["Exp", ...t];
      },
    },
    {
      latexTrigger: "\\exp",
      parse: (e) => {
        let t = e.parseArguments("implicit");
        return t === null ? "Exp" : ["Exp", ...t];
      },
    },
    { name: "ImaginaryUnit", latexTrigger: ["\\imaginaryI"] },
    { latexTrigger: "\\operatorname{i}", parse: "ImaginaryUnit" },
    { latexTrigger: "\\mathrm{i}", parse: "ImaginaryUnit" },
    {
      name: "Abs",
      kind: "matchfix",
      openTrigger: "|",
      closeTrigger: "|",
      parse: (e, t) => (M(t) ? null : ["Abs", t]),
    },
    {
      kind: "matchfix",
      openTrigger: ["\\vert"],
      closeTrigger: ["\\vert"],
      parse: (e, t) => (M(t) ? null : ["Abs", t]),
    },
    { symbolTrigger: "abs", kind: "function", parse: "Abs" },
    {
      name: "Add",
      latexTrigger: ["+"],
      kind: "infix",
      associativity: "any",
      precedence: V,
      parse: (e, t, i) => {
        let r = e.parseExpression({ ...i, minPrec: V });
        if (r === null) return null;
        if (f(r) === "Negate") {
          let n = c(r, 1);
          if (Me(n)) return He("Add", t, na(n));
        }
        return He("Add", t, r);
      },
      serialize: sa,
    },
    {
      kind: "prefix",
      latexTrigger: ["+"],
      precedence: V,
      parse: (e, t) => e.parseExpression({ ...t, minPrec: 400 }),
    },
    {
      name: "Ceil",
      kind: "matchfix",
      openTrigger: "\\lceil",
      closeTrigger: "\\rceil",
      parse: (e, t) => (M(t) ? null : ["Ceil", t]),
    },
    {
      kind: "matchfix",
      openTrigger: ["\u2308"],
      closeTrigger: ["\u2309"],
      parse: (e, t) => (M(t) ? null : ["Ceil", t]),
    },
    { symbolTrigger: "ceil", kind: "function", parse: "Ceil" },
    { name: "Chop", symbolTrigger: "chop", kind: "function", parse: "Chop" },
    {
      name: "Complex",
      precedence: V - 1,
      serialize: (e, t) => {
        let i = e.serialize(c(t, 1)),
          r = S(c(t, 2));
        if (r === 0) return i;
        let n =
          r === 1
            ? "\\imaginaryI"
            : r === -1
              ? "-\\imaginaryI"
              : y([e.serialize(c(t, 2)), "\\imaginaryI"]);
        return S(c(t, 1)) === 0
          ? n
          : r !== null && r < 0
            ? y([i, n])
            : y([i, "+", n]);
      },
    },
    {
      name: "Divide",
      latexTrigger: "\\frac",
      precedence: K,
      parse: ht,
      serialize: Xi,
    },
    { latexTrigger: "\\dfrac", precedence: K, parse: ht },
    { latexTrigger: "\\tfrac", precedence: K, parse: ht },
    { latexTrigger: "\\cfrac", precedence: K, parse: ht },
    {
      kind: "infix",
      latexTrigger: "\\over",
      associativity: "none",
      precedence: K,
      parse: "Divide",
    },
    {
      latexTrigger: ["\\/"],
      kind: "infix",
      associativity: "left",
      precedence: K,
      parse: "Divide",
    },
    {
      latexTrigger: ["/"],
      kind: "infix",
      associativity: "left",
      precedence: K,
      parse: "Divide",
    },
    {
      latexTrigger: ["\\div"],
      kind: "infix",
      associativity: "left",
      precedence: K,
      parse: "Divide",
    },
    {
      name: "Exp",
      serialize: (e, t) => {
        let i = c(t, 1);
        return k(i) || S(i) !== null
          ? y(["\\exponentialE^{", e.serialize(i), "}"])
          : y(["\\exp", e.wrap(F(i))]);
      },
    },
    { name: "Factorial", latexTrigger: ["!"], kind: "postfix", precedence: Bi },
    {
      name: "Factorial2",
      latexTrigger: ["!", "!"],
      kind: "postfix",
      precedence: Bi,
    },
    {
      name: "Floor",
      kind: "matchfix",
      openTrigger: "\\lfloor",
      closeTrigger: "\\rfloor",
      parse: (e, t) => (M(t) ? null : ["Floor", t]),
    },
    {
      kind: "matchfix",
      openTrigger: ["\u230A"],
      closeTrigger: ["\u230B"],
      parse: (e, t) => (M(t) ? null : ["Floor", t]),
    },
    { symbolTrigger: "floor", kind: "function", parse: "Floor" },
    { latexTrigger: ["\\Gamma"], parse: "Gamma" },
    { latexTrigger: ["\\zeta"], kind: "function", parse: "Zeta" },
    { latexTrigger: ["\\Beta"], kind: "function", parse: "Beta" },
    {
      name: "LambertW",
      latexTrigger: ["\\operatorname{W}"],
      kind: "function",
      serialize: (e, t) => "\\operatorname{W}" + e.wrapArguments(t),
    },
    {
      name: "BesselJ",
      latexTrigger: ["\\operatorname{J}"],
      kind: "function",
      serialize: (e, t) => {
        let i = c(t, 1),
          r = c(t, 2);
        return i !== null && r !== null
          ? "\\operatorname{J}_{" +
              e.serialize(i) +
              "}" +
              e.wrapArguments(["BesselJ", r])
          : "\\operatorname{J}" + e.wrapArguments(t);
      },
    },
    {
      name: "BesselY",
      latexTrigger: ["\\operatorname{Y}"],
      kind: "function",
      serialize: (e, t) => {
        let i = c(t, 1),
          r = c(t, 2);
        return i !== null && r !== null
          ? "\\operatorname{Y}_{" +
              e.serialize(i) +
              "}" +
              e.wrapArguments(["BesselY", r])
          : "\\operatorname{Y}" + e.wrapArguments(t);
      },
    },
    {
      name: "BesselI",
      latexTrigger: ["\\operatorname{I}"],
      kind: "function",
      serialize: (e, t) => {
        let i = c(t, 1),
          r = c(t, 2);
        return i !== null && r !== null
          ? "\\operatorname{I}_{" +
              e.serialize(i) +
              "}" +
              e.wrapArguments(["BesselI", r])
          : "\\operatorname{I}" + e.wrapArguments(t);
      },
    },
    {
      name: "BesselK",
      latexTrigger: ["\\operatorname{K}"],
      kind: "function",
      serialize: (e, t) => {
        let i = c(t, 1),
          r = c(t, 2);
        return i !== null && r !== null
          ? "\\operatorname{K}_{" +
              e.serialize(i) +
              "}" +
              e.wrapArguments(["BesselK", r])
          : "\\operatorname{K}" + e.wrapArguments(t);
      },
    },
    {
      name: "AiryAi",
      latexTrigger: ["\\operatorname{Ai}"],
      kind: "function",
      serialize: (e, t) => "\\operatorname{Ai}" + e.wrapArguments(t),
    },
    {
      name: "AiryBi",
      latexTrigger: ["\\operatorname{Bi}"],
      kind: "function",
      serialize: (e, t) => "\\operatorname{Bi}" + e.wrapArguments(t),
    },
    { name: "GCD", latexTrigger: ["\\gcd"], kind: "function" },
    { symbolTrigger: "gcd", kind: "function", parse: "GCD" },
    { symbolTrigger: "GCD", kind: "function", parse: "GCD" },
    { name: "Half", serialize: "\\frac12" },
    {
      name: "Lg",
      latexTrigger: ["\\lg"],
      serialize: (e, t) => "\\log_{10}" + e.wrapArguments(t),
      parse: (e) => {
        let t = e.parseArguments("implicit");
        return t === null ? "Lg" : ["Log", ...t, 10];
      },
    },
    {
      name: "Lb",
      latexTrigger: "\\lb",
      parse: (e) => {
        let t = e.parseArguments("implicit");
        return t === null ? "Log" : ["Log", t[0], 2];
      },
    },
    {
      name: "Ln",
      latexTrigger: ["\\ln"],
      parse: (e) => nr("Ln", e),
      serialize: (e, t) => "\\ln" + e.wrapArguments(t),
    },
    {
      name: "Log",
      latexTrigger: ["\\log"],
      parse: (e) => nr("Log", e),
      serialize: (e, t) => {
        let [i, r] = T(t);
        return r
          ? y(["\\log_{", e.serialize(r), "}", e.wrap(i)])
          : "\\log" + e.wrapArguments(t);
      },
    },
    { name: "LCM", latexTrigger: ["\\lcm"], kind: "function" },
    { symbolTrigger: "lcm", kind: "function", parse: "LCM" },
    { symbolTrigger: "LCM", kind: "function", parse: "LCM" },
    {
      symbolTrigger: "max",
      kind: "function",
      parse: "Max",
      arguments: "implicit",
    },
    {
      symbolTrigger: "min",
      kind: "function",
      parse: "Min",
      arguments: "implicit",
    },
    {
      name: "Max",
      latexTrigger: "\\max",
      kind: "function",
      arguments: "implicit",
    },
    {
      name: "Min",
      latexTrigger: "\\min",
      kind: "function",
      arguments: "implicit",
    },
    {
      name: "Supremum",
      latexTrigger: "\\sup",
      kind: "function",
      arguments: "implicit",
    },
    {
      name: "Infimum",
      latexTrigger: "\\inf",
      kind: "function",
      arguments: "implicit",
    },
    {
      name: "Limit",
      latexTrigger: "\\lim",
      kind: "expression",
      parse: (e) => {
        if (!e.match("_")) return null;
        let t = e.parseGroup();
        if (f(t) !== "To") return null;
        let i = e.parseExpression({ minPrec: H });
        return i ? ["Limit", ["Function", i, c(t, 1)], c(t, 2)] : null;
      },
      serialize: (e, t) => {
        let i = c(t, 1),
          r = c(i, 2),
          n = c(t, 2);
        return y([
          "\\lim_{",
          e.serialize(r),
          "\\to",
          e.serialize(n),
          "}",
          e.serialize(c(i, 1)),
        ]);
      },
    },
    {
      name: "MinusPlus",
      latexTrigger: ["\\mp"],
      kind: "infix",
      associativity: "any",
      precedence: ye,
    },
    {
      name: "Multiply",
      latexTrigger: ["\\times"],
      kind: "infix",
      associativity: "any",
      precedence: H,
      serialize: on,
    },
    {
      latexTrigger: ["\\cdot"],
      kind: "infix",
      associativity: "any",
      precedence: H,
      parse: (e, t, i) => {
        let r = e.parseExpression({ ...i, minPrec: H + 2 });
        return r === null ? null : He("Multiply", t, r);
      },
    },
    {
      latexTrigger: ["*"],
      kind: "infix",
      associativity: "any",
      precedence: H,
      parse: (e, t, i) => {
        let r = e.parseExpression({ ...i, minPrec: H + 2 });
        return r === null ? ["Multiply", t, mi] : He("Multiply", t, r);
      },
    },
    {
      name: "Mod",
      latexTrigger: "\\bmod",
      kind: "infix",
      precedence: K,
      serialize: (e, t) => {
        if (B(t) !== 2) return "";
        let i = e.serialize(c(t, 1)),
          r = e.serialize(c(t, 2));
        return y([i, "\\bmod", r]);
      },
    },
    { latexTrigger: "\\mod", kind: "infix", precedence: K, parse: "Mod" },
    { latexTrigger: "\\operatorname{mod}", parse: "Mod" },
    {
      latexTrigger: "\\pmod",
      kind: "prefix",
      precedence: A,
      parse: (e) => {
        let t = e.parseGroup() ?? e.parseToken();
        return ["Mod", F(t)];
      },
    },
    {
      name: "Congruent",
      serialize: (e, t) => {
        let i = e.serialize(c(t, 1)),
          r = e.serialize(c(t, 2));
        if (c(t, 3) === null) return y([i, "\\equiv", r]);
        let n = e.serialize(c(t, 3));
        return y([i, "\\equiv", r, "\\pmod{", n, "}"]);
      },
    },
    {
      name: "Negate",
      latexTrigger: ["-"],
      kind: "prefix",
      precedence: ot + 1,
      parse: (e, t) => {
        e.skipSpace();
        let i = e.parseExpression({ ...t, minPrec: ot + 3 });
        return i === null ? null : ["Negate", i];
      },
    },
    {
      kind: "matchfix",
      openTrigger: "||",
      closeTrigger: "||",
      parse: (e, t) => (M(t) ? null : ["Norm", t]),
    },
    {
      name: "Norm",
      kind: "matchfix",
      openTrigger: ["\\left", "\\Vert"],
      closeTrigger: ["\\right", "\\Vert"],
      parse: (e, t) => (M(t) ? null : ["Norm", t]),
      serialize: (e, t) => {
        let i = c(t, 1);
        if (f(i) === "Matrix") {
          let r = c(i, 1),
            n = c(i, 2),
            s = n
              ? ["Matrix", r, { str: "\u2016\u2016" }, n]
              : ["Matrix", r, { str: "\u2016\u2016" }];
          return e.serialize(s);
        }
        return `\\left\\Vert ${e.serialize(i)}\\right\\Vert`;
      },
    },
    {
      name: "PlusMinus",
      latexTrigger: ["\\pm"],
      kind: "infix",
      associativity: "any",
      precedence: ye,
      serialize: (e, t) => {
        let i = c(t, 1);
        if (i === null) return "\\pm";
        if (B(t) === 1) return y(["\\pm", e.serialize(i)]);
        let r = c(t, 2);
        return y([e.serialize(i), "\\pm", e.serialize(r)]);
      },
    },
    {
      latexTrigger: ["\\pm"],
      kind: "prefix",
      precedence: ye,
      parse: (e, t) => {
        let i = e.parseExpression({ ...t, minPrec: 400 });
        return ["PlusMinus", 0, F(i)];
      },
    },
    {
      latexTrigger: ["\\plusmn"],
      kind: "infix",
      associativity: "any",
      precedence: ye,
      parse: (e, t, i) => {
        let r = e.parseExpression({ ...i, minPrec: 400 });
        return ["PlusMinus", t, F(r)];
      },
    },
    {
      latexTrigger: ["\\plusmn"],
      kind: "prefix",
      precedence: ye,
      parse: (e, t) => {
        let i = e.parseExpression({ ...t, minPrec: 400 });
        return ["PlusMinus", F(i)];
      },
    },
    { name: "Power", latexTrigger: ["^"], kind: "infix", serialize: Zt },
    {
      latexTrigger: "\\prod",
      precedence: H,
      name: "Product",
      parse: tr("Product", "Multiply", H),
      serialize: rr("\\prod"),
    },
    {
      latexTrigger: ["*", "*"],
      kind: "infix",
      associativity: "right",
      precedence: ot,
      parse: (e, t, i) => {
        if (e.options.strict !== !1) return null;
        let r = e.parseExpression({ ...i, minPrec: ot });
        return r === null ? null : ["Power", t, r];
      },
    },
    {
      name: "Rational",
      precedence: K,
      serialize: (e, t) =>
        t && B(t) === 1
          ? "\\operatorname{Rational}" + e.wrapArguments(t)
          : Xi(e, t),
    },
    {
      name: "Reduce",
      serialize: (e, t) => {
        let i = c(t, 1);
        if (!i) return "";
        let r = c(t, 2);
        return k(r) === "Add"
          ? `\\sum ${e.serialize(i)}`
          : k(r) === "Multiply"
            ? `\\prod ${e.serialize(i)}`
            : `\\operatorname{Reduce}\\left(${e.serialize(i)}, ${e.serialize(c(t, 2))}\\right)`;
      },
    },
    { name: "Root", serialize: Zt },
    { name: "Round", symbolTrigger: "round", kind: "function" },
    {
      name: "Square",
      precedence: 720,
      serialize: (e, t) => {
        let i = e.wrapShort(c(t, 1));
        return (i.startsWith("-") ? e.wrapString(i, "normal") : i) + "^2";
      },
    },
    {
      latexTrigger: ["\\sum"],
      precedence: V,
      name: "Sum",
      parse: tr("Sum", "Add", H),
      serialize: rr("\\sum"),
    },
    { name: "Heaviside", symbolTrigger: "Heaviside", kind: "function" },
    { name: "Sign", symbolTrigger: "sgn", kind: "function" },
    { name: "Sqrt", latexTrigger: ["\\sqrt"], parse: ra, serialize: Zt },
    {
      name: "Subtract",
      latexTrigger: ["-"],
      kind: "infix",
      associativity: "left",
      precedence: V + 2,
      parse: (e, t, i) => {
        let r = e.parseExpression({ ...i, minPrec: V + 3 });
        return r === null ? null : ["Subtract", t, r];
      },
      serialize: (e, t) => {
        let i = e.wrap(c(t, 1), V + 2),
          r = e.wrap(c(t, 2), V + 3);
        return y([i, "-", r]);
      },
    },
    {
      name: "Distance",
      latexTrigger: ["\\operatorname{distance}"],
      kind: "function",
      serialize: (e, t) => "\\operatorname{distance}" + e.wrapArguments(t),
    },
  ];
  function la(e, t) {
    if (e !== null) {
      if (k(e)) return { index: k(e) ?? "Nothing", upper: t };
      if (f(e) === "GreaterEqual") {
        let i = k(c(e, 1)) ?? "Nothing",
          r = c(e, 2) ?? 1;
        return { index: i, lower: r, upper: t };
      }
      if (f(e) === "LessEqual") {
        let i = T(e) ?? [];
        if (i.length === 3)
          return { index: k(i[1]) ?? "Nothing", lower: i[0], upper: i[2] };
        if (i.length === 2) {
          if (k(i[0])) return { index: k(i[0]), upper: i[1] };
          if (k(i[1])) return { index: k(i[1]), lower: i[0], upper: t };
        }
      }
      if (f(e) === "Equal") {
        let i = k(c(e, 1)) ?? "Nothing",
          r = c(e, 2);
        if (f(r) === "Range") {
          let n = c(r, 1) ?? 1,
            s = c(r, 2) ?? void 0;
          return { index: i, lower: n, upper: s };
        }
        return { index: i, lower: r ?? 1, upper: t };
      }
      if (f(e) === "Element")
        return { index: k(c(e, 1)) ?? "Nothing", element: e };
    }
  }
  function oa(e) {
    let t = f(e);
    return t
      ? new Set([
          "Less",
          "LessEqual",
          "Greater",
          "GreaterEqual",
          "NotEqual",
          "And",
          "Or",
          "Not",
        ]).has(t)
      : !1;
  }
  function er(e) {
    if (e === null) return [];
    let t = St(e);
    if (t) return [...t];
    if (f(e) === "Tuple") {
      let i = T(e);
      return i ? [...i] : [e];
    }
    return [e];
  }
  function ua(e, t) {
    (M(e) && (e = null), M(t) && (t = null));
    let i = er(e),
      r = er(t),
      n = [],
      s = 0;
    for (; s < i.length;) {
      let a = i[s],
        l = la(a, r[s]);
      if (l) {
        if (l.element && s + 1 < i.length) {
          let o = i[s + 1];
          if (oa(o) && f(o) !== "Element" && f(o) !== "Equal") {
            let u = l.element;
            if (Array.isArray(u) && u.length >= 3) {
              let p = [u[0], ...u.slice(1), o];
              l.element = p;
            }
            s++;
          }
        }
        n.push(l);
      }
      s++;
    }
    return n;
  }
  function tr(e, t, i) {
    return (r) => {
      (r.skipSpace(), r.pushSymbolTable());
      let n = null,
        s = null;
      for (; !(s && n) && (r.peek === "_" || r.peek === "^");)
        (r.match("_")
          ? (s = r.parseGroup() ?? r.parseToken())
          : r.match("^") && (n = r.parseGroup() ?? r.parseToken()),
          r.skipSpace());
      if (!n && !s) {
        let u = r.parseExpression({ minPrec: i });
        return (r.popSymbolTable(), u ? ["Reduce", u, t] : null);
      }
      let a = ua(s, n),
        l = r.parseExpression({ minPrec: i });
      if ((r.popSymbolTable(), l === null)) return [e];
      let o = [];
      for (let u of a) {
        if (u.element) {
          o.push(u.element);
          continue;
        }
        let p = u.lower,
          g = u.upper,
          d = u.index ?? "Nothing";
        g != null
          ? o.push(["Tuple", d, p ?? 1, g])
          : p != null
            ? o.push(["Tuple", d, p])
            : o.push(["Tuple", d]);
      }
      return [e, l, ...o];
    };
  }
  var ca = new Set(["Tuple", "Triple", "Pair", "Single", "Limits", "Element"]);
  function ir(e) {
    return e == null || k(e) === "Nothing" ? null : e;
  }
  function pa(e) {
    let t = [],
      i = T(e);
    if (i.length <= 1) return t;
    for (let r of i.slice(1)) {
      let n = f(r);
      if (n && ca.has(n)) {
        t.push(r);
        continue;
      }
      break;
    }
    return t;
  }
  function ha(e, t) {
    if (f(t) === "Element") {
      let u = e.serialize(c(t, 1)),
        p = e.serialize(c(t, 2));
      return { sub: `${u}\\in ${p}` };
    }
    let i = c(t, 1);
    i !== null && f(i) === "Hold" && (i = c(i, 1));
    let r = ir(c(t, 2)),
      n = ir(c(t, 3)),
      s = {},
      a = i ? k(i) : null,
      l = a !== null && a !== "Nothing",
      o = l && i ? e.serialize(i) : void 0;
    return (
      l && r !== null && o
        ? (s.sub = `${o}=${e.serialize(r)}`)
        : l && o
          ? (s.sub = o)
          : r !== null && (s.sub = e.serialize(r)),
      n !== null && (s.sup = e.serialize(n)),
      s
    );
  }
  function rr(e) {
    return (t, i) => {
      let r = c(i, 1);
      if (!r) return e;
      let n = pa(i),
        s = e;
      if (n.length > 0) {
        let a = [],
          l = [];
        for (let o of n) {
          let u = ha(t, o);
          (u.sub && a.push(u.sub), u.sup && l.push(u.sup));
        }
        (a.length > 0 && (s = De("_", s, a.join(", "))),
          l.length > 0 && (s = De("^", s, l.join(", "))));
      }
      return y([s, t.serialize(r)]);
    };
  }
  function nr(e, t) {
    let i = null;
    t.match("_") && (i = t.parseGroup() ?? t.parseToken());
    let r = t.parseArguments("implicit");
    return r === null && i === null
      ? [e]
      : r === null
        ? [e, i]
        : i === null
          ? [e, ...r]
          : i === 10
            ? ["Log", r[0]]
            : i === 2
              ? ["Lb", ...r]
              : ["Log", r[0], i];
  }
  function Qe(e) {
    let t = 1,
      i = e;
    do {
      e = i;
      let r = f(e);
      if (r === "Negate") ((t *= -1), (i = c(e, 1)));
      else if (r === "Multiply") {
        let [n, s] = Qe(c(e, 1));
        s < 0 &&
          ((t *= -1),
          n === 1
            ? (i = ["Multiply", ...T(e).slice(1)])
            : (i = ["Multiply", n, ...T(e).slice(1)]));
      } else if (r === "Divide" || r === "Rational") {
        let [n, s] = Qe(c(e, 1));
        s < 0 && ((t *= -1), (i = [r, n, c(e, 2)]));
      } else {
        let n = S(e);
        n !== null && n < 0 && ((t *= -1), (i = -n));
      }
    } while (i !== e);
    return [e, t];
  }
  var ga = [
    {
      name: "Real",
      kind: "function",
      latexTrigger: ["\\Re"],
      arguments: "implicit",
    },
    {
      name: "Imaginary",
      kind: "function",
      latexTrigger: ["\\Im"],
      arguments: "implicit",
    },
    {
      name: "Argument",
      kind: "function",
      latexTrigger: ["\\arg"],
      arguments: "implicit",
    },
    { name: "Conjugate", latexTrigger: ["^", "\\star"], kind: "postfix" },
  ];
  function N(e) {
    return (t, i) => {
      let r = {
          "\\arcsin": "Arcsin",
          "\\arccos": "Arccos",
          "\\arctan": "Arctan",
          "\\arctg": "Arctan",
          "\\arcctg": "Arccot",
          "\\arcsec": "Arcsec",
          "\\arccsc": "Arccsc",
          "\\arsinh": "Arsinh",
          "\\arcsinh": "Arsinh",
          "\\arcosh": "Arcosh",
          "\\arccosh": "Arcosh",
          "\\artanh": "Artanh",
          "\\arctanh": "Artanh",
          "\\arsech": "Arsech",
          "\\arcsech": "Arsech",
          "\\arcsch": "Arcsch",
          "\\arccsch": "Arcsch",
          "\\arcoth": "Arcoth",
          "\\arccoth": "Arcoth",
          "\\ch": "Cosh",
          "\\cos": "Cos",
          "\\cosh": "Cosh",
          "\\cosec": "Csc",
          "\\cot": "Cot",
          "\\cotg": "Cot",
          "\\ctg": "Cot",
          "\\csc": "Csc",
          "\\csch": "Csch",
          "\\coth": "Coth",
          "\\cth": "Coth",
          "\\sec": "Sec",
          "\\sech": "Sech",
          "\\sin": "Sin",
          "\\sinh": "Sinh",
          "\\sh": "Sinh",
          "\\tan": "Tan",
          "\\tg": "Tan",
          "\\tanh": "Tanh",
          "\\th": "Tanh",
        },
        n = r[e ?? ""] ?? e ?? "";
      if (t.atTerminator(i)) return n;
      let s = n;
      do {
        let p = t.parsePostfixOperator(s, i);
        if (p === null) break;
        s = p;
      } while (!0);
      t.skipSpace();
      let a = null;
      (t.match("^") && (a = t.parseGroup() ?? t.parseToken()), t.skipSpace());
      let l = t.parseArguments("implicit", {
          minPrec: H,
          condition: (p) => r[p.peek] !== void 0 || (i?.condition?.(p) ?? !1),
        }),
        o =
          l?.length === 2 &&
          (s === "Arctan" ||
            (Array.isArray(s) && s[0] === "InverseFunction" && s[1] === "Tan"))
            ? "Arctan2"
            : s,
        u =
          l === null
            ? s
            : typeof o == "string"
              ? [o, ...l]
              : ["Apply", o, ...l];
      return a === null ? u : ["Power", u, a];
    };
  }
  var da = [
    { name: "Arcsin", latexTrigger: ["\\arcsin"], parse: N("Arcsin") },
    { name: "Arccos", latexTrigger: ["\\arccos"], parse: N("Arccos") },
    { name: "Arctan", latexTrigger: ["\\arctan"], parse: N("Arctan") },
    { latexTrigger: ["\\arctg"], parse: N("Arctan") },
    { symbolTrigger: "arctg", parse: N("Arctan") },
    { name: "Arccot", symbolTrigger: "arcctg", parse: N("Arccot") },
    { latexTrigger: ["\\arcctg"], parse: N("Arccot") },
    { name: "Arcoth", symbolTrigger: "arcoth", parse: N("Arcoth") },
    { symbolTrigger: "arccoth", parse: N("Arcoth") },
    { latexTrigger: ["\\arcoth"], parse: N("Arcoth") },
    { latexTrigger: ["\\arccoth"], parse: N("Arcoth") },
    { name: "Arcsec", symbolTrigger: "arcsec", parse: N("Arcsec") },
    { latexTrigger: ["\\arcsec"], parse: N("Arcsec") },
    { name: "Arccsc", symbolTrigger: "arccsc", parse: N("Arccsc") },
    { latexTrigger: ["\\arccsc"], parse: N("Arccsc") },
    { name: "Arsinh", symbolTrigger: "arsinh", parse: N("Arsinh") },
    { symbolTrigger: "arcsinh", parse: N("Arsinh") },
    { latexTrigger: ["\\arsinh"], parse: N("Arsinh") },
    { latexTrigger: ["\\arcsinh"], parse: N("Arsinh") },
    { name: "Arcosh", symbolTrigger: "arcosh", parse: N("Arcosh") },
    { symbolTrigger: "arccosh", parse: N("Arcosh") },
    { latexTrigger: "\\arcosh", parse: N("Arcosh") },
    { latexTrigger: "\\arccosh", parse: N("Arcosh") },
    { name: "Artanh", symbolTrigger: "artanh", parse: N("Artanh") },
    { symbolTrigger: "arctanh", parse: N("Artanh") },
    { latexTrigger: "\\artanh", parse: N("Artanh") },
    { latexTrigger: ["\\arctanh"], parse: N("Artanh") },
    { name: "Arsech", symbolTrigger: "arsech", parse: N("Arsech") },
    { symbolTrigger: "arcsech", parse: N("Arsech") },
    { latexTrigger: ["\\arsech"], parse: N("Arsech") },
    { latexTrigger: ["\\arcsech"], parse: N("Arsech") },
    { name: "Arcsch", symbolTrigger: "arcsch", parse: N("Arcsch") },
    { symbolTrigger: "arccsch", parse: N("Arcsch") },
    { latexTrigger: ["\\arcsch"], parse: N("Arcsch") },
    { latexTrigger: ["\\arccsch"], parse: N("Arcsch") },
    { name: "Cosec", symbolTrigger: "cosec", parse: N("Cosec") },
    { latexTrigger: ["\\cosec"], parse: N("Cosec") },
    { name: "Cosh", latexTrigger: ["\\cosh"], parse: N("Cosh") },
    { latexTrigger: ["\\ch"], parse: N("Cosh") },
    { name: "Cot", latexTrigger: ["\\cot"], parse: N("Cot") },
    { latexTrigger: ["\\cotg"], parse: N("Cot") },
    { latexTrigger: ["\\ctg"], parse: N("Cot") },
    { name: "Csc", latexTrigger: ["\\csc"], parse: N("Csc") },
    { name: "Csch", latexTrigger: ["\\csch"], parse: N("Csch") },
    { name: "Coth", latexTrigger: ["\\coth"], parse: N("Coth") },
    { latexTrigger: ["\\cth"], parse: N("Coth") },
    { symbolTrigger: "cth", parse: N("Coth") },
    { latexTrigger: ["\\coth"], parse: N("Coth") },
    { name: "Sec", latexTrigger: ["\\sec"], parse: N("Sec") },
    { name: "Sech", symbolTrigger: "sech", parse: N("Sech") },
    { latexTrigger: ["\\sech"], parse: N("Sech") },
    { name: "Sinh", latexTrigger: ["\\sinh"], parse: N("Sinh") },
    { latexTrigger: ["\\sh"], parse: N("Sinh") },
    { name: "Tan", latexTrigger: ["\\tan"], parse: N("Tan") },
    { latexTrigger: ["\\tg"], parse: N("Tan") },
    { name: "Tanh", latexTrigger: ["\\tanh"], parse: N("Tanh") },
    { latexTrigger: ["\\th"], parse: N("Tanh") },
    { name: "Cos", latexTrigger: ["\\cos"], parse: N("Cos") },
    { name: "Sin", latexTrigger: ["\\sin"], parse: N("Sin") },
    { name: "Sinc", symbolTrigger: "sinc", kind: "function" },
    { name: "FresnelS", symbolTrigger: "FresnelS", kind: "function" },
    { name: "FresnelC", symbolTrigger: "FresnelC", kind: "function" },
  ];
  function $e(e, t = 1) {
    return (i) => {
      (i.skipVisualSpace(), i.match("\\limits"), i.skipSpace());
      let r = null,
        n = null;
      for (; !(n !== null && r !== null) && (i.peek === "_" || i.peek === "^");)
        (i.match("_")
          ? (n = i.parseGroup() ?? i.parseToken())
          : i.match("^") && (r = i.parseGroup() ?? i.parseToken()),
          i.skipSpace());
      (M(n) && (n = null), M(r) && (r = null));
      let s = [n ?? "Nothing"],
        a = [r ?? "Nothing"];
      i.skipVisualSpace();
      let [l, o] = fa(i, t);
      if (l && o.length === 0) {
        if (f(l) === "Add" || f(l) === "Subtract") {
          let u = [],
            p = [];
          for (let g of T(l))
            if (o) p.push(g);
            else {
              let d;
              (([d, o] = oe(g)), u.push(d ?? g));
            }
          if (o !== null && p.length > 0)
            return [
              "Add",
              sr(e, ["Add", ...u], { indexes: o, subs: s, sups: a }) ??
                "Nothing",
              ...p,
            ];
        } else if (f(l) === "Divide") {
          let u;
          (([u, o] = oe(c(l, 1))),
            u !== null && o !== null && (l = ["Divide", u, c(l, 2)]));
        }
      }
      return sr(e, l, { indexes: o, subs: s, sups: a });
    };
  }
  function sr(e, t, i) {
    if (!t) return null;
    if (i.sups.length === 0 && i.subs.length === 0) return [e, t, ...i.indexes];
    let r =
        i.indexes.length === 0
          ? f(t) === "Function"
            ? T(t).slice(1)
            : []
          : i.indexes,
      n = Math.max(i.sups.length, i.subs.length, r.length);
    if (r.length === 0) for (let a = 0; a < n; a++) r.push("Nothing");
    else if (r.length !== n)
      for (let a = r.length; a < n; a++) r.push(["Error", "'missing'"]);
    if (i.subs.length !== n)
      for (let a = i.subs.length; a < n; a++) i.subs.push("Nothing");
    if (i.sups.length !== n)
      for (let a = i.sups.length; a < n; a++) i.sups.push("Nothing");
    let s = r.map((a, l) => {
      let o = i.sups[l],
        u = i.subs[l];
      return u === "Nothing" && o === "Nothing" ? a : ["Tuple", a, u, o];
    });
    return [e, t, ...s];
  }
  function fa(e, t = 1) {
    let i = !1,
      r = e.parseExpression({
        minPrec: 266,
        condition: () => {
          let n = e.index;
          return ((i = un(e)), (e.index = n), i);
        },
      });
    return r !== null && !i ? oe(r) : [r, ma(e, t)];
  }
  function ma(e, t) {
    let i = [];
    for (; i.length < t && un(e);) {
      e.skipVisualSpace();
      let r = k(e.parseSymbol());
      if (r === null) return i;
      i.push(r);
    }
    return i;
  }
  function oe(e) {
    let t = f(e),
      i = c(e, 1);
    if (!i) return [e, []];
    if (t === "Sequence" && B(e) === 1) return oe(i);
    if (t === "Multiply" || t === "InvisibleOperator") {
      let r = T(e);
      if (r) {
        let [n, s] = Ta(r);
        return n.length > 0 ? [[t, ...n], s] : [null, s];
      }
    } else if (t === "Delimiter") {
      let [r, n] = oe(i);
      if (n)
        return r
          ? [["Delimiter", ["Sequence", r], ...T(e).slice(1)], n]
          : [null, n];
    } else if (t === "Add") {
      let r = T(e);
      if (r.length > 0) {
        let [n, s] = oe(r[r.length - 1]);
        if (s.length > 0) {
          if (n) return [["Add", ...r.slice(0, -1), n], s];
          if (r.length > 2) return [["Add", ...r.slice(0, -1)], s];
          if (r.length > 2) return [r[0], s];
        }
      }
    } else if (t === "Negate") {
      let [r, n] = oe(i);
      if (n.length > 0) return [r ? ["Negate", r] : null, n];
    } else if (t === "Divide") {
      let [r, n] = oe(i);
      if (n.length > 0) return [["Divide", r ?? 1, c(e, 2)], n];
    } else {
      let r = T(e);
      if (r.length === 1) {
        let [n, s] = oe(r[0]);
        if (s.length > 0) return [[f(e), n], s];
      }
    }
    return [e, []];
  }
  function ar(e) {
    return (t, i) => {
      if (!c(i, 1)) return e;
      let r = c(i, 1),
        n = [];
      f(r) === "BuiltInFunction"
        ? ((n = ["x"]), (r = [c(r, 1), "x"]))
        : f(r) === "Function"
          ? ((n = T(r).slice(1)), (r = c(r, 1)))
          : k(r)
            ? (n = [])
            : (n = []);
      let s = T(i).slice(1),
        a = [],
        l = s.map((p, g) => {
          if (k(p) === "Nothing") return (a.push(k(n[g]) ?? "Nothing"), "");
          if (k(p)) return (a.push(k(p) ?? "Nothing"), "");
          let d = f(p);
          if (
            d === "Tuple" ||
            d === "Triple" ||
            d === "Pair" ||
            d === "Limits" ||
            d === "Range"
          ) {
            if (B(p) === 3) {
              let m = c(p, 1);
              a.push(k(m) ?? "Nothing");
              let b = c(p, 2),
                I = c(p, 3);
              return (
                k(b) === "Nothing" && (b = null),
                k(I) === "Nothing" && (I = null),
                b !== null && I !== null
                  ? `_{${t.serialize(b)}}^{${t.serialize(I)}}`
                  : b !== null
                    ? `_{${t.serialize(b)}}`
                    : I !== null
                      ? `^{${t.serialize(I)}}`
                      : ""
              );
            }
            return `_{${t.serialize(p)}}`;
          }
          if (B(p) === 2) {
            if (k(c(p, 1))) {
              a.push(k(c(p, 1)) ?? "Nothing");
              let I = c(p, 2);
              return k(I) === "Nothing" ? "" : `_{${t.serialize(I)}}`;
            }
            a.push(k(n[g]) ?? "Nothing");
            let m = c(p, 1),
              b = c(p, 2);
            if (
              (k(m) === "Nothing" && (m = null),
              k(b) === "Nothing" && (b = null),
              m !== null && b !== null)
            )
              return `_{${t.serialize(m)}}^{${t.serialize(b)}}`;
            if (m !== null) return `_{${t.serialize(m)}}`;
            if (b !== null) return `^{${t.serialize(b)}}`;
          } else a.push(k(n[g]) ?? "Nothing");
        }),
        o = a
          .filter((p) => k(p) !== "Nothing")
          .map((p) => `\\mathrm{d}${t.serialize(k(p) ?? "x")}`);
      if ((o.length > 0 && (o = ["\\,", ...o]), l.length === 0))
        return `${e}\\,${t.serialize(r)}\\!${o.join(" ")}`;
      let u = xa(e, l);
      return u !== null
        ? u + "\\!" + t.serialize(r) + o.join(" ")
        : l
            .reverse()
            .map((p) => `${e}${p}`)
            .join("") +
            "\\!" +
            t.serialize(r) +
            o.join(" ");
    };
  }
  function xa(e, t) {
    let i = t.length;
    if (i !== 2 && i !== 3) return null;
    let r = {
      "\\int": ["\\iint", "\\iiint"],
      "\\oint": ["\\oiint", "\\oiiint"],
    }[e];
    return !r || t.slice(1).some((n) => n) ? null : r[i - 2] + (t[0] ?? "");
  }
  var ya = [
    {
      kind: "expression",
      name: "Integrate",
      latexTrigger: ["\\int"],
      parse: $e("Integrate"),
      serialize: ar("\\int"),
    },
    { kind: "expression", latexTrigger: ["\\iint"], parse: $e("Integrate", 2) },
    {
      kind: "expression",
      latexTrigger: ["\\iiint"],
      parse: $e("Integrate", 3),
    },
    {
      kind: "expression",
      name: "CircularIntegrate",
      latexTrigger: ["\\oint"],
      parse: $e("CircularIntegrate"),
      serialize: ar("\\oint"),
    },
    {
      kind: "expression",
      latexTrigger: ["\\oiint"],
      parse: $e("CircularIntegrate", 2),
    },
    {
      kind: "expression",
      latexTrigger: ["\\oiiint"],
      parse: $e("CircularIntegrate", 3),
    },
  ];
  function un(e) {
    let t = e.index;
    for (; e.match("\\cdot") || e.skipVisualSpace(););
    return e.matchAll(["\\mathrm", "<{>", "d", "<}>"]) ||
      e.matchAll(["\\operatorname", "<{>", "d", "<}>"]) ||
      e.match("d") ||
      e.match("\\differentialD")
      ? !0
      : ((e.index = t), !1);
  }
  function Ta(e) {
    let t = [...e],
      i = [];
    for (; t.length > 0;) {
      let r;
      if ((([t, r] = ka(t)), !r)) break;
      i.push(r);
    }
    return [t, i];
  }
  function ka(e) {
    if (e.length < 2) return [e, ""];
    let t = e[e.length - 2];
    if (t === "d" || t === "d_upright") {
      let i = k(e[e.length - 1]);
      if (i) return [e.slice(0, -2), i];
    }
    return [e, ""];
  }
  var ba = [
    {
      name: "Matrix",
      serialize: (e, t) => {
        let i = T(c(t, 1));
        return Ut(e, i, P(c(t, 2)), P(c(t, 3)));
      },
    },
    {
      name: "Vector",
      serialize: (e, t) => {
        let i = T(t);
        return Ut(
          e,
          i.map((r) => ["List", r]),
          P(c(t, 2)),
          P(c(t, 3)),
        );
      },
    },
    {
      kind: "environment",
      symbolTrigger: "pmatrix",
      parse: (e) => {
        let t = ae(e),
          [i, r] = se(e);
        return t ? [i, r, { str: "()" }, { str: t }] : [i, r];
      },
    },
    {
      kind: "environment",
      symbolTrigger: "bmatrix",
      parse: (e) => {
        let t = ae(e),
          [i, r] = se(e);
        return t ? [i, r, { str: "[]" }, { str: t }] : [i, r, { str: "[]" }];
      },
    },
    {
      kind: "environment",
      symbolTrigger: "Bmatrix",
      parse: (e) => {
        let t = ae(e),
          [i, r] = se(e);
        return t ? [i, r, { str: "{}" }, { str: t }] : [i, r, { str: "{}" }];
      },
    },
    {
      kind: "environment",
      symbolTrigger: "vmatrix",
      parse: (e) => {
        let t = ae(e),
          [i, r] = se(e);
        return t
          ? ["Determinant", [i, r, { str: t }]]
          : ["Determinant", [i, r]];
      },
    },
    {
      kind: "environment",
      symbolTrigger: "Vmatrix",
      parse: (e) => {
        let t = ae(e),
          [i, r] = se(e);
        return t ? ["Norm", [i, r, { str: t }]] : ["Norm", [i, r]];
      },
    },
    {
      kind: "environment",
      symbolTrigger: "smallmatrix",
      parse: (e) => {
        let t = ae(e),
          [i, r] = se(e);
        return t ? [i, r, { str: "()" }, { str: t }] : [i, r];
      },
    },
    {
      kind: "environment",
      symbolTrigger: "array",
      parse: (e) => {
        let t = ae(e, !1),
          [i, r] = se(e);
        return t ? [i, r, { str: ".." }, { str: t }] : [i, r, { str: ".." }];
      },
    },
    {
      kind: "environment",
      symbolTrigger: "matrix",
      parse: (e) => {
        let t = ae(e),
          [i, r] = se(e);
        return t ? [i, r, { str: ".." }, { str: t }] : [i, r, { str: ".." }];
      },
    },
    {
      kind: "environment",
      symbolTrigger: "matrix*",
      parse: (e) => {
        let t = ae(e),
          [i, r] = se(e);
        return t ? [i, r, { str: ".." }, { str: t }] : [i, r, { str: ".." }];
      },
    },
    {
      name: "ConjugateTranspose",
      kind: "postfix",
      latexTrigger: ["^", "\\star"],
    },
    {
      kind: "postfix",
      latexTrigger: ["^", "\\H"],
      parse: "ConjugateTranspose",
    },
    {
      kind: "postfix",
      latexTrigger: ["^", "\\dagger"],
      parse: (e, t) => ["ConjugateTranspose", t],
    },
    {
      kind: "postfix",
      latexTrigger: ["^", "\\ast"],
      parse: (e, t) => ["ConjugateTranspose", t],
    },
    {
      kind: "postfix",
      latexTrigger: ["^", "\\top"],
      parse: (e, t) => ["Transpose", t],
    },
    {
      kind: "postfix",
      latexTrigger: ["^", "\\intercal"],
      parse: (e, t) => ["Transpose", t],
    },
    { name: "Transpose", kind: "postfix", latexTrigger: ["^", "T"] },
    { name: "PseudoInverse", kind: "postfix", latexTrigger: ["^", "+"] },
    { name: "Inverse", serialize: (e, t) => e.serialize(c(t, 1)) + "^{-1}" },
    {
      name: "Trace",
      kind: "function",
      latexTrigger: "\\tr",
      arguments: "implicit",
      serialize: (e, t) => ze(e, t, "\\tr"),
    },
    {
      symbolTrigger: "tr",
      kind: "function",
      parse: "Trace",
      arguments: "implicit",
    },
    {
      name: "Kernel",
      kind: "function",
      latexTrigger: "\\ker",
      arguments: "implicit",
      serialize: (e, t) => ze(e, t, "\\ker"),
    },
    {
      symbolTrigger: "ker",
      kind: "function",
      parse: "Kernel",
      arguments: "implicit",
    },
    {
      name: "Dimension",
      kind: "function",
      latexTrigger: "\\dim",
      arguments: "implicit",
      serialize: (e, t) => ze(e, t, "\\dim"),
    },
    {
      symbolTrigger: "dim",
      kind: "function",
      parse: "Dimension",
      arguments: "implicit",
    },
    {
      name: "Degree",
      kind: "function",
      latexTrigger: "\\deg",
      arguments: "implicit",
      serialize: (e, t) => ze(e, t, "\\deg"),
    },
    {
      symbolTrigger: "deg",
      kind: "function",
      parse: "Degree",
      arguments: "implicit",
    },
    {
      name: "Hom",
      kind: "function",
      latexTrigger: "\\hom",
      arguments: "implicit",
      serialize: (e, t) => ze(e, t, "\\hom"),
    },
    {
      symbolTrigger: "hom",
      kind: "function",
      parse: "Hom",
      arguments: "implicit",
    },
    {
      name: "Determinant",
      kind: "function",
      latexTrigger: "\\det",
      arguments: "implicit",
      serialize: (e, t) => {
        let i = c(t, 1);
        if (f(i) === "Matrix") {
          let r = T(c(i, 1));
          return Ut(e, r, "||", P(c(i, 2)));
        }
        return ze(e, t, "\\det");
      },
    },
    {
      symbolTrigger: "det",
      kind: "function",
      parse: "Determinant",
      arguments: "implicit",
    },
    {
      name: "MatrixMultiply",
      serialize: (e, t) => {
        let i = e.serialize(c(t, 1)),
          r = e.serialize(c(t, 2));
        return `${i} \\cdot ${r}`;
      },
    },
    {
      name: "HadamardProduct",
      latexTrigger: ["\\odot"],
      kind: "infix",
      associativity: "any",
      precedence: H,
    },
  ];
  function se(e) {
    let t = e.parseTabular();
    return t
      ? ["Matrix", ["List", ...t.map((i) => ["List", ...i])]]
      : ["", null];
  }
  function ae(e, t = !0) {
    let i = e.parseStringGroup(t)?.trim();
    if (!i) return "";
    let r = "";
    for (let n of i)
      (n === "c" && (r += "="),
        n === "l" && (r += "<"),
        n === "r" && (r += ">"),
        n === "|" && (r += "|"),
        n === ":" && (r += ":"));
    return r;
  }
  function ze(e, t, i) {
    if (T(t).length !== 1) return `${i}${e.wrapArguments(t)}`;
    let r = c(t, 1),
      n = e.serialize(r);
    return typeof r == "string" || typeof r == "number"
      ? `${i} ${n}`
      : `${i}\\left(${n}\\right)`;
  }
  function Ut(e, t, i, r) {
    i ??= "()";
    let [n, s] = ["", ""];
    typeof i == "string" && i.length === 2 && ([n, s] = i);
    let a = "";
    if (r)
      for (let p of r)
        p === "<"
          ? (a += "l")
          : p === ">"
            ? (a += "r")
            : p === "="
              ? (a += "c")
              : p === "|"
                ? (a += "|")
                : p === ":" && (a += ":");
    let l = [];
    for (let p of t ?? []) {
      let g = [];
      for (let d of T(p)) g.push(e.serialize(d));
      l.push(g.join(" & "));
    }
    let o = l.join(`\\\\
`),
      u = a.length > 0 ? `[${a}]` : "";
    return y(
      n === "(" && s === ")"
        ? ["\\begin{pmatrix}", u, o, "\\end{pmatrix}"]
        : n === "[" && s === "]"
          ? ["\\begin{bmatrix}", u, o, "\\end{bmatrix}"]
          : n === "{" && s === "}"
            ? ["\\begin{Bmatrix}", u, o, "\\end{Bmatrix}"]
            : n === "|" && s === "|"
              ? ["\\begin{vmatrix}", u, o, "\\end{vmatrix}"]
              : n === "\u2016" && s === "\u2016"
                ? ["\\begin{Vmatrix}", u, o, "\\end{Vmatrix}"]
                : n === "{" && s === "."
                  ? ["\\begin{dcases}", u, o, "\\end{dcases}"]
                  : n === "." && s === "}"
                    ? ["\\begin{rcases}", u, o, "\\end{rcases}"]
                    : a || n !== "." || s !== "."
                      ? [
                          "\\left",
                          kt[n] ?? n,
                          "\\begin{array}",
                          `{${a}}`,
                          o,
                          "\\end{array}",
                          "\\right",
                          kt[s] ?? s,
                        ]
                      : ["\\begin{matrix}", o, "\\end{matrix}"],
    );
  }
  var va = [
      { name: "Mean", kind: "function", symbolTrigger: "mean" },
      { name: "Median", kind: "function", symbolTrigger: "median" },
      { name: "StandarDeviation", kind: "function", symbolTrigger: "stddev" },
      {
        latexTrigger: ["\\bar"],
        kind: "expression",
        parse: (e, t) => {
          let i = e.parseGroup() ?? e.parseToken();
          return !i || !k(i) ? null : ["Mean", i];
        },
      },
      { latexTrigger: "\\operatorname{var}", parse: "Variance" },
    ],
    gt = {
      Q: 1e30,
      R: 1e27,
      Y: 1e24,
      Z: 1e21,
      E: 1e18,
      P: 1e15,
      T: 1e12,
      G: 1e9,
      M: 1e6,
      k: 1e3,
      h: 100,
      da: 10,
      d: 0.1,
      c: 0.01,
      m: 0.001,
      µ: 1e-6,
      μ: 1e-6,
      n: 1e-9,
      p: 1e-12,
      f: 1e-15,
      a: 1e-18,
      z: 1e-21,
      y: 1e-24,
      r: 1e-27,
      q: 1e-30,
    },
    lr = new Set([
      "m",
      "g",
      "s",
      "A",
      "K",
      "mol",
      "cd",
      "Hz",
      "N",
      "Pa",
      "J",
      "W",
      "C",
      "V",
      "F",
      "ohm",
      "S",
      "Wb",
      "T",
      "H",
      "lm",
      "lx",
      "Bq",
      "Gy",
      "Sv",
      "kat",
      "eV",
      "L",
      "bar",
    ]),
    bt = {
      m: { dimension: [1, 0, 0, 0, 0, 0, 0], scale: 1 },
      kg: { dimension: [0, 1, 0, 0, 0, 0, 0], scale: 1 },
      g: { dimension: [0, 1, 0, 0, 0, 0, 0], scale: 0.001 },
      s: { dimension: [0, 0, 1, 0, 0, 0, 0], scale: 1 },
      A: { dimension: [0, 0, 0, 1, 0, 0, 0], scale: 1 },
      K: { dimension: [0, 0, 0, 0, 1, 0, 0], scale: 1 },
      mol: { dimension: [0, 0, 0, 0, 0, 1, 0], scale: 1 },
      cd: { dimension: [0, 0, 0, 0, 0, 0, 1], scale: 1 },
      Hz: { dimension: [0, 0, -1, 0, 0, 0, 0], scale: 1 },
      N: { dimension: [1, 1, -2, 0, 0, 0, 0], scale: 1 },
      Pa: { dimension: [-1, 1, -2, 0, 0, 0, 0], scale: 1 },
      J: { dimension: [2, 1, -2, 0, 0, 0, 0], scale: 1 },
      W: { dimension: [2, 1, -3, 0, 0, 0, 0], scale: 1 },
      C: { dimension: [0, 0, 1, 1, 0, 0, 0], scale: 1 },
      V: { dimension: [2, 1, -3, -1, 0, 0, 0], scale: 1 },
      F: { dimension: [-2, -1, 4, 2, 0, 0, 0], scale: 1 },
      ohm: { dimension: [2, 1, -3, -2, 0, 0, 0], scale: 1 },
      S: { dimension: [-2, -1, 3, 2, 0, 0, 0], scale: 1 },
      Wb: { dimension: [2, 1, -2, -1, 0, 0, 0], scale: 1 },
      T: { dimension: [0, 1, -2, -1, 0, 0, 0], scale: 1 },
      H: { dimension: [2, 1, -2, -2, 0, 0, 0], scale: 1 },
      lm: { dimension: [0, 0, 0, 0, 0, 0, 1], scale: 1 },
      lx: { dimension: [-2, 0, 0, 0, 0, 0, 1], scale: 1 },
      Bq: { dimension: [0, 0, -1, 0, 0, 0, 0], scale: 1 },
      Gy: { dimension: [2, 0, -2, 0, 0, 0, 0], scale: 1 },
      Sv: { dimension: [2, 0, -2, 0, 0, 0, 0], scale: 1 },
      kat: { dimension: [0, 0, -1, 0, 0, 1, 0], scale: 1 },
      degC: { dimension: [0, 0, 0, 0, 1, 0, 0], scale: 1, offset: 273.15 },
      degF: { dimension: [0, 0, 0, 0, 1, 0, 0], scale: 5 / 9, offset: 459.67 },
      min: { dimension: [0, 0, 1, 0, 0, 0, 0], scale: 60 },
      h: { dimension: [0, 0, 1, 0, 0, 0, 0], scale: 3600 },
      d: { dimension: [0, 0, 1, 0, 0, 0, 0], scale: 86400 },
      ha: { dimension: [2, 0, 0, 0, 0, 0, 0], scale: 1e4 },
      L: { dimension: [3, 0, 0, 0, 0, 0, 0], scale: 0.001 },
      t: { dimension: [0, 1, 0, 0, 0, 0, 0], scale: 1e3 },
      eV: { dimension: [2, 1, -2, 0, 0, 0, 0], scale: 1602176634e-28 },
      Da: { dimension: [0, 1, 0, 0, 0, 0, 0], scale: 16605390666e-37 },
      au: { dimension: [1, 0, 0, 0, 0, 0, 0], scale: 149597870700 },
      deg: { dimension: [0, 0, 0, 0, 0, 0, 0], scale: Math.PI / 180 },
      rad: { dimension: [0, 0, 0, 0, 0, 0, 0], scale: 1 },
      grad: { dimension: [0, 0, 0, 0, 0, 0, 0], scale: Math.PI / 200 },
      turn: { dimension: [0, 0, 0, 0, 0, 0, 0], scale: 2 * Math.PI },
      arcmin: { dimension: [0, 0, 0, 0, 0, 0, 0], scale: Math.PI / 10800 },
      arcsec: { dimension: [0, 0, 0, 0, 0, 0, 0], scale: Math.PI / 648e3 },
      percent: { dimension: [0, 0, 0, 0, 0, 0, 0], scale: 0.01 },
      ppm: { dimension: [0, 0, 0, 0, 0, 0, 0], scale: 1e-6 },
      dB: { dimension: [0, 0, 0, 0, 0, 0, 0], scale: 1 },
      Np: { dimension: [0, 0, 0, 0, 0, 0, 0], scale: 1 },
      in: { dimension: [1, 0, 0, 0, 0, 0, 0], scale: 0.0254 },
      ft: { dimension: [1, 0, 0, 0, 0, 0, 0], scale: 0.3048 },
      mi: { dimension: [1, 0, 0, 0, 0, 0, 0], scale: 1609.344 },
      lb: { dimension: [0, 1, 0, 0, 0, 0, 0], scale: 0.45359237 },
      oz: { dimension: [0, 1, 0, 0, 0, 0, 0], scale: 0.028349523125 },
      gal: { dimension: [3, 0, 0, 0, 0, 0, 0], scale: 0.003785411784 },
      atm: { dimension: [-1, 1, -2, 0, 0, 0, 0], scale: 101325 },
      bar: { dimension: [-1, 1, -2, 0, 0, 0, 0], scale: 1e5 },
      cal: { dimension: [2, 1, -2, 0, 0, 0, 0], scale: 4.184 },
      kWh: { dimension: [2, 1, -2, 0, 0, 0, 0], scale: 36e5 },
      Å: { dimension: [1, 0, 0, 0, 0, 0, 0], scale: 1e-10 },
    };
  function Na(e) {
    if (e.length > 2) {
      let t = e.slice(0, 2),
        i = e.slice(2);
      if (gt[t] !== void 0 && lr.has(i)) {
        let r = bt[i];
        if (r) return { prefixScale: gt[t], baseEntry: r };
      }
    }
    if (e.length > 1) {
      let t = e.slice(0, 1),
        i = e.slice(1);
      if (gt[t] !== void 0 && lr.has(i)) {
        let r = bt[i];
        if (r) return { prefixScale: gt[t], baseEntry: r };
      }
    }
    return null;
  }
  function Ia(e) {
    let t = bt[e];
    if (t) return t;
    let i = Na(e);
    return i
      ? {
          dimension: i.baseEntry.dimension,
          scale: i.prefixScale * i.baseEntry.scale,
        }
      : null;
  }
  function cn(e) {
    let t = Ia(e);
    return t ? t.dimension : null;
  }
  var ro = new Map(
    [
      "N",
      "J",
      "W",
      "Pa",
      "Hz",
      "C",
      "V",
      "F",
      "ohm",
      "S",
      "Wb",
      "T",
      "H",
      "lm",
      "lx",
      "Gy",
      "kat",
    ].map((e) => [bt[e].dimension.join(","), e]),
  );
  function Ea(e) {
    let t = e.indexOf("^");
    if (t === -1) return e;
    let i = e.slice(0, t),
      r = e.slice(t + 1),
      n = parseInt(r, 10);
    return isNaN(n) ? e : ["Power", i, n];
  }
  function Ke(e) {
    if (((e = e.trim()), e.length === 0)) return null;
    if (e[0] === "(" && e[e.length - 1] === ")") {
      let n = 0,
        s = !0;
      for (let a = 0; a < e.length - 1; a++)
        if (
          (e[a] === "(" ? n++ : e[a] === ")" && n--,
          n === 0 && a < e.length - 1)
        ) {
          s = !1;
          break;
        }
      if (s) return Ke(e.slice(1, -1));
    }
    let t = -1,
      i = [],
      r = 0;
    for (let n = 0; n < e.length; n++)
      e[n] === "("
        ? r++
        : e[n] === ")"
          ? r--
          : r === 0 &&
            (e[n] === "/" && t === -1 ? (t = n) : e[n] === "*" && i.push(n));
    if (t !== -1) {
      let n = e.slice(0, t).trim(),
        s = e.slice(t + 1).trim(),
        a = Ke(n),
        l = Ke(s);
      return !a || !l ? null : ["Divide", a, l];
    }
    if (i.length > 0) {
      let n = [],
        s = 0;
      for (let l of i) (n.push(e.slice(s, l).trim()), (s = l + 1));
      n.push(e.slice(s).trim());
      let a = n.filter((l) => l.length > 0).map((l) => Ke(l));
      return a.some((l) => l === null)
        ? null
        : a.length === 1
          ? a[0]
          : ["Multiply", ...a];
    }
    return e[0] === "(" ? null : Ea(e);
  }
  function Sa(e) {
    return (
      (e = e.trim()),
      e.length === 0 ? null : /[/*^()]/.test(e) ? Ke(e) : e
    );
  }
  function pn(e) {
    if (!e.match("<{>")) return null;
    let t = "",
      i = 0;
    for (; !e.atEnd;) {
      let r = e.peek;
      if (r === "<}>" && i === 0) return (e.nextToken(), t);
      if (r === "<}>") {
        (i--, e.nextToken());
        continue;
      }
      if (r === "<{>") {
        (i++, e.nextToken());
        continue;
      }
      if (r === "<space>") {
        e.nextToken();
        continue;
      }
      if (r === "\\cdot") {
        ((t += "*"), e.nextToken());
        continue;
      }
      if (r === "^") {
        ((t += "^"), e.nextToken());
        continue;
      }
      ((t += r), e.nextToken());
    }
    return null;
  }
  var Aa = new Set(["d"]);
  function hn(e) {
    if (!e || e.length === 0 || Aa.has(e)) return null;
    if (cn(e) !== null) return e;
    if (/[/*^]/.test(e))
      try {
        let t = Sa(e);
        if (t !== null && oi(t)) return t;
      } catch {
        return null;
      }
    return null;
  }
  function oi(e) {
    if (typeof e == "string") return cn(e) !== null;
    if (!Array.isArray(e)) return !1;
    let t = e[0];
    return t === "Multiply" || t === "Divide"
      ? e.slice(1).every((i) => oi(i))
      : t === "Power"
        ? oi(e[1])
        : !1;
  }
  var or = (e) => {
    let t = e.index,
      i = pn(e);
    if (i === null) return ((e.index = t), null);
    let r = hn(i);
    return r === null ? ((e.index = t), null) : ["__unit__", r];
  };
  function ke(e) {
    let t = k(e);
    if (t !== null) return t;
    if (typeof e == "number") return String(e);
    let i = f(e);
    if (!i) return "";
    if (i === "Divide") {
      let r = c(e, 1),
        n = c(e, 2);
      return `${ke(r)}/${ke(n)}`;
    }
    if (i === "Multiply") {
      let r = [];
      if (Array.isArray(e)) for (let n = 1; n < e.length; n++) r.push(ke(e[n]));
      return r.join("\\cdot ");
    }
    if (i === "Power") {
      let r = c(e, 1),
        n = c(e, 2),
        s = typeof n == "number" ? String(n) : (k(n) ?? String(n));
      return `${ke(r)}^{${s}}`;
    }
    if (i === "Square") {
      let r = c(e, 1);
      return `${ke(r)}^{2}`;
    }
    return "";
  }
  function ur(e) {
    let t = e.parseGroup();
    if (t === null) return null;
    let i = gn(e);
    return i === null ? null : ["Quantity", t, i];
  }
  function cr(e) {
    return gn(e);
  }
  function gn(e) {
    let t = e.index,
      i = pn(e);
    if (i === null) return ((e.index = t), null);
    let r = hn(i);
    return r === null ? ((e.index = t), null) : r;
  }
  var wa = [
      { latexTrigger: "\\mathrm", kind: "expression", parse: or },
      { latexTrigger: "\\text", kind: "expression", parse: or },
      { latexTrigger: "\\qty", parse: ur },
      { latexTrigger: "\\SI", parse: ur },
      { latexTrigger: "\\unit", parse: cr },
      { latexTrigger: "\\si", parse: cr },
      {
        name: "Quantity",
        serialize: (e, t) => {
          let i = c(t, 1),
            r = c(t, 2);
          if (i === null || r === null) return "";
          let n = k(r),
            s = n === "deg" || n === "rad" || n === "arcmin" || n === "arcsec",
            a = e.options;
          if (
            s &&
            (a.dmsFormat ||
              (a.angleNormalization && a.angleNormalization !== "none"))
          ) {
            let u = S(i);
            if (u === null) {
              let g = e.serialize(i),
                d = ke(r);
              return y([g, "\\,", `\\mathrm{${d}}`]);
            }
            let p = u;
            return (
              n === "rad"
                ? (p = (p * 180) / Math.PI)
                : n === "arcmin"
                  ? (p = p / 60)
                  : n === "arcsec" && (p = p / 3600),
              a.angleNormalization &&
                a.angleNormalization !== "none" &&
                (p = an(p, a.angleNormalization)),
              a.dmsFormat ? ln(p) : `${p}\xB0`
            );
          }
          let l = e.serialize(i),
            o = ke(r);
          return y([l, "\\,", `\\mathrm{${o}}`]);
        },
      },
    ],
    $a = [
      "pt",
      "em",
      "mu",
      "ex",
      "mm",
      "cm",
      "in",
      "bp",
      "sp",
      "dd",
      "cc",
      "pc",
      "nc",
      "nd",
    ];
  function pr(e) {
    for (
      e.skipSpace(), (e.peek === "-" || e.peek === "+") && e.nextToken();
      /^[\d.]$/.test(e.peek);
    )
      e.nextToken();
    for (let t of $a) if (e.matchAll([...t])) return;
  }
  function za(e) {
    return (t) => {
      let i = t.parseGroup();
      return i === null ? [e] : [e, i];
    };
  }
  function U(e, t) {
    return {
      name: e,
      latexTrigger: [t],
      parse: za(e),
      serialize: (i, r) => {
        let n = c(r, 1);
        return n === null ? t : `${t}{${i.serialize(n)}}`;
      },
    };
  }
  function dt(e) {
    return (t) => {
      let i = t.parseExpression();
      return i !== null && !M(i)
        ? ["Annotated", i, { dict: { mathStyle: e } }]
        : "Nothing";
    };
  }
  function ie(e) {
    return (t) => {
      let i = t.parseExpression();
      return i !== null && !M(i)
        ? ["Annotated", i, { dict: { size: e } }]
        : "Nothing";
    };
  }
  var _a = [
      {
        name: "Overscript",
        latexTrigger: ["\\overset"],
        kind: "infix",
        precedence: 700,
      },
      {
        name: "Underscript",
        latexTrigger: ["\\underset"],
        kind: "infix",
        precedence: 700,
      },
      {
        name: "Increment",
        latexTrigger: ["+", "+"],
        kind: "postfix",
        precedence: 880,
        parse: (e, t) => (k(t) === null ? null : ["Increment", t]),
      },
      {
        name: "Decrement",
        latexTrigger: ["-", "-"],
        kind: "postfix",
        precedence: 880,
        parse: (e, t) => (k(t) === null ? null : ["Decrement", t]),
      },
      {
        name: "PreIncrement",
        latexTrigger: ["+", "+"],
        kind: "prefix",
        precedence: 880,
        parse: (e, t) => {
          let i = e.parseExpression(t);
          return k(i) === null ? null : ["PreIncrement", i];
        },
      },
      {
        name: "PreDecrement",
        latexTrigger: ["-", "-"],
        kind: "prefix",
        precedence: 880,
        parse: (e, t) => {
          let i = e.parseExpression(t);
          return k(i) === null ? null : ["PreDecrement", i];
        },
      },
      {
        name: "Ring",
        latexTrigger: ["\\circ"],
        kind: "infix",
        precedence: 265,
      },
      {
        name: "StringJoin",
        latexTrigger: ["\\lt", "\\gt"],
        kind: "infix",
        precedence: 780,
      },
      {
        name: "Starstar",
        latexTrigger: ["\\star", "\\star"],
        kind: "infix",
        precedence: 780,
      },
      {
        name: "PartialDerivative",
        latexTrigger: ["\\partial"],
        kind: "prefix",
        parse: (e) => {
          let t = !1,
            i = "Nothing",
            r = "Nothing";
          for (; !t;)
            (e.skipSpace(),
              e.match("_")
                ? (r = e.parseGroup() ?? e.parseToken())
                : e.match("^")
                  ? (i = e.parseGroup() ?? e.parseToken())
                  : (t = !0));
          let n = St(r);
          if ((n && (r = ["List", ...n]), r === null || i === null))
            return null;
          let s = e.parseGroup() ?? "Nothing";
          if (!M(s)) {
            let a = e.parseArguments() ?? ["Nothing"];
            s = [s, ...a];
          }
          return ["PartialDerivative", s, r, i];
        },
        serialize: (e, t) => {
          let i = "\\partial",
            r = c(t, 1),
            n = c(t, 2),
            s = c(t, 3);
          return (
            n !== null &&
              n !== "Nothing" &&
              (f(n) === "List"
                ? (i += "_{" + e.serialize(["Sequence", ...T(n)]) + "}")
                : (i += "_{" + e.serialize(n) + "}")),
            s !== null && s !== "Nothing" && (i += "^{" + e.serialize(s) + "}"),
            r !== null && r !== "Nothing" && (i += e.serialize(r)),
            i
          );
        },
        precedence: 740,
      },
      U("OverBar", "\\overline"),
      U("UnderBar", "\\underline"),
      U("OverVector", "\\vec"),
      U("OverTilde", "\\tilde"),
      U("OverHat", "\\hat"),
      U("OverRightArrow", "\\overrightarrow"),
      U("OverLeftArrow", "\\overleftarrow"),
      U("OverRightDoubleArrow", "\\Overrightarrow"),
      U("OverLeftHarpoon", "\\overleftharpoon"),
      U("OverRightHarpoon", "\\overrightharpoon"),
      U("OverLeftRightArrow", "\\overleftrightarrow"),
      U("OverBrace", "\\overbrace"),
      U("OverLineSegment", "\\overlinesegment"),
      U("OverGroup", "\\overgroup"),
      {
        latexTrigger: ["\\textcolor"],
        parse: (e) => {
          let t = e.index,
            i = e.parseStringGroup(),
            r = e.parseGroup();
          return i !== null
            ? r !== null
              ? ["Annotated", r, { dict: { color: i } }]
              : "Nothing"
            : ((e.index = t), "Nothing");
        },
      },
      {
        latexTrigger: ["\\colorbox"],
        parse: (e) => {
          let t = e.index,
            i = e.parseStringGroup(),
            r = e.parseGroup();
          return i !== null
            ? r !== null
              ? ["Annotated", r, { dict: { backgroundColor: i } }]
              : "Nothing"
            : ((e.index = t), "Nothing");
        },
      },
      {
        latexTrigger: ["\\boxed"],
        parse: (e) => {
          let t = e.parseGroup();
          return t !== null
            ? ["Annotated", t, { dict: { border: !0 } }]
            : "Nothing";
        },
      },
      { latexTrigger: ["\\displaystyle"], parse: dt("normal") },
      { latexTrigger: ["\\textstyle"], parse: dt("compact") },
      { latexTrigger: ["\\scriptstyle"], parse: dt("script") },
      { latexTrigger: ["\\scriptscriptstyle"], parse: dt("scriptscript") },
      {
        latexTrigger: ["\\color"],
        parse: (e) => {
          let t = e.parseStringGroup();
          if (t !== null) {
            let i = e.parseExpression();
            if (i !== null && !M(i))
              return ["Annotated", i, { dict: { color: t } }];
          }
          return "Nothing";
        },
      },
      { latexTrigger: ["\\tiny"], parse: ie(1) },
      { latexTrigger: ["\\scriptsize"], parse: ie(2) },
      { latexTrigger: ["\\footnotesize"], parse: ie(3) },
      { latexTrigger: ["\\small"], parse: ie(4) },
      { latexTrigger: ["\\normalsize"], parse: ie(5) },
      { latexTrigger: ["\\large"], parse: ie(6) },
      { latexTrigger: ["\\Large"], parse: ie(7) },
      { latexTrigger: ["\\LARGE"], parse: ie(8) },
      { latexTrigger: ["\\huge"], parse: ie(9) },
      { latexTrigger: ["\\Huge"], parse: ie(10) },
      {
        name: "Annotated",
        serialize: (e, t) => {
          let i = e.serialize(c(t, 1)),
            r = Fr(c(t, 2));
          if (r == null) return i;
          r.dict.mathStyle === "normal"
            ? (i = y(["{\\displaystyle", i, "}"]))
            : r.dict.mathStyle === "compact"
              ? (i = y(["{\\textstyle", i, "}"]))
              : r.dict.mathStyle === "script"
                ? (i = y(["{\\scriptstyle", i, "}"]))
                : r.dict.mathStyle === "scriptscript" &&
                  (i = y(["{\\scriptscriptstyle", i, "}"]));
          let n = r.dict.size;
          return (
            n !== null &&
              n >= 1 &&
              n <= 10 &&
              (i = y([
                "{",
                {
                  1: "\\tiny",
                  2: "\\scriptsize",
                  3: "\\footnotesize",
                  4: "\\small",
                  5: "\\normalsize",
                  6: "\\large",
                  7: "\\Large",
                  8: "\\LARGE",
                  9: "\\huge",
                  10: "\\Huge",
                }[n],
                i,
                "}",
              ])),
            r.dict.fontFamily === "monospace"
              ? (i = y(["\\texttt{", i, "}"]))
              : r.dict.fontFamily === "sans-serif" &&
                (i = y(["\\textsf{", i, "}"])),
            r.dict.fontWeight === "bold" && (i = y(["\\textbf{", i, "}"])),
            r.dict.fontStyle === "italic"
              ? (i = y(["\\textit{", i, "}"]))
              : r.dict.fontStyle === "normal" && (i = y(["\\textup{", i, "}"])),
            r.dict.color &&
              (i = y(["\\textcolor{", r.dict.color, "}{", i, "}"])),
            r.dict.backgroundColor &&
              (i = y(["\\colorbox{", r.dict.backgroundColor, "}{", i, "}"])),
            r.dict.border === !0 && (i = y(["\\boxed{", i, "}"])),
            i
          );
        },
      },
      { latexTrigger: ["\\!"], parse: () => ["HorizontalSpacing", -3] },
      { latexTrigger: ["\\ "], parse: () => ["HorizontalSpacing", 6] },
      { latexTrigger: ["\\:"], parse: () => ["HorizontalSpacing", 4] },
      { latexTrigger: ["\\enskip"], parse: () => ["HorizontalSpacing", 9] },
      { latexTrigger: ["\\quad"], parse: () => ["HorizontalSpacing", 18] },
      { latexTrigger: ["\\qquad"], parse: () => ["HorizontalSpacing", 36] },
      { latexTrigger: ["\\,"], parse: () => ["HorizontalSpacing", 3] },
      { latexTrigger: ["\\;"], parse: () => ["HorizontalSpacing", 5] },
      { latexTrigger: ["\\enspace"], parse: () => ["HorizontalSpacing", 9] },
      {
        latexTrigger: ["\\hspace"],
        parse: (e) => (
          e.peek === "*" && e.nextToken(),
          e.parseStringGroup(),
          ["HorizontalSpacing", 0]
        ),
      },
      {
        latexTrigger: ["\\hskip"],
        parse: (e) => (pr(e), ["HorizontalSpacing", 0]),
      },
      {
        latexTrigger: ["\\kern"],
        parse: (e) => (pr(e), ["HorizontalSpacing", 0]),
      },
      {
        latexTrigger: ["\\phantom"],
        parse: (e) => (e.parseGroup(), "Nothing"),
      },
      {
        latexTrigger: ["\\vphantom"],
        parse: (e) => (e.parseGroup(), "Nothing"),
      },
      {
        latexTrigger: ["\\hphantom"],
        parse: (e) => (e.parseGroup(), "Nothing"),
      },
      {
        latexTrigger: ["\\placeholder"],
        parse: (e) => (e.parseOptionalGroup(), e.parseGroup() ?? "Nothing"),
      },
      { latexTrigger: ["\\smash"], parse: (e) => (e.parseGroup(), "Nothing") },
      { latexTrigger: ["\\strut"], parse: (e) => "Nothing" },
      { latexTrigger: ["\\mathstrut"], parse: (e) => "Nothing" },
      {
        name: "HorizontalSpacing",
        serialize: (e, t) => {
          if (c(t, 2) !== null) {
            let r = P(c(t, 2)),
              n = e.serialize(c(t, 1));
            return r === "bin"
              ? `\\mathbin{${n}}`
              : r === "op"
                ? `\\mathop{${n}}`
                : r === "rel"
                  ? `\\mathrel{${n}}`
                  : r === "ord"
                    ? `\\mathord{${n}}`
                    : r === "open"
                      ? `\\mathopen{${n}}`
                      : r === "close"
                        ? `\\mathclose{${n}}`
                        : r === "punct"
                          ? `\\mathpunct{${n}}`
                          : r === "inner"
                            ? `\\mathinner{${n}}`
                            : n;
          }
          let i = S(c(t, 1));
          return i === null
            ? ""
            : ({
                "-3": "\\!",
                6: "\\ ",
                3: "\\,",
                4: "\\:",
                5: "\\;",
                9: "\\enspace",
                18: "\\quad",
                36: "\\qquad",
              }[i] ?? "");
        },
      },
      { latexTrigger: "\\operatorname{count}", parse: "Length" },
      { latexTrigger: "\\operatorname{random}", parse: "Random" },
      { latexTrigger: "\\operatorname{shuffle}", parse: "Shuffle" },
      { latexTrigger: "\\operatorname{repeat}", parse: "Repeat" },
      { latexTrigger: "\\operatorname{join}", parse: "Join" },
      { latexTrigger: "\\operatorname{range}", parse: "Range" },
      {
        name: "Triangle",
        latexTrigger: ["\\operatorname{triangle}"],
        kind: "function",
        serialize: (e, t) => "\\operatorname{triangle}" + e.wrapArguments(t),
      },
      {
        name: "GeometricVector",
        latexTrigger: ["\\operatorname{vector}"],
        kind: "function",
        serialize: (e, t) => "\\operatorname{vector}" + e.wrapArguments(t),
      },
      {
        name: "Sphere",
        latexTrigger: ["\\operatorname{sphere}"],
        kind: "function",
        serialize: (e, t) => "\\operatorname{sphere}" + e.wrapArguments(t),
      },
      {
        name: "Segment",
        latexTrigger: ["\\operatorname{segment}"],
        kind: "function",
        serialize: (e, t) => "\\operatorname{segment}" + e.wrapArguments(t),
      },
    ],
    Pa = [
      {
        name: "Rgb",
        latexTrigger: ["\\operatorname{rgb}"],
        kind: "function",
        serialize: (e, t) => "\\operatorname{rgb}" + e.wrapArguments(t),
      },
      {
        name: "Hsv",
        latexTrigger: ["\\operatorname{hsv}"],
        kind: "function",
        serialize: (e, t) => "\\operatorname{hsv}" + e.wrapArguments(t),
      },
      {
        name: "Hsl",
        latexTrigger: ["\\operatorname{hsl}"],
        kind: "function",
        serialize: (e, t) => "\\operatorname{hsl}" + e.wrapArguments(t),
      },
      {
        name: "Oklab",
        latexTrigger: ["\\operatorname{oklab}"],
        kind: "function",
        serialize: (e, t) => "\\operatorname{oklab}" + e.wrapArguments(t),
      },
      {
        name: "Oklch",
        latexTrigger: ["\\operatorname{oklch}"],
        kind: "function",
        serialize: (e, t) => "\\operatorname{oklch}" + e.wrapArguments(t),
      },
      {
        name: "AsRgb",
        latexTrigger: ["\\operatorname{asRgb}"],
        kind: "function",
        serialize: (e, t) => "\\operatorname{asRgb}" + e.wrapArguments(t),
      },
      {
        name: "AsHsv",
        latexTrigger: ["\\operatorname{asHsv}"],
        kind: "function",
        serialize: (e, t) => "\\operatorname{asHsv}" + e.wrapArguments(t),
      },
      {
        name: "AsHsl",
        latexTrigger: ["\\operatorname{asHsl}"],
        kind: "function",
        serialize: (e, t) => "\\operatorname{asHsl}" + e.wrapArguments(t),
      },
      {
        name: "AsOklab",
        latexTrigger: ["\\operatorname{asOklab}"],
        kind: "function",
        serialize: (e, t) => "\\operatorname{asOklab}" + e.wrapArguments(t),
      },
      {
        name: "AsOklch",
        latexTrigger: ["\\operatorname{asOklch}"],
        kind: "function",
        serialize: (e, t) => "\\operatorname{asOklch}" + e.wrapArguments(t),
      },
      {
        name: "ColorDelta",
        latexTrigger: ["\\operatorname{colorDelta}"],
        kind: "function",
        serialize: (e, t) => "\\operatorname{colorDelta}" + e.wrapArguments(t),
      },
    ],
    Fa = [
      { name: "Mu0", kind: "symbol", latexTrigger: "\\mu_0" },
      {
        name: "VacuumPermittivity",
        kind: "symbol",
        latexTrigger: "\\varepsilon_0",
      },
    ],
    Ma = [
      ...Ms,
      ...Vs,
      ...js,
      ...$s,
      ...Zs,
      ...ri,
      ...aa,
      ...ga,
      ...da,
      ...ya,
      ...ba,
      ...va,
      ...wa,
      ..._a,
      ...Fa,
      ...Pa,
    ],
    Yt;
  function dn(e) {
    if (!Yt) {
      let t = `^[${["Zyyy", "Zinh", "Arab", "Armn", "Beng", "Bopo", "Cyrl", "Deva", "Ethi", "Geor", "Grek", "Gujr", "Guru", "Hang", "Hani", "Hebr", "Hira", "Kana", "Knda", "Khmr", "Laoo", "Latn", "Mlym", "Mymr", "Orya", "Sinh", "Taml", "Telu", "Thaa", "Thai", "Tibt"].map((i) => `\\p{Script=${i}}`).join("")}]*$`;
      Yt = new RegExp(t, "u");
    }
    return Yt.test(e);
  }
  function Ie(e) {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(e) || st.test(e)
      ? !0
      : dn(e)
        ? new RegExp("^[\\p{XIDS}_]\\p{XIDC}*$", "u").test(e)
        : !1;
  }
  var Oa = "\\u{FE0F}",
    Da = "\\u{20E3}",
    Ra = "\\u{200D}",
    Ca = "\\p{RI}\\p{RI}",
    Ba = "(?:[\\u{E0020}-\\u{E007E}]+\\u{E007F})",
    hr = `(?:\\p{EMod}|${Oa}${Da}?|${Ba})`,
    qa = "(?:(?=\\P{XIDC})(?=[^\\x23\\x2a\\x30-\\x39])\\p{Emoji})",
    gr = `(?:${qa}${hr}*|\\p{Emoji}${hr}+|${Ca})`,
    fn = `(?:${gr})(${Ra}${gr})*`,
    La = new RegExp(`(?:${fn})+`, "u"),
    st = new RegExp(`^(?:${fn})+$`, "u");
  function dr(e) {
    return typeof e != "string"
      ? "not-a-string"
      : e === ""
        ? "empty-string"
        : e.normalize() !== e
          ? "expected-nfc"
          : /[\u200E\u200F\u2066-\u2069\u202A-\u202E]/.test(e)
            ? "unexpected-bidi-marker"
            : st.test(e)
              ? "valid"
              : new RegExp("\\p{XIDC}", "u").test(e) && La.test(e)
                ? "unexpected-mixed-emoji"
                : dn(e)
                  ? Ie(e)
                    ? "valid"
                    : Ie(e[0])
                      ? "invalid-char"
                      : "invalid-first-char"
                  : "unexpected-script";
  }
  var fr = {
    "(": ["\\lparen", "("],
    ")": ["\\rparen", ")"],
    "[": ["\\lbrack", "\\[", "["],
    "]": ["\\rbrack", "\\]", "]"],
    "<": ["<", "\\langle"],
    ">": [">", "\\rangle"],
    "{": ["\\{", "\\lbrace"],
    "}": ["\\}", "\\rbrace"],
    ":": [":", "\\colon"],
    "|": ["|", "\\|", "\\lvert", "\\rvert"],
    "||": ["||", "\\Vert", "\\lVert", "\\rVert"],
  };
  function Ga(e) {
    return "kind" in e && e.kind === "matchfix";
  }
  var mr = {
    "(": "(",
    ")": ")",
    "[": "\\lbrack",
    "]": "\\rbrack",
    "{": "\\lbrace",
    "}": "\\rbrace",
    "<": "\\langle",
    ">": "\\rangle",
    "|": "\\vert",
    "||": "\\Vert",
    "\\lceil": "\\lceil",
    "\\lfloor": "\\lfloor",
    "\\rceil": "\\rceil",
    "\\rfloor": "\\rfloor",
  };
  function _e(e, t, i) {
    let r = e.get(t);
    r ? r.unshift(i) : e.set(t, [i]);
  }
  function mn(e, t, i) {
    let r = ja(t, i);
    if (r === null) return;
    let n = "kind" in t ? t.kind : "expression",
      s = r.latexTrigger;
    typeof s == "string" && (e.lookahead = Math.max(e.lookahead, Rr(s)));
    let a = j(s ?? "");
    if (
      a.length === 2 &&
      /[_^]/.test(a[0]) &&
      a[1] !== "<{>" &&
      n !== "function" &&
      n !== "environment" &&
      n !== "matchfix"
    ) {
      let l = t.parse;
      (!l &&
        t.name &&
        (n === "postfix" || n === "prefix"
          ? (l = (o, u) => [t.name, u])
          : (l = t.name)),
        mn(
          e,
          {
            ...t,
            kind: n,
            name: void 0,
            serialize: void 0,
            parse: l,
            latexTrigger: [a[0], "<{>", a[1], "<}>"],
          },
          i,
        ));
    }
    if ((e.defs.push(r), Ga(r))) {
      let l = r.openTrigger,
        o = [];
      if (typeof l == "string") {
        let g = fr[l];
        (g ? o.push(...g) : o.push(l), l === "||" && o.push("|"));
      } else Array.isArray(l) && l.length > 0 && o.push(l[0]);
      let u = r.closeTrigger,
        p = new Set();
      if (typeof u == "string") {
        let g = fr[u];
        if (g) for (let d of g) p.add(d);
        else p.add(u);
        u === "||" && p.add("|");
      } else Array.isArray(u) && u.length > 0 && p.add(u[0]);
      r.closeTokens = p;
      for (let g of o) {
        let d = e.matchfixByOpen.get(g);
        d ? d.unshift(r) : e.matchfixByOpen.set(g, [r]);
      }
    }
    if (r.latexTrigger && r.latexTrigger !== "") {
      let l = r.latexTrigger;
      switch (r.kind) {
        case "infix":
          _e(e.infixByTrigger, l, r);
          break;
        case "prefix":
          _e(e.prefixByTrigger, l, r);
          break;
        case "postfix":
          _e(e.postfixByTrigger, l, r);
          break;
        case "function":
          _e(e.functionByTrigger, l, r);
          break;
        case "symbol":
          _e(e.symbolByTrigger, l, r);
          break;
        case "expression":
          _e(e.expressionByTrigger, l, r);
          break;
        case "environment":
        case "matchfix":
          break;
      }
    }
    r.name !== void 0 &&
      (e.ids.has(r.name) &&
        i({
          severity: "warning",
          message: [
            "invalid-dictionary-entry",
            r.name,
            "Duplicate definition. The name (MathJSON symbol) must be unique, but triggers can be shared by multiple definitions.",
          ],
        }),
      e.ids.set(r.name, r));
  }
  function Va(e, t) {
    let i = {
      lookahead: 1,
      ids: new Map(),
      defs: [],
      matchfixByOpen: new Map(),
      infixByTrigger: new Map(),
      prefixByTrigger: new Map(),
      postfixByTrigger: new Map(),
      functionByTrigger: new Map(),
      symbolByTrigger: new Map(),
      expressionByTrigger: new Map(),
      operatorByTrigger: new Map(),
      universalDefs: new Map(),
      symbolTriggerDefs: new Map(),
    };
    for (let n of e) mn(i, n, t);
    for (let n = i.defs.length - 1; n >= 0; n--) {
      let s = i.defs[n],
        a =
          s.kind === "infix" || s.kind === "prefix" || s.kind === "postfix"
            ? [s.kind, "operator"]
            : [s.kind];
      for (let l of a) {
        if (s.latexTrigger === "") {
          let o = i.universalDefs.get(l);
          o ? o.push(s) : i.universalDefs.set(l, [s]);
        }
        if (s.symbolTrigger) {
          let o = i.symbolTriggerDefs.get(l);
          o || ((o = new Map()), i.symbolTriggerDefs.set(l, o));
          let u = o.get(s.symbolTrigger);
          u ? u.push(s) : o.set(s.symbolTrigger, [s]);
        }
        if (l === "operator" && s.latexTrigger && s.latexTrigger !== "") {
          let o = s,
            u = i.operatorByTrigger.get(s.latexTrigger);
          u ? u.push(o) : i.operatorByTrigger.set(s.latexTrigger, [o]);
        }
      }
    }
    let r = {
      "(": [")", "\\rparen"],
      "\\lparen": [")", "\\rparen"],
      "[": ["]", "\\rbrack", "\\]"],
      "\\lbrack": ["]", "\\rbrack", "\\]"],
      "\\[": ["]", "\\rbrack", "\\]"],
      "{": ["}", "\\rbrace"],
      "\\lbrace": ["}", "\\rbrace"],
      "\\{": ["}", "\\rbrace"],
      "<": [">", "\\rangle"],
      "\\langle": [">", "\\rangle"],
      "|": ["|", "\\|", "\\rvert", "\\lvert"],
      "\\|": ["|", "\\|", "\\rvert", "\\lvert"],
      "\\lvert": ["|", "\\|", "\\rvert", "\\lvert"],
      "||": ["||", "\\Vert", "\\lVert", "\\rVert"],
      "\\Vert": ["||", "\\Vert", "\\lVert", "\\rVert"],
      "\\lVert": ["||", "\\Vert", "\\lVert", "\\rVert"],
    };
    for (let [n, s] of i.matchfixByOpen.entries())
      i.matchfixByOpen.set(
        n,
        s.sort((a, l) => {
          let o = (w) => (typeof w == "string" ? w : w[0] || ""),
            u = (w) => (typeof w == "string" ? w : w[0] || ""),
            p = o(a.openTrigger),
            g = u(a.closeTrigger),
            d = r[p]?.includes(g) ?? !1,
            m = o(l.openTrigger),
            b = u(l.closeTrigger),
            I = r[m]?.includes(b) ?? !1;
          return d && !I ? -1 : !d && I ? 1 : 0;
        }),
      );
    return i;
  }
  function ja(e, t) {
    if (!Ha(e, t)) return null;
    let i = { kind: "kind" in e ? e.kind : "expression" },
      r = null;
    "latexTrigger" in e &&
      (typeof e.latexTrigger == "string"
        ? (r = j(e.latexTrigger))
        : (r = e.latexTrigger));
    let n = null;
    ("symbolTrigger" in e && (n = e.symbolTrigger),
      r !== null && (i.latexTrigger = ue(r)),
      n !== null && (i.symbolTrigger = n),
      e.name && ((i.name = e.name), (i.serialize = Ua(e, r, n))),
      i.kind === "matchfix" &&
        yt(e) &&
        ((i.openTrigger = e.openTrigger), (i.closeTrigger = e.closeTrigger)),
      i.kind === "symbol" && Hn(e) && (i.precedence = e.precedence ?? 1e4),
      i.kind === "expression" && Yn(e) && (i.precedence = e.precedence ?? 1e4),
      (i.kind === "prefix" || i.kind === "postfix") &&
        (Or(e) || Dr(e)) &&
        (r && (r[0] === "^" || r[0] === "_")
          ? ((i.precedence = 720), e.precedence)
          : (i.precedence = e.precedence ?? 1e4)),
      i.kind === "infix" &&
        Mr(e) &&
        (!r ||
          (r[0] !== "^" && r[0] !== "_") ||
          !e.associativity ||
          e.associativity,
        (i.associativity = e.associativity ?? "none"),
        (i.precedence = e.precedence ?? 1e4)));
    let s = Ya(e, r, n);
    return (
      s && (i.parse = s),
      i.kind === "function" && "arguments" in e && (i.arguments = e.arguments),
      i
    );
  }
  function Za(e, t) {
    if (!t) return "";
    if (f(t) !== "List") return e.serialize(t);
    let i = T(t);
    return i.length === 0
      ? ""
      : i.every((r) => f(r) === "List")
        ? i.map((r) =>
            T(r)
              .map((n) => e.serialize(n))
              .join(" & "),
          ).join(` \\\\
`)
        : e.serialize(t);
  }
  function Ua(e, t, i) {
    if (typeof e.serialize == "function") return e.serialize;
    let r = e,
      n = r.kind ?? "expression";
    if (n === "environment") {
      let o = r.symbolTrigger ?? e.name ?? "unknown";
      return (u, p) => {
        let g = c(p, 1);
        return y([`\\begin{${o}}`, Za(u, g), `\\end{${o}}`]);
      };
    }
    if (yt(e)) {
      let o =
          typeof e.openTrigger == "string"
            ? mr[e.openTrigger]
            : ue(e.openTrigger),
        u =
          typeof e.closeTrigger == "string"
            ? mr[e.closeTrigger]
            : ue(e.closeTrigger);
      return (p, g) => {
        let d = p.groupStyle(g, p.level + 1),
          m = p.serialize(c(g, 1));
        return y(
          d === "scaled"
            ? [`\\left${o}`, m, `\\right${u}`]
            : d === "big"
              ? [`\\Bigl${o}`, m, `\\Bigr${u}`]
              : [o, m, u],
        );
      };
    }
    let s = e.serialize;
    if ((s === void 0 && t && (s = ue(t)), s)) {
      let o = r.precedence ?? 1e4;
      return n === "postfix"
        ? (u, p) => y([u.wrap(c(p, 1), o), s])
        : n === "prefix"
          ? (u, p) => y([s, u.wrap(c(p, 1), o)])
          : n === "infix"
            ? (u, p) => {
                let g = B(p);
                if (g === 0) return "";
                let d = r.precedence ?? 1e4;
                return y(
                  T(p).flatMap((m, b) => {
                    let I = u.wrap(m, d + 1);
                    return b < g - 1 ? [I, s] : [I];
                  }),
                );
              }
            : (u, p) => (f(p) ? y([s, u.wrapArguments(p)]) : s);
    }
    let a = i ?? e.name ?? "unknown",
      l = r.precedence ?? 1e4;
    return n === "postfix"
      ? (o, u) => y([o.wrap(c(u, 1), l), o.serializeSymbol(a)])
      : n === "prefix"
        ? (o, u) => y([o.serializeSymbol(a), o.wrap(c(u, 1), l)])
        : n === "infix"
          ? (o, u) =>
              y([
                o.wrap(c(u, 1), l + 1),
                o.serializeSymbol(a),
                o.wrap(c(u, 2), l + 1),
              ])
          : (o, u) =>
              f(u)
                ? y([o.serializeSymbol(a), o.wrapArguments(u)])
                : o.serializeSymbol(a);
  }
  function Ya(e, t, i) {
    if ("parse" in e && typeof e.parse == "function") return e.parse;
    let r = e,
      n = ("kind" in e ? e.kind : "expression") ?? "expression";
    if (n === "environment") {
      let s = e.parse ?? e.name ?? i;
      if (s)
        return (a, l) => {
          let o = a.parseTabular();
          return o === null
            ? null
            : [s, ["List", o.map((u) => ["List", ...u])]];
        };
    }
    if (n === "function") {
      let s = e.parse ?? e.name ?? i,
        a = ("arguments" in e ? e.arguments : void 0) ?? "enclosure";
      if (s)
        return (l, o) => {
          let u = l.parseArguments(a, o);
          return u === null ? s : [s, ...u];
        };
    }
    if (n === "symbol") {
      let s = e.parse ?? e.name ?? i;
      if (s) return (a, l) => s;
    }
    if (n === "prefix") {
      let s = e.parse ?? e.name ?? i;
      if (s) {
        let a = r.precedence ?? 1e4;
        return (l, o) => {
          let u = l.parseExpression({ ...(o ?? []), minPrec: a });
          return u === null ? null : [s, u];
        };
      }
    }
    if (n === "postfix") {
      let s = e.parse ?? e.name;
      if (s) return (a, l) => (l === null ? null : [s, l]);
    }
    if (n === "infix") {
      if (/[_^]/.test(t?.[0] ?? "")) {
        let a = e.name ?? e.parse;
        return (l, o) => [a, F(c(o, 1)), F(c(o, 2))];
      }
      let s = e.parse ?? e.name ?? i;
      if (s) {
        let a = r.precedence ?? 1e4,
          l = r.associativity ?? "none";
        return l === "none"
          ? (o, u, p) => {
              if (u === null) return null;
              let g = F(o.parseExpression({ ...p, minPrec: a }));
              return [s, u, g];
            }
          : l === "left"
            ? (o, u, p) => {
                if (u === null) return null;
                let g = F(o.parseExpression({ ...p, minPrec: a + 1 }));
                return typeof s != "string" ? [s, u, g] : [s, u, g];
              }
            : l === "right"
              ? (o, u, p) => {
                  if (u === null) return null;
                  let g = F(o.parseExpression({ ...p, minPrec: a }));
                  return typeof s != "string" ? [s, u, g] : [s, u, g];
                }
              : (o, u, p) => {
                  if (u === null) return null;
                  let g = F(o.parseExpression({ ...p, minPrec: a }));
                  return typeof s != "string" ? [s, u, g] : He(s, u, g);
                };
      }
    }
    if (n === "matchfix") {
      let s = e.parse ?? e.name;
      if (s) return (a, l) => (M(l) ? null : [s, l]);
    }
    if (n === "expression") {
      let s = e.parse ?? e.name ?? i;
      if (s) return () => s;
    }
    if ("parse" in e) {
      let s = e.parse;
      return () => s;
    }
  }
  function Ha(e, t) {
    let i = e,
      r = e.name ?? i.latexTrigger ?? i.symbolTrigger ?? i.openTrigger;
    if (!r)
      try {
        r = JSON.stringify(e);
      } catch {
        r = "???";
      }
    if (
      (Array.isArray(r) && (r = ue(r)),
      "kind" in e &&
        ![
          "expression",
          "symbol",
          "function",
          "infix",
          "postfix",
          "prefix",
          "matchfix",
          "environment",
        ].includes(e.kind) &&
        t({
          severity: "warning",
          message: [
            "invalid-dictionary-entry",
            r,
            "The 'kind' property must be one of 'expression', 'symbol', 'function', 'infix', 'postfix', 'prefix', 'matchfix', 'environment'",
          ],
        }),
      e.serialize !== void 0 && !e.name)
    )
      return (
        t({
          severity: "warning",
          message: [
            "invalid-dictionary-entry",
            r,
            "A 'name' property must be provided if a 'serialize' handler is provided",
          ],
        }),
        !1
      );
    if (
      ("symbolTrigger" in e &&
        (!("kind" in e) || e.kind !== "environment") &&
        (typeof e.symbolTrigger != "string" || !Ie(e.symbolTrigger)) &&
        t({
          severity: "warning",
          message: [
            "invalid-dictionary-entry",
            r,
            "The 'symbolTrigger' property must be a valid symbol",
          ],
        }),
      "name" in e &&
        (typeof e.name != "string"
          ? e.name !== void 0 &&
            t({
              severity: "warning",
              message: [
                "invalid-dictionary-entry",
                r,
                "The 'name' property must be a string",
              ],
            })
          : Ie(e.name) ||
            t({
              severity: "warning",
              message: [
                "invalid-dictionary-entry",
                e.name,
                "The 'name' property must be a valid symbol",
              ],
            })),
      yt(e))
    ) {
      if ("latexTrigger" in e || "symbolTrigger" in e)
        return (
          t({
            severity: "warning",
            message: [
              "invalid-dictionary-entry",
              r,
              "'matchfix' operators use a 'openTrigger' and 'closeTrigger' instead of a 'latexTrigger' or 'symbolTrigger'. ",
            ],
          }),
          !1
        );
      if (!e.openTrigger || !e.closeTrigger)
        return (
          t({
            severity: "warning",
            message: [
              "invalid-dictionary-entry",
              r,
              "Expected `openTrigger` and a `closeTrigger` for matchfix operator",
            ],
          }),
          !1
        );
      if (typeof e.openTrigger != typeof e.closeTrigger)
        return (
          t({
            severity: "warning",
            message: [
              "invalid-dictionary-entry",
              r,
              "Expected `openTrigger` and `closeTrigger` to both be strings or array of LatexToken",
            ],
          }),
          !1
        );
    }
    if (Mr(e) || Dr(e) || Or(e)) {
      if (
        (Array.isArray(e.latexTrigger) &&
          (e.latexTrigger[0] === "_" || e.latexTrigger[0] === "^")) ||
        (typeof e.latexTrigger == "string" &&
          (e.latexTrigger.startsWith("^") || e.latexTrigger.startsWith("_")))
      ) {
        if (e.precedence !== void 0 || i.associativity !== void 0)
          return (
            t({
              severity: "warning",
              message: [
                "invalid-dictionary-entry",
                r,
                'Unexpected "precedence" or "associativity" for superscript/subscript operator',
              ],
            }),
            !1
          );
      } else if (e.precedence === void 0)
        return (
          t({
            severity: "warning",
            message: [
              "invalid-dictionary-entry",
              r,
              `Expected a "precedence" for ${e.kind} operator`,
            ],
          }),
          !1
        );
    } else if (i.associativity !== void 0)
      return (
        t({
          severity: "warning",
          message: [
            "invalid-dictionary-entry",
            r,
            'Unexpected "associativity" operator',
          ],
        }),
        !1
      );
    return !yt(e) && !Wn(e) && !e.latexTrigger && !e.symbolTrigger && !e.name
      ? (t({
          severity: "warning",
          message: [
            "invalid-dictionary-entry",
            r,
            "Expected a 'name', a 'latexTrigger' or a 'symbolTrigger'",
          ],
        }),
        !1)
      : e.parse === void 0 && e.name === void 0
        ? (t({
            severity: "warning",
            message: [
              "invalid-dictionary-entry",
              r,
              "Expected a 'parse' or 'name'",
            ],
          }),
          !1)
        : !0;
  }
  var je = null;
  function Wa() {
    if (!je) {
      je = new Map();
      for (let [e, t] of Re) je.has(t) || je.set(t, e);
    }
    return je;
  }
  var xn = {
      "\\mathord": "",
      "\\mathop": "",
      "\\mathbin": "",
      "\\mathrel": "",
      "\\mathopen": "",
      "\\mathclose": "",
      "\\mathpunct": "",
      "\\mathinner": "",
      "\\operatorname": "",
      "\\text": "",
      "\\mathrm": "_upright",
      "\\mathit": "_italic",
      "\\mathbf": "_bold",
      "\\mathscr": "_script",
      "\\mathcal": "_calligraphic",
      "\\mathfrak": "_fraktur",
      "\\mathsf": "_sansserif",
      "\\mathtt": "_monospace",
      "\\mathbb": "_doublestruck",
    },
    Ka = {
      "\\mathring": "_ring",
      "\\hat": "_hat",
      "\\tilde": "_tilde",
      "\\vec": "_vec",
      "\\overline": "_bar",
      "\\underline": "_underbar",
      "\\dot": "_dot",
      "\\ddot": "_ddot",
      "\\dddot": "_dddot",
      "\\ddddot": "_ddddot",
      "\\acute": "_acute",
      "\\grave": "_grave",
      "\\breve": "_breve",
      "\\check": "_check",
    };
  function yn(e, t) {
    if (e.atEnd) return null;
    let i = e.peek,
      r = { "\\_": "_", "\\#": "hash" }[i];
    if (
      (!r &&
        !t.toplevel &&
        (r = {
          "+": "plus",
          "-": "minus",
          "\\plusmn": "pm",
          "\\pm": "pm",
          "\\ast": "ast",
          "\\dag": "dag",
          "\\ddag": "ddag",
          "\\bot": "bottom",
          "\\top": "top",
          "\\bullet": "bullet",
          "\\cir": "circle",
          "\\diamond": "diamond",
          "\\times": "times",
          "\\square": "square",
          "\\star": "star",
        }[i]),
      r)
    )
      return (e.nextToken(), r);
    let n = Wa().get(i);
    if (n !== void 0) return (e.nextToken(), n);
    let s = e.parseChar();
    if (s !== null)
      return new RegExp("^\\p{XIDC}+$", "u").test(s)
        ? s
        : [...s].length === 1
          ? "____" +
            s.codePointAt(0).toString(16).toUpperCase().padStart(6, "0")
          : s;
    let a = e.peek;
    return a && /^[\p{XIDC}\p{M}]/u.test(a) ? e.nextToken() : null;
  }
  function Je(e) {
    let t = bi(e),
      i = Ka[e.peek] ?? null;
    if (i) {
      if ((e.nextToken(), !e.match("<{>"))) return null;
      let s = Je(e);
      if (s === null || !e.match("<}>")) return null;
      t = `${s}${i}`;
    }
    if (t === null) {
      for (t = ""; !e.atEnd;) {
        let s = e.peek;
        if (s === "<}>" || s === "_" || s === "^") break;
        if (s === "<space>") {
          e.nextToken();
          continue;
        }
        if (st.test(t + s)) {
          t += e.nextToken();
          continue;
        }
        let a = yn(e, { toplevel: !1 });
        if (a === null) return null;
        t += a;
      }
      for (; !e.atEnd && /\d/.test(e.peek);) t += e.nextToken();
    }
    for (; !e.atEnd;)
      if (e.match("\\degree")) t += "_deg";
      else if (e.matchAll(["^", "\\circ"])) t += "_deg";
      else if (e.matchAll(["^", "\\prime"])) t += "_prime";
      else if (e.matchAll(["^", "<{>", "\\prime", "<}>"])) t += "_prime";
      else if (e.matchAll(["^", "<{>", "\\doubleprime", "<}>"])) t += "_dprime";
      else if (e.matchAll(["^", "<{>", "\\prime", "\\prime", "<}>"]))
        t += "_dprime";
      else break;
    let r = [],
      n = [];
    for (; !e.atEnd;)
      if (e.match("_")) {
        let s = e.match("<{>"),
          a = Je(e);
        if ((s && !e.match("<}>")) || a === null) return null;
        n.push(a);
      } else if (e.match("^")) {
        let s = e.match("<{>"),
          a = Je(e);
        if ((s && !e.match("<}>")) || a === null) return null;
        r.push(a);
      } else break;
    return (
      r.length > 0 && (t += "__" + r.join("")),
      n.length > 0 && (t += "_" + n.join("")),
      t
    );
  }
  function bi(e) {
    let t = xn[e.peek] ?? null;
    if (t === null) return null;
    let i = e.index;
    if ((e.nextToken(), e.match("<{>"))) {
      let r = "",
        n =
          {
            0: "zero",
            1: "one",
            2: "two",
            3: "three",
            4: "four",
            5: "five",
            6: "six",
            7: "seven",
            8: "eight",
            9: "nine",
          }[e.peek] ?? "";
      n && ((r = n), e.nextToken());
      let s = Je(e);
      return s === null || !e.match("<}>")
        ? ((e.index = i), null)
        : ((r += s), t === "_upright" && r.length > 1 ? r : r + t);
    }
    return ((e.index = i), null);
  }
  function xr(e) {
    let t = e.index,
      i = bi(e);
    if (i !== null)
      return Ie(i) ? null : e.error(["invalid-symbol", { str: dr(i) }], t);
    if (((e.index = t), (xn[e.peek] ?? null) === null)) return null;
    if ((e.nextToken(), !e.match("<{>"))) return ((e.index = t), null);
    let r = e.index,
      n = 0;
    for (; !e.atEnd && !(n === 0 && e.peek === "<}>");)
      (e.peek === "<{>" && (n += 1),
        e.peek === "<}>" && (n -= 1),
        e.nextToken());
    let s = e.latex(r, e.index);
    return Ie(s)
      ? ((e.index = t), null)
      : (e.match("<}>"), e.error(["invalid-symbol", { str: dr(s) }], t));
  }
  function ft(e) {
    if (
      /^[a-zA-Z]$/.test(e.peek) ||
      new RegExp("^\\p{XIDS}$", "u").test(e.peek)
    ) {
      let r = e.nextToken(),
        n = e.getSymbolType(r).matches("indexed_collection"),
        s = e.hasSubscriptEvaluate(r);
      for (; !e.atEnd && !n && !s && e.peek === "_";) {
        let a = e.index;
        if ((e.nextToken(), e.match("<{>"))) {
          let l = e.peek;
          if (l === "(" || l === "\\lparen" || l === "\\left") {
            e.index = a;
            break;
          }
          let o = Je(e),
            u = o !== null && /plus|minus|times|ast/.test(o);
          if (o === null || o.includes(",") || u || e.peek !== "<}>") {
            e.index = a;
            break;
          }
          (e.match("<}>"), (r += "_" + o));
        } else {
          let l = e.peek;
          if (e.options.strict === !1 && /^[0-9]$/.test(l)) {
            let o = "";
            for (; !e.atEnd && /^[0-9]$/.test(e.peek);)
              ((o += e.peek), e.nextToken());
            r += "_" + o;
          } else if (
            /^[a-zA-Z0-9]$/.test(l) ||
            new RegExp("^\\p{XIDS}$", "u").test(l)
          )
            (e.nextToken(), (r += "_" + l));
          else {
            e.index = a;
            break;
          }
        }
      }
      return r;
    }
    let t = bi(e);
    if (!t) {
      for (t = ""; !e.atEnd && st.test(t + e.peek);) t += e.nextToken();
      t || (t = null);
    }
    let i = e.index;
    return (
      (t ??= yn(e, { toplevel: !0 })),
      t && ((t = t.normalize()), Ie(t)) ? t : ((e.index = i), null)
    );
  }
  var yr = new Map(),
    Qa = 1e5;
  function _(e) {
    if (e <= Qa) {
      let t = yr.get(e);
      return (t === void 0 && ((t = 10n ** BigInt(e)), yr.set(e, t)), t);
    }
    return 10n ** BigInt(e);
  }
  function ge(e) {
    if ((e < 0n && (e = -e), e === 0n)) return 0;
    let t = 0,
      i = 1;
    for (; e >> BigInt(i) > 0n;) i *= 2;
    for (let r = i >> 1; r >= 1; r >>= 1)
      e >> BigInt(r) > 0n && ((t += r), (e >>= BigInt(r)));
    return t + 1;
  }
  function Ja(e, t, i) {
    return (e * t) >> BigInt(i);
  }
  function Xa(e, t, i) {
    return (e << BigInt(i)) / t;
  }
  function wt(e, t) {
    if (e === 0n) return 0n;
    if (e < 0n) throw new RangeError("fpsqrt: negative input");
    let i = e << BigInt(t),
      r;
    if (t < el) {
      r = vi(i);
      let a;
      do ((a = r), (r = (r + i / r) / 2n));
      while (W(r - a) > 1n);
    } else r = Ni(i, ge(i));
    let n = (r + i / r) / 2n,
      s = W(r * r - i);
    return W(n * n - i) < s ? n : r;
  }
  function vi(e) {
    let t = ge(e);
    if (t <= 1023) {
      let a = Math.sqrt(Number(e));
      if (Number.isFinite(a) && a >= 1) return BigInt(Math.floor(a));
    }
    let i = t - 52,
      r = Number(e >> BigInt(i)),
      n = Math.sqrt(r);
    i & 1 && (n *= Math.SQRT2);
    let s = BigInt(Math.round(n)) << BigInt(i >> 1);
    return s > 0n ? s : 1n;
  }
  var Tn = 1024,
    el = 640;
  function Ni(e, t) {
    if (t < Tn) {
      let s = vi(e),
        a;
      do ((a = s), (s = (s + e / s) / 2n));
      while (W(s - a) > 1n);
      for (; s * s > e;) s -= 1n;
      for (; (s + 1n) * (s + 1n) <= e;) s += 1n;
      return s;
    }
    let i = (t >> 2) << 1,
      r = Ni(e >> BigInt(i), t - i) << BigInt(i >> 1),
      n;
    do ((n = r), (r = (r + e / r) / 2n));
    while (W(r - n) > 1n);
    for (; r * r > e;) r -= 1n;
    for (; (r + 1n) * (r + 1n) <= e;) r += 1n;
    return r;
  }
  function W(e) {
    return e < 0n ? -e : e;
  }
  function Z(e) {
    if (e === 0n) return 1;
    if ((e < 0n && (e = -e), e < 0x20000000000000n))
      return Math.floor(Math.log10(Number(e))) + 1;
    let t = 0,
      i = e,
      r = 1;
    for (; i >> BigInt(r) > 0n;) r *= 2;
    for (let s = r >> 1; s >= 1; s >>= 1)
      i >> BigInt(s) > 0n && ((t += s), (i >>= BigInt(s)));
    t += 1;
    let n = Math.ceil(t * 0.30102999566398);
    return e < _(n - 1) ? n - 1 : e >= _(n) ? n + 1 : n;
  }
  function ui(e, t) {
    let i = BigInt(t),
      r = 1n << i;
    if (e === 0n) return r;
    let n = 0,
      s = e,
      a = r >> 1n;
    for (; W(s) > a;) ((s = s / 2n), n++);
    let l = r,
      o = s;
    l += o;
    for (let u = 2; (o = ((o * s) >> i) / BigInt(u)), o !== 0n; u++) l += o;
    for (let u = 0; u < n; u++) l = (l * l) >> i;
    return l;
  }
  var tl = 2300;
  function kn(e, t) {
    let i = 1n << BigInt(t);
    if (e <= 0n) throw new RangeError("fpln: input must be positive");
    return e === i ? 0n : t >= tl ? nl(e, t) : il(e, t);
  }
  function il(e, t) {
    let i = BigInt(t),
      r = 1n << i,
      n = Number(e),
      s = Number(r),
      a,
      l = e,
      o = 0,
      u = 2;
    if (Number.isFinite(n) && Number.isFinite(s) && n > 0 && s > 0) {
      let g = n / s;
      if (Number.isFinite(g) && g > 0) {
        let d = Math.log(g);
        Number.isFinite(d)
          ? ((a = BigInt(Math.round(d * s))), (u = 48))
          : (a = Ht(e, t));
      } else a = Ht(e, t);
    } else {
      l = e;
      let g = r << 1n,
        d = r >> 1n;
      for (; l > g || l < d;) ((l = wt(l, t)), o++);
      a = Ht(l, t);
    }
    for (let g = Math.min(t, Math.max(8, 2 * u)); g < t;) {
      let d = BigInt(g),
        m = BigInt(t - g),
        b = a >> m,
        I = ui(b, g);
      if (I === 0n) {
        a = a / 2n;
        continue;
      }
      let w = l >> m;
      ((a = (b + (w << d) / I - (1n << d)) << m), (g = Math.min(t, 2 * g)));
    }
    let p = 0n;
    for (let g = 0; g < 100; g++) {
      let d = ui(a, t);
      if (d === 0n) {
        a = a / 2n;
        continue;
      }
      let m = a + (l << i) / d - r,
        b = W(m - a);
      if (b <= 1n || (b < 100000n && p > 0n && p < 100000n && b * 4n >= p))
        break;
      ((p = b), (a = m));
    }
    for (let g = 0; g < o; g++) a = 2n * a;
    return a;
  }
  var fe = null;
  function rl(e) {
    if (fe !== null) {
      if (fe.bits === e) return fe.value;
      if (fe.bits > e) return fe.value >> BigInt(fe.bits - e);
    }
    let t = Math.ceil(e * $t) + 12,
      i;
    if (t <= kr.length) {
      let r = kr.slice(0, t);
      i = (BigInt(r) << BigInt(e)) / _(r.length);
    } else i = pl(e);
    return ((fe = { bits: e, value: i }), i);
  }
  function nl(e, t) {
    let i = BigInt(t),
      r = ge(e) - t,
      n = Math.max(2, Math.ceil(t / 2 + 4 - r)),
      s = e << BigInt(n - 2),
      a = 1n << i,
      l = s;
    for (; W(a - l) > 1n;) {
      let o = (a + l) >> 1n;
      ((l = zt(a * l)), (a = o));
    }
    return (Nt(t) * s) / (2n * a) - BigInt(n) * rl(t);
  }
  var Tr = 6243314768165359n;
  function Ht(e, t) {
    let i = BigInt(ge(e) - t);
    return t >= 53 ? (i * Tr) << BigInt(t - 53) : (i * Tr) >> BigInt(53 - t);
  }
  var Xe =
      "314159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798214808651328230664709384460955058223172535940812848111745028410270193852110555964462294895493038196442881097566593344612847564823378678316527120190914564856692346034861045432664821339360726024914127372458700660631558817488152092096282925409171536436789259036001133053054882046652138414695194151160943305727036575959195309218611738193261179310511854807446237996274956735188575272489122793818301194912983367336244065664308602139494639522473719070217986094370277053921717629317675238467481846766940513200056812714526356082778577134275778960917363717872146844090122495343014654958537105079227968925892354201995611212902196086403441815981362977477130996051870721134999999837297804995105973173281609631859502445945534690830264252230825334468503526193118817101000313783875288658753320838142061717766914730359825349042875546873115956286388235378759375195778185778053217122680661300192787661119590921642019893809525720106548586327886593615338182796823030195203530185296899577362259941389124972177528347913151557485724245415069595082953311686172785588907509838175463746493931925506040092770167113900984882401285836160356370766010471018194295559619894676783744944825537977472684710404753464620804668425906949129331367702898915210475216205696602405803815019351125338243003558764024749647326391419927260426992279678235478163600934172164121992458631503028618297455570674983850549458858692699569092721079750930295532116534498720275596023648066549911988183479775356636980742654252786255181841757467289097777279380008164706001614524919217321721477235014144197356854816136115735255213347574184946843852332390739414333454776241686251898356948556209921922218427255025425688767179049460165346680498862723279178608578438382796797668145410095388378636095068006422512520511739298489608412848862694560424196528502221066118630674427862203919494504712371378696095636437191728746776465757396241389086583264599581339047802759009946576407895126946839835259570982582262052248940772671947826848260147699090264013639443745530506820349625245174939965143142980919065925093722169646151570985838741059788595977297549893016175392846813826868386894277415599185592524595395943104997252468084598727364469584865383673622262609912460805124388439045124413654976278079771569143599770012961608944169486855584840635",
    $t = Math.log10(2),
    kr =
      "693147180559945309417232121458176568075500134360255254120680009493393621969694715605863326996418687542001481020570685733685520235758130557032670751635075961930727570828371435190307038623891673471123350115364497955239120475172681574932065155524734139525882950453007095326366642654104239157814952043740430385500801944170641671518644712839968171784546957026271631064546150257207402481637773389638550695260668341137273873722928956493547025762652098859693201965058554764703306793654432547632744951250406069438147104689946506220167720424524529612687946546193165174681392672504103802546259656869144192871608293803172714367782654877566485085674077648451464439940461422603193096735402574446070308096085047486638523138181676751438667476647890881437141985494231519973548803751658612753529166100071053558249879414729509293113897155998205654392871700072180857610252368892132449713893203784393530887748259701715591070882368362758984258918535302436342143670611892367891923723146723217205340164925687274778234453534764811494186423867767744060695626573796008670762571991847340226514628379048830620330611446300737194890027436439650025809365194430411911506080948793067865158870900605203468429736193841289652556539686022194122924207574321757489097706752687115817051137009158942665478595964890653058460258668382940022833005382074005677053046787001841624044188332327983863490015631218895606505531512721993983320307514084260914790012651682434438935724727882054862715527418772430024897945401961872339808608316648114909306675193393128904316413706813977764981769748689038877899912965036192707108892641052309247839173735012298424204995689359922066022046549415106139187885744245577510206837030866619480896412186807790208181588580001688115973056186676199187395200766719214592236720602539595436541655311295175989940056000366513567569051245926825743946483168332624901803824240824231452306140963805700702551387702681785163069025513703234053802145019015374029509942262995779647427138157363801729873940704242179972266962979939312706935747240493386530879758721699645129446491883771156701678598804981838896784134938314014073166472765327635919233511233389338709513209059272185471328975470797891384445466676192702885533423429899321803769154973340267546758873236778342916191810430116091695265547859732891763545556742863877463987101912431754255888301206779210280341206879759143081283307230300883494705792496591005860012341561757413272465943",
    sl = 13591409n,
    al = 545140134n,
    ll = 10939058860032000n,
    ol = 47.11;
  function vt(e, t) {
    if (t - e === 1) {
      let u, p;
      if (e === 0) ((u = 1n), (p = 1n));
      else {
        u = BigInt(6 * e - 5) * BigInt(2 * e - 1) * BigInt(6 * e - 1);
        let d = BigInt(e);
        p = d * d * d * ll;
      }
      let g = u * (sl + al * BigInt(e));
      return (e & 1 && (g = -g), [u, p, g]);
    }
    let i = (e + t) >> 1,
      [r, n, s] = vt(e, i),
      [a, l, o] = vt(i, t);
    return [r * a, n * l, l * s + r * o];
  }
  function bn(e) {
    return Math.max(2, Math.floor(e / ol) + 3);
  }
  function ul(e) {
    let [, t, i] = vt(0, bn(e)),
      r = 1n << BigInt(e),
      n = zt(10005n * r * r);
    return (t * 426880n * n) / i;
  }
  function cl(e) {
    let [, t, i] = vt(0, bn(Math.ceil(e / $t))),
      r = _(e),
      n = zt(10005n * r * r);
    return (t * 426880n * n) / i;
  }
  function ci(e, t) {
    if (t - e === 1) {
      let u = e === 0 ? 1n : BigInt(2 * e - 1),
        p = e === 0 ? 1n : 9n * BigInt(2 * e + 1);
      return [u, p, u];
    }
    let i = (e + t) >> 1,
      [r, n, s] = ci(e, i),
      [a, l, o] = ci(i, t);
    return [r * a, n * l, l * s + r * o];
  }
  function pl(e) {
    let t = Math.max(2, Math.ceil(e / 3.169925) + 5),
      [, i, r] = ci(0, t);
    return (r << BigInt(e + 1)) / (3n * i);
  }
  function zt(e) {
    if (e < 0n) throw new RangeError("bigintSqrt: negative input");
    if (e === 0n) return 0n;
    let t = ge(e);
    if (t >= Tn) return Ni(e, t);
    let i = vi(e),
      r;
    do ((r = i), (i = (i + e / i) / 2n));
    while (W(i - r) > 1n);
    for (; i * i > e;) i -= 1n;
    for (; (i + 1n) * (i + 1n) <= e;) i += 1n;
    return i;
  }
  var me = null;
  function Nt(e) {
    if (me !== null) {
      if (me.bits === e) return me.value;
      if (me.bits > e) return me.value >> BigInt(me.bits - e);
    }
    let t = hl(e);
    return ((me = { bits: e, value: t }), t);
  }
  function hl(e) {
    let t = Math.ceil(e * $t) + 12;
    if (t + 1 <= Xe.length) {
      let i = Xe.slice(0, t + 1);
      return (BigInt(i) << BigInt(e)) / _(i.length - 1);
    }
    return ul(e);
  }
  function Ii(e, t) {
    let i = BigInt(t),
      r = 1n << i;
    if (e === 0n) return [0n, r];
    let n = Nt(t),
      s = 2n * n,
      a = n / 2n,
      l,
      o = W(e);
    if (o > r << 30n) {
      let D = ge(o) - t + 64,
        Se = t + D,
        Ot = e << BigInt(D),
        wi = 2n * Nt(Se),
        Dt = Ot % wi;
      (Dt < 0n && (Dt += wi), (l = Dt >> BigInt(D)));
    } else l = e % s;
    l < 0n && (l += s);
    let u = 1n,
      p = 1n;
    l > 3n * a
      ? ((l = s - l), (u = -1n))
      : l > n
        ? ((l = l - n), (u = -1n), (p = -1n))
        : l > a && ((l = n - l), (p = -1n));
    let g = Math.round(t * $t),
      d = Math.min(18, Math.max(2, Math.ceil(0.87 * Math.sqrt(g)))),
      m = 0,
      b = r >> BigInt(d);
    for (; l > b;) ((l = l / 2n), m++);
    let I = l,
      w = r,
      z = l,
      O = r,
      ee = l * l,
      re = 2n * i;
    for (let D = 2; ; D += 2) {
      if (((O = ((O * ee) >> re) / (BigInt(D) * BigInt(D - 1))), O === 0n)) {
        ((z = ((z * ee) >> re) / (BigInt(D + 1) * BigInt(D))),
          z !== 0n &&
            (D % 4 === 2 ? ((w -= O), (I -= z)) : ((w += O), (I += z))));
        break;
      }
      if (
        ((z = ((z * ee) >> re) / (BigInt(D + 1) * BigInt(D))),
        D % 4 === 2 ? ((w -= O), (I -= z)) : ((w += O), (I += z)),
        z === 0n)
      )
        break;
    }
    for (let D = 0; D < m; D++) {
      let Se = (2n * I * w) >> i,
        Ot = ((2n * w * w) >> i) - r;
      ((I = Se), (w = Ot));
    }
    return [u * I, p * w];
  }
  function It(e, t) {
    if (e === 0n) return 0n;
    if (e < 0n) return -It(-e, t);
    let i = BigInt(t),
      r = 1n << i,
      n = Nt(t) / 2n;
    if (e > r) {
      let d = (r << i) / e;
      return n - It(d, t);
    }
    let s = (4n * r) / 10n,
      a = 0,
      l = e;
    for (; l > s;) {
      let d = l * l,
        m = ((r << i) + d) >> i,
        b = wt(m, t);
      ((l = (l << i) / (r + b)), a++);
    }
    let o = l,
      u = l,
      p = l * l,
      g = 2n * i;
    for (let d = 3; (u = (u * p) >> g), u !== 0n; d += 2)
      d % 4 === 3 ? (o -= u / BigInt(d)) : (o += u / BigInt(d));
    for (let d = 0; d < a; d++) o = 2n * o;
    return o;
  }
  var Wt = NaN,
    h = class x {
      static precision = 50;
      static ZERO = Object.freeze(
        Object.assign(Object.create(x.prototype), {
          significand: 0n,
          exponent: 0,
        }),
      );
      static ONE = Object.freeze(
        Object.assign(Object.create(x.prototype), {
          significand: 1n,
          exponent: 0,
        }),
      );
      static TWO = Object.freeze(
        Object.assign(Object.create(x.prototype), {
          significand: 2n,
          exponent: 0,
        }),
      );
      static NEGATIVE_ONE = Object.freeze(
        Object.assign(Object.create(x.prototype), {
          significand: -1n,
          exponent: 0,
        }),
      );
      static HALF = Object.freeze(
        Object.assign(Object.create(x.prototype), {
          significand: 5n,
          exponent: -1,
        }),
      );
      static NAN = Object.freeze(
        Object.assign(Object.create(x.prototype), {
          significand: 0n,
          exponent: NaN,
        }),
      );
      static POSITIVE_INFINITY = Object.freeze(
        Object.assign(Object.create(x.prototype), {
          significand: 1n,
          exponent: 1 / 0,
        }),
      );
      static NEGATIVE_INFINITY = Object.freeze(
        Object.assign(Object.create(x.prototype), {
          significand: -1n,
          exponent: 1 / 0,
        }),
      );
      static _piFullPrecision = null;
      static _piCache = null;
      static _piCachePrecision = 0;
      static _eulerGammaCache = null;
      static _eulerGammaCachePrecision = 0;
      static get PI() {
        let t = x.precision;
        if (x._piCache !== null && x._piCachePrecision === t) return x._piCache;
        let i = t + 4,
          r;
        if (i + 1 <= Xe.length)
          (x._piFullPrecision === null &&
            (x._piFullPrecision = new x(Xe[0] + "." + Xe.slice(1))),
            (r = x._piFullPrecision.toPrecision(i)));
        else {
          let n = i + 4;
          r = $(cl(n), -n).toPrecision(i);
        }
        return ((x._piCache = r), (x._piCachePrecision = t), r);
      }
      static get EULER_GAMMA() {
        let t = x.precision;
        if (x._eulerGammaCache !== null && x._eulerGammaCachePrecision >= t)
          return x._eulerGammaCache.toPrecision(t);
        let i = fl(t);
        return ((x._eulerGammaCache = i), (x._eulerGammaCachePrecision = t), i);
      }
      significand;
      exponent;
      constructor(t) {
        if (t instanceof x) {
          ((this.significand = t.significand), (this.exponent = t.exponent));
          return;
        }
        if (typeof t == "bigint") {
          [this.significand, this.exponent] = _t(t, 0);
          return;
        }
        if (typeof t == "number") {
          [this.significand, this.exponent] = ml(t);
          return;
        }
        [this.significand, this.exponent] = vn(t);
      }
      isNaN() {
        return Number.isNaN(this.exponent);
      }
      isZero() {
        return this.exponent === 0 && this.significand === 0n;
      }
      isFinite() {
        return Number.isFinite(this.exponent);
      }
      isInteger() {
        return this.isFinite() && this.exponent >= 0;
      }
      isPositive() {
        return this.significand > 0n;
      }
      isNegative() {
        return this.significand < 0n;
      }
      cmp(t) {
        if (typeof t == "number") {
          if (Number.isNaN(t)) return Wt;
          let m = this.exponent;
          if (Number.isNaN(m)) return Wt;
          if (t === 0)
            return this.significand === 0n ? 0 : this.significand > 0n ? 1 : -1;
          if (!Number.isFinite(m))
            return t === 1 / 0
              ? this.significand > 0n
                ? 0
                : -1
              : t === -1 / 0
                ? this.significand < 0n
                  ? 0
                  : 1
                : this.significand > 0n
                  ? 1
                  : -1;
          if (this.significand === 0n) return t > 0 ? -1 : 1;
          if (t === 1 / 0) return -1;
          if (t === -1 / 0) return 1;
          if (this.significand > 0n != t > 0)
            return this.significand > 0n ? 1 : -1;
          if (Number.isInteger(t) && m >= 0 && m <= 15) {
            let b = this.significand * _(m),
              I = BigInt(t);
            return b < I ? -1 : b > I ? 1 : 0;
          }
          t = new x(t);
        }
        let i = this.exponent,
          r = t.exponent,
          n = this.significand,
          s = t.significand;
        if (i !== i || r !== r) return Wt;
        if (!Number.isFinite(i) || !Number.isFinite(r))
          return !Number.isFinite(i) && !Number.isFinite(r)
            ? n === s
              ? 0
              : n > s
                ? 1
                : -1
            : Number.isFinite(i)
              ? s > 0n
                ? -1
                : 1
              : n > 0n
                ? 1
                : -1;
        if (n === 0n) return s === 0n ? 0 : s > 0n ? -1 : 1;
        if (s === 0n) return n > 0n ? 1 : -1;
        if (n > 0n && s < 0n) return 1;
        if (n < 0n && s > 0n) return -1;
        if (i === r) return n < s ? -1 : n > s ? 1 : 0;
        let a = Z(n),
          l = Z(s),
          o = a + i,
          u = l + r;
        if (o !== u) {
          let m = n > 0n ? 1 : -1;
          return o > u ? m : -m;
        }
        let p = n,
          g = s,
          d = Math.abs(i - r);
        if (d > 1e3) {
          let m = a,
            b = l,
            I = Math.max(m, b) + 1;
          (m < I && (p = p * _(I - m)), b < I && (g = g * _(I - b)));
        } else i < r ? (g = g * _(d)) : (p = p * _(d));
        return p < g ? -1 : p > g ? 1 : 0;
      }
      eq(t) {
        return typeof t == "number"
          ? t === 0
            ? this.significand === 0n && this.exponent === 0
            : t === 1
              ? this.significand === 1n && this.exponent === 0
              : t === -1
                ? this.significand === -1n && this.exponent === 0
                : Number.isInteger(t) &&
                    Number.isFinite(this.exponent) &&
                    this.exponent >= 0 &&
                    this.exponent <= 15
                  ? this.significand * _(this.exponent) === BigInt(t)
                  : this.cmp(t) === 0
          : this.significand === t.significand && this.exponent === t.exponent;
      }
      lt(t) {
        return this.cmp(t) === -1;
      }
      lte(t) {
        let i = this.cmp(t);
        return i === -1 || i === 0;
      }
      gt(t) {
        return this.cmp(t) === 1;
      }
      gte(t) {
        let i = this.cmp(t);
        return i === 1 || i === 0;
      }
      add(t) {
        typeof t == "number" && (t = new x(t));
        let i = this.exponent,
          r = t.exponent;
        if (Number.isFinite(i) && Number.isFinite(r)) {
          if (i === r) return $(this.significand + t.significand, i);
          let a = i - r;
          return a > 0
            ? $(this.significand * _(a) + t.significand, r)
            : $(this.significand + t.significand * _(-a), i);
        }
        if (i !== i || r !== r) return x.NAN;
        let n = !Number.isFinite(i),
          s = !Number.isFinite(r);
        return n && s
          ? this.significand !== t.significand
            ? x.NAN
            : this.significand > 0n
              ? x.POSITIVE_INFINITY
              : x.NEGATIVE_INFINITY
          : n
            ? this.significand > 0n
              ? x.POSITIVE_INFINITY
              : x.NEGATIVE_INFINITY
            : t.significand > 0n
              ? x.POSITIVE_INFINITY
              : x.NEGATIVE_INFINITY;
      }
      sub(t) {
        typeof t == "number" && (t = new x(t));
        let i = this.exponent,
          r = t.exponent;
        if (Number.isFinite(i) && Number.isFinite(r)) {
          if (i === r) return $(this.significand - t.significand, i);
          let a = i - r;
          return a > 0
            ? $(this.significand * _(a) - t.significand, r)
            : $(this.significand - t.significand * _(-a), i);
        }
        if (i !== i || r !== r) return x.NAN;
        let n = !Number.isFinite(i),
          s = !Number.isFinite(r);
        return n && s
          ? this.significand === t.significand
            ? x.NAN
            : this.significand > 0n
              ? x.POSITIVE_INFINITY
              : x.NEGATIVE_INFINITY
          : n
            ? this.significand > 0n
              ? x.POSITIVE_INFINITY
              : x.NEGATIVE_INFINITY
            : t.significand > 0n
              ? x.NEGATIVE_INFINITY
              : x.POSITIVE_INFINITY;
      }
      mul(t) {
        typeof t == "number" && (t = new x(t));
        let i = this.exponent,
          r = t.exponent;
        if (Number.isFinite(i) && Number.isFinite(r))
          return $(this.significand * t.significand, i + r);
        if (
          i !== i ||
          r !== r ||
          this.significand === 0n ||
          t.significand === 0n
        )
          return x.NAN;
        let n = this.significand > 0n ? 1n : -1n,
          s = t.significand > 0n ? 1n : -1n;
        return n * s > 0n ? x.POSITIVE_INFINITY : x.NEGATIVE_INFINITY;
      }
      neg() {
        let t = this.significand;
        return t === 0n
          ? this
          : Number.isFinite(this.exponent)
            ? $(-t, this.exponent)
            : t > 0n
              ? x.NEGATIVE_INFINITY
              : x.POSITIVE_INFINITY;
      }
      abs() {
        return this.significand >= 0n
          ? this
          : Number.isFinite(this.exponent)
            ? $(-this.significand, this.exponent)
            : x.POSITIVE_INFINITY;
      }
      floor() {
        let t = this.exponent;
        if (t >= 0) return this;
        if (Number.isFinite(t)) {
          let i = this.trunc();
          return this.significand < 0n ? i.sub($(1n, 0)) : i;
        }
        return this;
      }
      ceil() {
        let t = this.exponent;
        if (t >= 0) return this;
        if (Number.isFinite(t)) {
          let i = this.trunc();
          return this.significand > 0n ? i.add($(1n, 0)) : i;
        }
        return this;
      }
      round() {
        let t = this.exponent;
        if (t >= 0) return this;
        if (Number.isFinite(t)) {
          let i = $(5n, -1);
          return this.significand > 0n
            ? this.add(i).trunc()
            : this.sub(i).trunc();
        }
        return this;
      }
      trunc() {
        let t = this.exponent;
        if (t >= 0) return this;
        if (Number.isFinite(t)) {
          let i = this.significand / _(-t);
          return $(i === 0n ? 0n : i, 0);
        }
        return this;
      }
      div(t) {
        typeof t == "number" && (t = new x(t));
        let i = this.exponent,
          r = t.exponent,
          n = this.significand,
          s = t.significand;
        if (Number.isFinite(i) && Number.isFinite(r)) {
          if (s === 0n)
            return n === 0n
              ? x.NAN
              : n > 0n
                ? x.POSITIVE_INFINITY
                : x.NEGATIVE_INFINITY;
          if (n === 0n) return $(0n, 0);
          let o = x.precision,
            u = 10,
            p = n < 0n ? -n : n,
            g = s < 0n ? -s : s,
            d = Z(p),
            m = Z(g),
            b = o + u + Math.max(0, m - d),
            I = _(b),
            w = (n * I) / s,
            z = i - r - b;
          return $(w, z).toPrecision(o);
        }
        if (i !== i || r !== r) return x.NAN;
        let a = !Number.isFinite(i),
          l = !Number.isFinite(r);
        if (a && l) return x.NAN;
        if (a) {
          let o = n > 0n ? 1n : -1n,
            u = s > 0n ? 1n : s < 0n ? -1n : 1n;
          return o * u > 0n ? x.POSITIVE_INFINITY : x.NEGATIVE_INFINITY;
        }
        return $(0n, 0);
      }
      inv() {
        return $(1n, 0).div(this);
      }
      divToward(t, i) {
        typeof t == "number" && (t = new x(t));
        let r = this.exponent,
          n = t.exponent,
          s = this.significand,
          a = t.significand;
        if (!Number.isFinite(r) || !Number.isFinite(n) || a === 0n || s === 0n)
          return this.div(t);
        let l = s < 0n != a < 0n,
          o = s < 0n ? -s : s,
          u = a < 0n ? -a : a,
          p = x.precision,
          g = p + 10 + Math.max(0, Z(u) - Z(o)),
          d = o * _(g),
          m = d / u,
          b = d % u !== 0n,
          I = r - n - g,
          w = l ? i === "floor" : i === "ceiling",
          [z, O] = br(m, b, I, p, w);
        return $(l ? -z : z, O);
      }
      sqrtToward(t) {
        if (this.significand === 0n)
          return this.exponent !== this.exponent ? this : x.ZERO;
        if (!Number.isFinite(this.exponent))
          return this.significand > 0n ? x.POSITIVE_INFINITY : x.NAN;
        if (this.significand < 0n) return x.NAN;
        let i = x.precision,
          r = 4,
          n = this.significand,
          s = this.exponent,
          a = s + Z(n) - 1,
          l = Math.floor(a / 2),
          o = i + r - l;
        s + 2 * o < 0 && (o = Math.ceil(-s / 2) + 1);
        let u = s + 2 * o,
          p = u >= 0 ? n * _(u) : n / _(-u),
          g = zt(p),
          d = g * g !== p,
          [m, b] = br(g, d, -o, i, t === "ceiling");
        return $(m, b);
      }
      mod(t) {
        typeof t == "number" && (t = new x(t));
        let i = this.exponent,
          r = t.exponent;
        if (Number.isFinite(i) && Number.isFinite(r)) {
          if (t.significand === 0n) return x.NAN;
          if (this.significand === 0n) return $(0n, 0);
          let n = i - r,
            s = n >= 0 ? this.significand * _(n) : this.significand,
            a = n >= 0 ? t.significand : t.significand * _(-n),
            l = s / a;
          return this.sub($(l, 0).mul(t));
        }
        return i !== i || r !== r || !Number.isFinite(i) ? x.NAN : new x(this);
      }
      pow(t) {
        if (
          (typeof t == "number" && (t = new x(t)),
          this.isNaN() || t.isNaN() || !t.isFinite())
        )
          return x.NAN;
        if (t.isInteger()) {
          let o = t.toBigInt();
          if (o === 0n) return $(1n, 0);
          if (!this.isFinite())
            return o > 0n
              ? this.significand < 0n && o % 2n !== 0n
                ? x.NEGATIVE_INFINITY
                : x.POSITIVE_INFINITY
              : $(0n, 0);
          if (this.isZero()) return o > 0n ? $(0n, 0) : x.POSITIVE_INFINITY;
          if (o < 0n) return this.pow(t.neg()).inv();
          let u = this.significand < 0n ? -this.significand : this.significand,
            p = Z(u),
            g = p > 15 ? p - 15 : 0,
            d = g > 0 ? Number(u / 10n ** BigInt(g)) : Number(u),
            m = Math.log10(d) + g + this.exponent,
            b = Number(o) * m;
          if (b > 9e15)
            return this.significand < 0n && o % 2n !== 0n
              ? x.NEGATIVE_INFINITY
              : x.POSITIVE_INFINITY;
          if (b < -9e15) return $(0n, 0);
          let I = x.precision,
            w = $(1n, 0),
            z = this,
            O = o;
          for (; O > 0n;)
            (O & 1n && (w = w.mul(z).toPrecision(I)),
              (O >>= 1n),
              O > 0n && (z = z.mul(z).toPrecision(I)));
          return w;
        }
        if (!this.isFinite())
          return this.significand < 0n
            ? x.NAN
            : t.significand > 0n
              ? x.POSITIVE_INFINITY
              : x.ZERO;
        if (this.isZero())
          return t.significand > 0n ? x.ZERO : x.POSITIVE_INFINITY;
        if (this.significand < 0n) return x.NAN;
        let i = this.significand,
          r = this.exponent + Z(i) - 1,
          n = t.significand < 0n ? -t.significand : t.significand,
          s = t.exponent + Z(n) - 1 + Math.log10(Math.abs(r) * 2.303 + 3) + 1,
          a = Math.min(20, Math.max(2, Math.ceil(s) + 2)),
          l = x.precision;
        x.precision = l + a;
        try {
          let o = dl(this, l + a);
          return t.mul(o).exp().toPrecision(l);
        } finally {
          x.precision = l;
        }
      }
      toNumber() {
        return Number.isFinite(this.exponent)
          ? this.significand === 0n
            ? 0
            : this.exponent === 0
              ? Number(this.significand)
              : Number(this.toString())
          : this.exponent !== this.exponent
            ? NaN
            : this.significand > 0n
              ? 1 / 0
              : -1 / 0;
      }
      toString() {
        if (!Number.isFinite(this.exponent))
          return this.exponent !== this.exponent
            ? "NaN"
            : this.significand > 0n
              ? "Infinity"
              : "-Infinity";
        if (this.significand === 0n) return "0";
        let t = this.significand < 0n,
          i = (t ? -this.significand : this.significand).toString(),
          r = i.length,
          n = r + this.exponent - 1,
          s = t ? "-" : "";
        if (n > 20 || n < -6) {
          let o = r === 1 ? i : i[0] + "." + i.slice(1),
            u = n >= 0 ? "+" : "";
          return `${s}${o}e${u}${n}`;
        }
        if (this.exponent >= 0) return s + i + "0".repeat(this.exponent);
        let a = -this.exponent;
        if (a < r) {
          let o = i.slice(0, r - a),
            u = i.slice(r - a);
          return `${s}${o}.${u}`;
        }
        let l = a - r;
        return `${s}0.${"0".repeat(l)}${i}`;
      }
      toFixed(t) {
        let i = t ?? 0;
        if (!Number.isFinite(this.exponent))
          return this.exponent !== this.exponent
            ? "NaN"
            : this.significand > 0n
              ? "Infinity"
              : "-Infinity";
        let r = this.significand < 0n,
          n = r ? -this.significand : this.significand,
          s = this.exponent + i,
          a;
        if (s >= 0) a = n * _(s);
        else {
          let g = _(-s),
            d = n / g,
            m = n % g,
            b = g / 2n;
          m > b
            ? (a = d + 1n)
            : m < b || g % 2n !== 0n || d % 2n === 0n
              ? (a = d)
              : (a = d + 1n);
        }
        let l = r && a !== 0n ? "-" : "",
          o = a.toString();
        if (i === 0) return `${l}${o}`;
        if (o.length <= i) {
          let g = o.padStart(i, "0");
          return `${l}0.${g}`;
        }
        let u = o.slice(0, o.length - i),
          p = o.slice(o.length - i);
        return `${l}${u}.${p}`;
      }
      toPrecision(t) {
        if (this.significand === 0n || !Number.isFinite(this.exponent))
          return this;
        let i = this.significand < 0n ? -this.significand : this.significand,
          r = Z(i);
        if (r <= t) return this;
        let n = r - t,
          s = _(n),
          a = i / s,
          l = i - a * s,
          o = s / 2n;
        (l > o || (l === o && a % 2n !== 0n)) && (a += 1n);
        let u = this.significand < 0n ? -a : a;
        return $(u, this.exponent + n);
      }
      toBigInt() {
        if (!Number.isFinite(this.exponent))
          throw this.exponent !== this.exponent
            ? new RangeError("Cannot convert NaN to BigInt")
            : new RangeError("Cannot convert Infinity to BigInt");
        if (this.exponent >= 0) return this.significand * _(this.exponent);
        let t = _(-this.exponent);
        return this.significand / t;
      }
    },
    gl = 8,
    Ze = [];
  function dl(e, t) {
    let i = e.significand,
      r = e.exponent;
    for (let s = Ze.length - 1; s >= 0; s--) {
      let a = Ze[s];
      if (a.prec === t && a.exp === r && a.sig === i) return a.ln;
    }
    let n = e.ln();
    return (
      Ze.push({ sig: i, exp: r, prec: t, ln: n }),
      Ze.length > gl && Ze.shift(),
      n
    );
  }
  function fl(e) {
    let t = e + 20 + Math.ceil(Math.log10(e + 10)),
      i = h.precision;
    h.precision = t;
    try {
      let r = Math.ceil((t * Math.LN10) / 4) + 5,
        n = new h(r),
        s = n.mul(n),
        a = h.ONE,
        l = h.ONE,
        o = h.ZERO,
        u = h.ZERO,
        p = h.ONE.div(new h(10).pow(t)),
        g = 6 * r + 100;
      for (let d = 1; d <= g; d++) {
        let m = new h(d).mul(d);
        if (
          ((a = a.mul(s).div(m).toPrecision(t)),
          (u = u.add(h.ONE.div(d)).toPrecision(t)),
          (l = l.add(a).toPrecision(t)),
          (o = o.add(a.mul(u)).toPrecision(t)),
          d > r && a.lt(l.mul(p)))
        )
          break;
      }
      return o.div(l).sub(n.ln()).toPrecision(e);
    } finally {
      h.precision = i;
    }
  }
  function $(e, t) {
    let [i, r] = _t(e, t),
      n = Object.create(h.prototype);
    return ((n.significand = i), (n.exponent = r), n);
  }
  function br(e, t, i, r, n) {
    if (e === 0n) return [n && t ? 1n : 0n, i];
    let s = Z(e);
    if (s <= r) return [n && t ? e + 1n : e, i];
    let a = s - r,
      l = _(a),
      o = e / l,
      u = t || e % l !== 0n;
    return (n && u && (o += 1n), [o, i + a]);
  }
  var vr = 1000000000n,
    Nr = 1000n;
  function _t(e, t) {
    if (e === 0n) return [0n, 0];
    for (; e % vr === 0n;) ((e /= vr), (t += 9));
    for (; e % Nr === 0n;) ((e /= Nr), (t += 3));
    for (; e % 10n === 0n;) ((e /= 10n), (t += 1));
    return [e, t];
  }
  function ml(e) {
    return Number.isNaN(e)
      ? [0n, NaN]
      : e === 1 / 0
        ? [1n, 1 / 0]
        : e === -1 / 0
          ? [-1n, 1 / 0]
          : Number.isInteger(e)
            ? _t(BigInt(e), 0)
            : vn(e.toString());
  }
  function vn(e) {
    if (((e = e.trim()), e === "" || e === "NaN")) return [0n, NaN];
    if (e === "Infinity" || e === "+Infinity") return [1n, 1 / 0];
    if (e === "-Infinity") return [-1n, 1 / 0];
    let t,
      i = 0,
      r = e.search(/[eE]/);
    if (r !== -1) {
      if (
        ((t = e.slice(0, r)), (i = Number(e.slice(r + 1))), !Number.isFinite(i))
      )
        return [0n, NaN];
    } else t = e;
    let n = !1;
    t.startsWith("-")
      ? ((n = !0), (t = t.slice(1)))
      : t.startsWith("+") && (t = t.slice(1));
    let s = t.indexOf("."),
      a,
      l;
    (s === -1
      ? ((a = t), (l = ""))
      : ((a = t.slice(0, s)), (l = t.slice(s + 1))),
      (a = a.replace(/^0+/, "") || "0"));
    let o = a + l;
    if (o.length === 0 || !/^\d+$/.test(o)) return [0n, NaN];
    let u = BigInt(o);
    n && (u = -u);
    let p = -l.length;
    return _t(u, p + i);
  }
  var xl = Math.log2(10),
    yl = Math.log10(2),
    Tl = 16,
    Ei = 1e6;
  function ce(e, t) {
    let i = Math.ceil(t * xl) + Tl,
      r = BigInt(i);
    return e.exponent >= 0
      ? [(e.significand * _(e.exponent)) << r, i]
      : [(e.significand << r) / _(-e.exponent), i];
  }
  function pe(e, t, i) {
    if (e === 0n) return h.ZERO;
    let r = e < 0n,
      n = r ? -e : e,
      s = BigInt(t),
      a = ge(n) - t,
      l = Math.floor(a * yl),
      o = i + 4 - l,
      u,
      p;
    if (o >= 0) ((u = (n * _(o) + (1n << (s - 1n))) >> s), (p = -o));
    else {
      let d = _(-o) << s;
      ((u = (n + d / 2n) / d), (p = -o));
    }
    if (u === 0n) return h.ZERO;
    let g = Z(u);
    if (g > i) {
      let d = g - i,
        m = _(d),
        b = m / 2n,
        I = u % m;
      ((u = u / m), I >= b && (u += 1n), (p += d));
    }
    return $(r ? -u : u, p);
  }
  function Y(e) {
    let t = e.significand < 0n ? -e.significand : e.significand;
    return e.exponent + Z(t) - 1;
  }
  var Ir = BigInt(Number.MAX_SAFE_INTEGER),
    xe = null;
  function Nn(e) {
    if (xe !== null) {
      if (xe.bits === e) return xe.value;
      if (xe.bits > e) return xe.value >> BigInt(xe.bits - e);
    }
    let t = kn(10n << BigInt(e), e);
    return ((xe = { bits: e, value: t }), t);
  }
  h.prototype.sqrt = function () {
    if (this.isNaN()) return h.NAN;
    if (this.isZero()) return h.ZERO;
    if (!this.isFinite())
      return this.significand > 0n ? h.POSITIVE_INFINITY : h.NAN;
    if (this.significand < 0n) return h.NAN;
    let e = h.precision,
      t = e + 10,
      i = Y(this),
      r = Math.floor(i / 2),
      n = $(this.significand, this.exponent - 2 * r),
      [s, a] = ce(n, t),
      l = wt(s, a),
      o = pe(l, a, e);
    return $(o.significand, o.exponent + r);
  };
  h.prototype.cbrt = function () {
    if (this.isNaN()) return h.NAN;
    if (this.isZero()) return h.ZERO;
    if (!this.isFinite())
      return this.significand > 0n ? h.POSITIVE_INFINITY : h.NEGATIVE_INFINITY;
    if (this.significand < 0n) return this.neg().cbrt().neg();
    let e = h.precision,
      t = e + 10,
      i = Y(this),
      r = Math.floor(i / 3),
      n = $(this.significand, this.exponent - 3 * r),
      [s, a] = ce(n, t),
      l = s << BigInt(2 * a),
      o,
      u = n.toNumber();
    if (a <= 1e3 && Number.isFinite(u) && u > 0) {
      let d = Number(1n << BigInt(a)),
        m = Math.cbrt(u);
      Number.isFinite(m) && m > 0
        ? ((o = BigInt(Math.floor(m * d))), o === 0n && (o = 1n))
        : (o = Er(l));
    } else o = Er(l);
    let p;
    do {
      p = o;
      let d = o * o;
      if (d === 0n) {
        o = 1n;
        break;
      }
      o = (2n * o + l / d) / 3n;
    } while (W(o - p) > 1n);
    {
      let d = (2n * o + l / (o * o)) / 3n,
        m = W(o * o * o - l);
      W(d * d * d - l) < m && (o = d);
    }
    let g = pe(o, a, e);
    return $(g.significand, g.exponent + r);
  };
  h.sqrt = function (e) {
    return e.sqrt();
  };
  h.cbrt = function (e) {
    return e.cbrt();
  };
  h.prototype.exp = function () {
    if (this.isNaN()) return h.NAN;
    if (!this.isFinite())
      return this.significand > 0n ? h.POSITIVE_INFINITY : h.ZERO;
    if (this.isZero()) return h.ONE;
    if (Y(this) >= 17)
      return this.significand > 0n ? h.POSITIVE_INFINITY : h.ZERO;
    let e = h.precision,
      t = this.significand < 0n ? -this.significand : this.significand,
      i = Math.max(0, this.exponent + Z(t)),
      r = e + 20 + i,
      [n, s] = ce(this, r),
      a = Nn(s),
      l = n / a,
      o = n - l * a;
    if ((o < 0n && ((l -= 1n), (o += a)), l > Ir || l < -Ir))
      return l > 0n ? h.POSITIVE_INFINITY : h.ZERO;
    let u = pe(ui(o, s), s, e),
      p = u.exponent + Number(l);
    return Number.isSafeInteger(p)
      ? $(u.significand, p)
      : l > 0n
        ? h.POSITIVE_INFINITY
        : h.ZERO;
  };
  h.prototype.ln = function () {
    if (this.isNaN()) return h.NAN;
    if (!this.isFinite())
      return this.significand > 0n ? h.POSITIVE_INFINITY : h.NAN;
    if (this.isZero()) return h.NEGATIVE_INFINITY;
    if (this.significand < 0n) return h.NAN;
    if (this.eq(1)) return h.ZERO;
    let e = h.precision,
      t = this.significand,
      i = Z(t),
      r = this.exponent + i - 1,
      n = $(t, -(i - 1)),
      s = Math.abs(r).toString().length,
      a = e + 20 + s,
      [l, o] = ce(n, a),
      u = Nn(o),
      p = kn(l, o) + BigInt(r) * u;
    return pe(p, o, e);
  };
  h.prototype.log = function (e) {
    let t = e instanceof h ? e : new h(e);
    return this.ln().div(t.ln());
  };
  h.exp = function (e) {
    return e.exp();
  };
  h.ln = function (e) {
    return e.ln();
  };
  h.log10 = function (e) {
    return e.log(10);
  };
  h.log2 = function (e) {
    return e.log(2);
  };
  h.prototype.sin = function () {
    if (this.isNaN() || !this.isFinite()) return h.NAN;
    if (this.isZero()) return h.ZERO;
    let e = h.precision,
      t = Y(this);
    if (t < 0 && -2 * t >= e + 4) return this.toPrecision(e);
    let i = e + 15 + (t < 0 ? -t : 0);
    if (t + i + 30 > Ei) return h.NAN;
    let [r, n] = ce(this, i),
      [s] = Ii(r, n);
    return pe(s, n, e);
  };
  h.prototype.cos = function () {
    if (this.isNaN() || !this.isFinite()) return h.NAN;
    if (this.isZero()) return h.ONE;
    let e = h.precision,
      t = e + 15;
    if (Y(this) + t + 30 > Ei) return h.NAN;
    let [i, r] = ce(this, t),
      [, n] = Ii(i, r);
    return pe(n, r, e);
  };
  h.prototype.tan = function () {
    if (this.isNaN() || !this.isFinite()) return h.NAN;
    if (this.isZero()) return h.ZERO;
    let e = h.precision,
      t = Y(this);
    if (t < 0 && -2 * t >= e + 4) return this.toPrecision(e);
    let i = e + 15 + (t < 0 ? -t : 0);
    if (t + i + 30 > Ei) return h.NAN;
    let [r, n] = ce(this, i),
      [s, a] = Ii(r, n);
    if (a === 0n) return s > 0n ? h.POSITIVE_INFINITY : h.NEGATIVE_INFINITY;
    let l = (s << BigInt(n)) / a;
    return pe(l, n, e);
  };
  h.prototype.atan = function () {
    if (this.isNaN()) return h.NAN;
    if (this.isZero()) return h.ZERO;
    if (!this.isFinite()) {
      let a = h.PI.div(h.TWO);
      return this.significand > 0n ? a : a.neg();
    }
    let e = h.precision,
      t = Y(this);
    if (t < 0 && -2 * t >= e + 4) return this.toPrecision(e);
    let i = e + 15 + (t < 0 ? -t : 0),
      [r, n] = ce(this, i),
      s = It(r, n);
    return pe(s, n, e);
  };
  h.prototype.asin = function () {
    if (this.isNaN() || !this.isFinite()) return h.NAN;
    if (this.isZero()) return h.ZERO;
    let e = this.abs(),
      t = h.ONE;
    if (e.gt(t)) return h.NAN;
    if (e.eq(t)) {
      let m = h.PI.div(h.TWO);
      return this.significand > 0n ? m : m.neg();
    }
    let i = h.precision,
      r = Y(this);
    if (r < 0 && -2 * r >= i + 4) return this.toPrecision(i);
    let n = i + 20 + (r < 0 ? -r : 0),
      [s, a] = ce(this, n),
      l = 1n << BigInt(a),
      o = Ja(s, s, a),
      u = l - o,
      p = wt(u, a),
      g = Xa(s, p, a),
      d = It(g, a);
    return pe(d, a, i);
  };
  h.prototype.acos = function () {
    return this.isNaN()
      ? h.NAN
      : this.isFinite()
        ? this.abs().gt(h.ONE)
          ? h.NAN
          : this.eq(1)
            ? h.ZERO
            : this.eq(-1)
              ? h.PI
              : h.PI.div(h.TWO).sub(this.asin())
        : h.NAN;
  };
  h.sin = function (e) {
    return e.sin();
  };
  h.cos = function (e) {
    return e.cos();
  };
  h.tan = function (e) {
    return e.tan();
  };
  h.asin = function (e) {
    return e.asin();
  };
  h.acos = function (e) {
    return e.acos();
  };
  h.atan = function (e) {
    return e.atan();
  };
  h.atan2 = function (e, t) {
    let i = e instanceof h ? e : new h(e);
    if (i.isNaN() || t.isNaN()) return h.NAN;
    let r = h.PI,
      n = r.div(h.TWO);
    if (t.isZero())
      return i.isZero() ? h.ZERO : i.significand > 0n ? n : n.neg();
    let s = i.div(t);
    return t.significand > 0n
      ? s.atan()
      : i.significand >= 0n
        ? s.atan().add(r)
        : s.atan().sub(r);
  };
  h.prototype.sinh = function () {
    if (this.isNaN()) return h.NAN;
    if (this.isZero()) return h.ZERO;
    if (!this.isFinite())
      return this.significand > 0n ? h.POSITIVE_INFINITY : h.NEGATIVE_INFINITY;
    let e = h.precision,
      t = Y(this);
    if (t < 0) {
      if (-2 * t >= e + 4) return this.toPrecision(e);
      let n = h.precision;
      h.precision = e - t + 5;
      try {
        let s = this.exp();
        return s.sub(s.inv()).div(h.TWO).toPrecision(e);
      } finally {
        h.precision = n;
      }
    }
    if (Math.abs(this.toNumber()) > 1.16 * (e + 3)) {
      let n = this.abs().exp().div(h.TWO);
      return this.significand > 0n ? n : n.neg();
    }
    let i = this.exp(),
      r = i.inv();
    return i.sub(r).div(h.TWO);
  };
  h.prototype.cosh = function () {
    if (this.isNaN()) return h.NAN;
    if (this.isZero()) return h.ONE;
    if (!this.isFinite()) return h.POSITIVE_INFINITY;
    let e = h.precision;
    if (Math.abs(this.toNumber()) > 1.16 * (e + 3))
      return this.abs().exp().div(h.TWO);
    let t = this.exp(),
      i = t.inv();
    return t.add(i).div(h.TWO);
  };
  h.prototype.tanh = function () {
    if (this.isNaN()) return h.NAN;
    if (this.isZero()) return h.ZERO;
    if (!this.isFinite()) return this.significand > 0n ? h.ONE : h.NEGATIVE_ONE;
    let e = h.precision,
      t = Y(this);
    if (t < 0) {
      if (-2 * t >= e + 4) return this.toPrecision(e);
      let r = h.precision;
      h.precision = e - t + 5;
      try {
        let n = this.mul(h.TWO).exp();
        return n.sub(h.ONE).div(n.add(h.ONE)).toPrecision(e);
      } finally {
        h.precision = r;
      }
    }
    if (Math.abs(this.toNumber()) > 1.16 * (e + 3))
      return this.significand > 0n ? h.ONE : h.NEGATIVE_ONE;
    let i = this.mul(h.TWO).exp();
    return i.sub(h.ONE).div(i.add(h.ONE));
  };
  h.sinh = function (e) {
    return e.sinh();
  };
  h.cosh = function (e) {
    return e.cosh();
  };
  h.tanh = function (e) {
    return e.tanh();
  };
  h.prototype.expm1 = function () {
    if (this.isNaN()) return h.NAN;
    if (!this.isFinite())
      return this.significand > 0n ? h.POSITIVE_INFINITY : h.NEGATIVE_ONE;
    if (this.isZero()) return h.ZERO;
    let e = h.precision,
      t = Y(this);
    if (t < 0 && -t >= e + 2) return this.toPrecision(e);
    if (t < 0) {
      let i = h.precision;
      h.precision = e - t + 5;
      try {
        return this.exp().sub(h.ONE).toPrecision(e);
      } finally {
        h.precision = i;
      }
    }
    return this.exp().sub(h.ONE);
  };
  h.prototype.log1p = function () {
    if (this.isNaN()) return h.NAN;
    if (!this.isFinite())
      return this.significand > 0n ? h.POSITIVE_INFINITY : h.NAN;
    if (this.isZero()) return h.ZERO;
    let e = h.ONE.add(this);
    if (e.isZero()) return h.NEGATIVE_INFINITY;
    if (e.significand < 0n) return h.NAN;
    let t = h.precision,
      i = Y(this);
    if (i < 0 && -i >= t + 2) return this.toPrecision(t);
    if (i < 0) {
      let r = h.precision;
      h.precision = t - i + 5;
      try {
        return h.ONE.add(this).ln().toPrecision(t);
      } finally {
        h.precision = r;
      }
    }
    return h.ONE.add(this).ln();
  };
  h.prototype.asinh = function () {
    if (this.isNaN()) return h.NAN;
    if (this.isZero()) return h.ZERO;
    if (!this.isFinite())
      return this.significand > 0n ? h.POSITIVE_INFINITY : h.NEGATIVE_INFINITY;
    let e = this.significand < 0n,
      t = this.abs(),
      i = h.precision,
      r = Y(this);
    if (r < 0 && -2 * r >= i + 4) return this.toPrecision(i);
    let n = () => t.add(t.mul(t).add(h.ONE).sqrt()).ln(),
      s;
    if (r < 0) {
      let a = h.precision;
      h.precision = i - r + 5;
      try {
        s = n().toPrecision(i);
      } finally {
        h.precision = a;
      }
    } else s = n();
    return e ? s.neg() : s;
  };
  h.prototype.acosh = function () {
    if (this.isNaN()) return h.NAN;
    if (!this.isFinite())
      return this.significand > 0n ? h.POSITIVE_INFINITY : h.NAN;
    if (this.lt(h.ONE)) return h.NAN;
    if (this.eq(1)) return h.ZERO;
    let e = this.sub(h.ONE).div(h.TWO).sqrt();
    return h.TWO.mul(e.asinh());
  };
  h.prototype.atanh = function () {
    if (this.isNaN() || !this.isFinite()) return h.NAN;
    if (this.isZero()) return h.ZERO;
    let e = this.abs();
    if (e.eq(1))
      return this.significand > 0n ? h.POSITIVE_INFINITY : h.NEGATIVE_INFINITY;
    if (e.gt(h.ONE)) return h.NAN;
    let t = h.precision,
      i = Y(this);
    if (-2 * i >= t + 4) return this.toPrecision(t);
    let r = h.precision;
    h.precision = t - i + 5;
    try {
      return h.ONE.add(this)
        .div(h.ONE.sub(this))
        .ln()
        .div(h.TWO)
        .toPrecision(t);
    } finally {
      h.precision = r;
    }
  };
  h.prototype.nthRoot = function (e) {
    if (this.isNaN() || !Number.isInteger(e) || e === 0) return h.NAN;
    if (e === 1) return this;
    if (e === 2) return this.sqrt();
    if (e === 3) return this.cbrt();
    if (e < 0) return this.nthRoot(-e).inv();
    if (this.isZero()) return h.ZERO;
    if (!this.isFinite())
      return this.significand > 0n
        ? h.POSITIVE_INFINITY
        : e % 2 === 0
          ? h.NAN
          : h.NEGATIVE_INFINITY;
    if (this.significand < 0n)
      return e % 2 === 0 ? h.NAN : this.neg().nthRoot(e).neg();
    let t = h.precision,
      i = h.precision;
    h.precision = t + 8;
    try {
      return h.exp(this.ln().div(new h(e))).toPrecision(t);
    } finally {
      h.precision = i;
    }
  };
  h.asinh = function (e) {
    return e.asinh();
  };
  h.acosh = function (e) {
    return e.acosh();
  };
  h.atanh = function (e) {
    return e.atanh();
  };
  h.expm1 = function (e) {
    return e.expm1();
  };
  h.log1p = function (e) {
    return e.log1p();
  };
  h.nthRoot = function (e, t) {
    return e.nthRoot(t);
  };
  function Er(e) {
    let t = ge(e);
    if (t <= 1023) {
      let o = Math.cbrt(Number(e));
      if (Number.isFinite(o) && o >= 1) return BigInt(Math.floor(o));
    }
    let i = t - 51,
      r = Number(e >> BigInt(i)),
      n = Math.cbrt(r),
      s = Math.floor(i / 3),
      a = i % 3;
    (a === 1 && (n *= 1.2599210498948732),
      a === 2 && (n *= 1.5874010519681994));
    let l = BigInt(Math.round(n)) << BigInt(s);
    return l > 0n ? l : 1n;
  }
  var no = 1n << 32n,
    so = [
      BigInt(4),
      BigInt(2),
      BigInt(4),
      BigInt(2),
      BigInt(4),
      BigInt(6),
      BigInt(2),
      BigInt(6),
    ],
    kl = 53,
    ao = Math.floor(Math.log10(Math.pow(2, kl))),
    bl = 1e6;
  function vl(e) {
    let t = !!e.matchAny(["-", "\u2212"]);
    for (; e.matchAny(["+", "\uFE62"]) || e.skipSpace();)
      e.matchAny(["-", "\u2212"]) && (t = !t);
    return t ? "-" : "+";
  }
  function he(e, t, i = "whole") {
    let r = [],
      n = !1;
    for (; !n;) {
      for (; /^[0-9]$/.test(e.peek);)
        (r.push(e.nextToken()), e.skipVisualSpace());
      n = !0;
      let s =
        i === "whole"
          ? t.wholeDigitGroupSeparatorTokens
          : t.fractionalDigitGroupSeparatorTokens;
      if (i !== "none" && s.length > 0) {
        let a = e.index;
        (e.skipVisualSpace(),
          e.matchAll(s) &&
            (e.skipVisualSpace(),
            /^[0-9]$/.test(e.peek) ? (n = !1) : (e.index = a)));
      }
    }
    return r.join("");
  }
  function Kt(e, t, i) {
    let r = e.index,
      n = vl(e),
      s = he(e, t, i);
    return s ? (n === "-" ? "-" + s : s) : ((e.index = r), "");
  }
  function Nl(e, t) {
    let i = e.index;
    if ((e.skipVisualSpace(), e.matchAny(["e", "E"]))) {
      let r = Kt(e, t, "none");
      if (r) return r;
    }
    if (
      ((e.index = i),
      e.match("\\times") &&
        (e.skipVisualSpace(),
        e.matchAll(["1", "0"]) && (e.skipVisualSpace(), e.match("^"))))
    ) {
      if ((e.skipVisualSpace(), /^[0-9]$/.test(e.peek))) return e.nextToken();
      if (e.match("<{>")) {
        e.skipVisualSpace();
        let r = Kt(e, t, "whole");
        if ((e.skipVisualSpace(), r && e.match("<}>"))) return r;
      }
    }
    if (((e.index = i), e.skipVisualSpace(), e.match("\\%"))) return "-2";
    if (
      ((e.index = i),
      e.matchAll(t.exponentProductTokens) &&
        (e.skipVisualSpace(), e.matchAll(t.beginExponentMarkerTokens)))
    ) {
      e.skipVisualSpace();
      let r = Kt(e, t, "none");
      if ((e.skipVisualSpace(), r && e.matchAll(t.endExponentMarkerTokens)))
        return r;
    }
    return ((e.index = i), "");
  }
  function Sr(e) {
    let t = e.index;
    if (
      e.matchAll(["\\overset", "<{>"]) &&
      (e.match(".") || e.match("\\cdots")) &&
      e.matchAll(["<}>", "<{>"])
    ) {
      let i = e.nextToken();
      if (i && /^\d$/.test(i) && e.match("<}>")) return i;
    }
    return ((e.index = t), null);
  }
  function Il(e) {
    let t = e.peek;
    return (
      t === "\\overline" ||
      t === "\\overset" ||
      t === "\\wideparen" ||
      t === "\\overarc" ||
      t === "(" ||
      t === "\\left"
    );
  }
  function In(e, t) {
    let i = e.index,
      r = e.options.repeatingDecimal,
      n = "";
    if ((r === "auto" || r === "parentheses") && e.match("("))
      return (
        (n = he(e, t, "fraction")),
        n && e.match(")") ? `(${n})` : ((e.index = i), "")
      );
    if (
      ((e.index = i),
      (r === "auto" || r === "parentheses") && e.matchAll(["\\left", "("]))
    )
      return (
        (n = he(e, t, "fraction")),
        n && e.matchAll(["\\right", ")"]) ? `(${n})` : ((e.index = i), "")
      );
    if (
      ((e.index = i),
      (r === "auto" || r === "vinculum") && e.matchAll(["\\overline", "<{>"]))
    )
      return (
        (n = he(e, t, "fraction")),
        n && e.match("<}>") ? `(${n})` : ((e.index = i), "")
      );
    if (
      ((e.index = i),
      (r === "auto" || r === "arc") &&
        (e.matchAll(["\\wideparen", "<{>"]) ||
          e.matchAll(["\\overarc", "<{>"])))
    )
      return (
        (n = he(e, t, "fraction")),
        n && e.match("<}>") ? `(${n})` : ((e.index = i), "")
      );
    if (((e.index = i), r === "auto" || r === "dots")) {
      let s = Sr(e);
      if (s !== null) {
        if (((n = he(e, t, "fraction")), !n)) return `(${s})`;
        let a = Sr(e);
        if (a !== null) return `(${s}${n}${a})`;
      }
    }
    return ((e.index = i), "");
  }
  function Qt(e) {
    return e === 0
      ? { num: "0" }
      : Number.isInteger(e) && Math.abs(e) < bl
        ? e
        : { num: e.toString() };
  }
  function El(e, t) {
    let i = e.options.parseNumbers;
    if (i === !1 || i === "never") return null;
    let r = e.index;
    e.skipVisualSpace();
    let n = 1;
    for (; e.peek === "-" || e.peek === "+";)
      (e.match("-") ? (n = -n) : e.match("+"), e.skipVisualSpace());
    let s = "",
      a = "",
      l = !1;
    if (e.match(".") || e.matchAll(t.decimalSeparatorTokens)) {
      let d = e.peek;
      (/^[\d]$/.test(d) || Il(e)) && ((l = !0), (s = "0"));
    } else s = he(e, t, "whole");
    if (!s) return ((e.index = r), null);
    let o = e.index,
      u = !1;
    (l || e.match(".") || e.matchAll(t.decimalSeparatorTokens)) &&
      ((a = he(e, t, "fraction")), (u = !0));
    let p = !1;
    if (u) {
      let d = In(e, t);
      (d && ((a += d), (p = !0)),
        e.match("\\ldots") || e.matchAll(t.truncationMarkerTokens));
    }
    if (u && !a)
      return (
        (e.index = o),
        s.length < 10 ? Qt(n * parseInt(s, 10)) : { num: n < 0 ? "-" + s : s }
      );
    let g = Nl(e, t);
    if (!u && !g && s.length < 10) return Qt(n * parseInt(s, 10));
    if (!p && e.options.parseNumbers === "rational") {
      let d = s.length > 16 || (s.length === 16 && s > "9007199254740991");
      if (!a) {
        if (d) {
          let ee = n < 0 ? "-" + s : s;
          return g ? ["Multiply", { num: ee }, ["Power", 10, g]] : { num: ee };
        }
        let O = parseInt(s, 10);
        return g ? ["Multiply", n * O, ["Power", 10, g]] : Qt(n * O);
      }
      let m = a.length;
      if (s.length + m > 15) {
        let O = BigInt(s),
          ee = BigInt(a),
          re = BigInt(10) ** BigInt(m),
          D = O * re + ee,
          Se = n < 0 ? -D : D;
        return g
          ? [
              "Multiply",
              ["Rational", { num: Se.toString() }, Number(re)],
              ["Power", 10, g],
            ]
          : ["Rational", { num: Se.toString() }, Number(re)];
      }
      let b = parseInt(s, 10),
        I = parseInt(a, 10),
        w = b * 10 ** m + I,
        z = 10 ** m;
      return g
        ? ["Multiply", ["Rational", n * w, z], ["Power", 10, g]]
        : ["Rational", n * w, z];
    }
    return {
      num: (n < 0 ? "-" : "") + s + (u ? "." + a : "") + (g ? "e" + g : ""),
    };
  }
  var Sl = new Set([
      ...'!"#$%&(),/;:?@[]\\`|~'.split(""),
      "\\left",
      "\\bigl",
      "\\mleft",
    ]),
    Al = new Set([
      "\\!",
      "\\,",
      "\\:",
      "\\;",
      "\\enskip",
      "\\enspace",
      "\\space",
      "\\quad",
      "\\qquad",
    ]),
    wl = [
      "pt",
      "em",
      "mu",
      "ex",
      "mm",
      "cm",
      "in",
      "bp",
      "sp",
      "dd",
      "cc",
      "pc",
      "nc",
      "nd",
    ].map((e) => [...e]),
    $l = {
      sin: "Sin",
      cos: "Cos",
      tan: "Tan",
      cot: "Cot",
      sec: "Sec",
      csc: "Csc",
      sinh: "Sinh",
      cosh: "Cosh",
      tanh: "Tanh",
      coth: "Coth",
      sech: "Sech",
      csch: "Csch",
      arcsin: "Arcsin",
      arccos: "Arccos",
      arctan: "Arctan",
      arccot: "Arccot",
      arcsec: "Arcsec",
      arccsc: "Arccsc",
      asin: "Arcsin",
      acos: "Arccos",
      atan: "Arctan",
      arcsinh: "Arsinh",
      arccosh: "Arcosh",
      arctanh: "Artanh",
      arccoth: "Arcoth",
      arcsech: "Arsech",
      arccsch: "Arcsch",
      asinh: "Arsinh",
      acosh: "Arcosh",
      atanh: "Artanh",
      log: "Log",
      ln: "Ln",
      exp: "Exp",
      lg: "Lg",
      lb: "Lb",
      sqrt: "Sqrt",
      abs: "Abs",
      sgn: "Sgn",
      sign: "Sgn",
      floor: "Floor",
      ceil: "Ceil",
      round: "Round",
      max: "Max",
      min: "Min",
      gcd: "Gcd",
      lcm: "Lcm",
      cbrt: "Root",
      binom: "Binomial",
      nCr: "Binomial",
    },
    Ar = { "<space>": " ", "<$$>": "$$", "<$>": "$", "<{>": "{", "<}>": "}" },
    mt = null;
  function zl() {
    if (!mt) {
      mt = new Map();
      for (let [, e, t] of Re) mt.set(e, String.fromCodePoint(t));
    }
    return mt;
  }
  var wr = {
      "(": ["\\lparen", "("],
      ")": ["\\rparen", ")"],
      "[": ["\\lbrack", "\\[", "["],
      "]": ["\\rbrack", "\\]", "]"],
      "<": ["<", "\\langle"],
      ">": [">", "\\rangle"],
      "{": ["\\{", "\\lbrace"],
      "}": ["\\}", "\\rbrace"],
      ":": [":", "\\colon"],
      "|": ["|", "\\|", "\\lvert", "\\rvert"],
      "||": ["||", "\\Vert", "\\lVert", "\\rVert"],
    },
    Oe = {
      "\\left": "\\right",
      "\\bigl": "\\bigr",
      "\\Bigl": "\\Bigr",
      "\\biggl": "\\biggr",
      "\\Biggl": "\\Biggr",
      "\\big": "\\big",
      "\\Big": "\\Big",
      "\\bigg": "\\bigg",
      "\\Bigg": "\\Bigg",
      "\\mathopen": "\\mathclose",
      "\\mleft": "\\mright",
    },
    $r = new Set(Object.values(Oe)),
    pi = {
      "(": ")",
      "[": "]",
      "|": "|",
      "\\{": "\\}",
      "\\[": "\\]",
      "\\lbrace": "\\rbrace",
      "\\lparen": "\\rparen",
      "\\langle": "\\rangle",
      "\\lfloor": "\\rfloor",
      "\\lceil": "\\rceil",
      "\\vert": "\\vert",
      "\\lvert": "\\rvert",
      "\\Vert": "\\Vert",
      "\\lVert": "\\rVert",
      "\\lbrack": "\\rbrack",
      "\\ulcorner": "\\urcorner",
      "\\llcorner": "\\lrcorner",
      "\\lgroup": "\\rgroup",
      "\\lmoustache": "\\rmoustache",
      "\\llbracket": "\\rrbracket",
    };
  function _l(e) {
    if (e === null) return "null";
    if (e === void 0) return "undefined";
    if (e instanceof be) return "BoxedType";
    if (typeof e == "string") return `"${e}"`;
    if (typeof e == "object") {
      let t = e.constructor?.name;
      return t && t !== "Object" ? t : "object";
    }
    return `${typeof e} (${String(e)})`;
  }
  var Pl = class En {
    options;
    _index = 0;
    symbolTable = { parent: null, ids: {} };
    pushSymbolTable() {
      this.symbolTable = { parent: this.symbolTable, ids: {} };
    }
    popSymbolTable() {
      this.symbolTable = this.symbolTable.parent ?? this.symbolTable;
    }
    addSymbol(t, i) {
      if (
        (typeof i == "string" && (i = new be(i)),
        t in this.symbolTable.ids && !this.symbolTable.ids[t].is(i.type))
      )
        throw new Error(`Symbol ${t} already declared as a different type`);
      this.symbolTable.ids[t] = i;
    }
    _quantifierScopeDepth = 0;
    get inQuantifierScope() {
      return this._quantifierScopeDepth > 0;
    }
    enterQuantifierScope() {
      this._quantifierScopeDepth++;
    }
    exitQuantifierScope() {
      this._quantifierScopeDepth > 0 && this._quantifierScopeDepth--;
    }
    get index() {
      return this._index;
    }
    set index(t) {
      ((this._index = t), (this._lastPeek = ""), (this._peekCounter = 0));
    }
    _tokens;
    _positiveInfinityTokens;
    _negativeInfinityTokens;
    _notANumberTokens;
    _decimalSeparatorTokens;
    _wholeDigitGroupSeparatorTokens;
    _fractionalDigitGroupSeparatorTokens;
    _exponentProductTokens;
    _beginExponentMarkerTokens;
    _endExponentMarkerTokens;
    _truncationMarkerTokens;
    _imaginaryUnitTokens;
    _dictionary;
    _boundaries = [];
    _lastPeek = "";
    _peekCounter = 0;
    _lookAheadCache = null;
    _lookAheadIndex = -1;
    _tokenPrefixOffsets = null;
    constructor(t, i, r) {
      ((this._tokens = t),
        (this.options = r),
        (this._dictionary = i),
        (this._positiveInfinityTokens = j(this.options.positiveInfinity)),
        (this._negativeInfinityTokens = j(this.options.negativeInfinity)),
        (this._notANumberTokens = j(this.options.notANumber)),
        (this._decimalSeparatorTokens = j(this.options.decimalSeparator)),
        (this._wholeDigitGroupSeparatorTokens = []),
        (this._fractionalDigitGroupSeparatorTokens = []),
        this.options.digitGroupSeparator &&
          (typeof this.options.digitGroupSeparator == "string"
            ? ((this._wholeDigitGroupSeparatorTokens = j(
                this.options.digitGroupSeparator,
              )),
              (this._fractionalDigitGroupSeparatorTokens =
                this._wholeDigitGroupSeparatorTokens))
            : Array.isArray(this.options.digitGroupSeparator) &&
              ((this._wholeDigitGroupSeparatorTokens = j(
                this.options.digitGroupSeparator[0],
              )),
              (this._fractionalDigitGroupSeparatorTokens = j(
                this.options.digitGroupSeparator[1],
              )))),
        (this._exponentProductTokens = j(this.options.exponentProduct)),
        (this._beginExponentMarkerTokens = j(this.options.beginExponentMarker)),
        (this._endExponentMarkerTokens = j(this.options.endExponentMarker)),
        (this._truncationMarkerTokens = j(this.options.truncationMarker)),
        (this._imaginaryUnitTokens = j(this.options.imaginaryUnit)),
        (this._numberFormatTokens = {
          decimalSeparatorTokens: this._decimalSeparatorTokens,
          wholeDigitGroupSeparatorTokens: this._wholeDigitGroupSeparatorTokens,
          fractionalDigitGroupSeparatorTokens:
            this._fractionalDigitGroupSeparatorTokens,
          exponentProductTokens: this._exponentProductTokens,
          beginExponentMarkerTokens: this._beginExponentMarkerTokens,
          endExponentMarkerTokens: this._endExponentMarkerTokens,
          truncationMarkerTokens: this._truncationMarkerTokens,
        }));
    }
    _numberFormatTokens;
    getSymbolType(t) {
      let i = this.symbolTable;
      for (; i;) {
        if (t in i.ids) return i.ids[t];
        i = i.parent;
      }
      if (this.options.getSymbolType) {
        let r = this.options.getSymbolType(t);
        if (r instanceof be) return r;
        if (typeof r == "string")
          try {
            return new be(r);
          } catch (n) {
            let s = n instanceof Error ? n.message : String(n);
            throw new Error(
              `ce.parse(): getSymbolType("${t}") returned invalid type string "${r}". ${s}`,
            );
          }
        throw new Error(
          `ce.parse(): getSymbolType("${t}") must return a BoxedType or a type string, received ${_l(r)}`,
        );
      }
      return be.unknown;
    }
    hasSubscriptEvaluate(t) {
      return this.options.hasSubscriptEvaluate
        ? this.options.hasSubscriptEvaluate(t)
        : !1;
    }
    get peek() {
      let t = this._tokens[this.index];
      if (
        (t === this._lastPeek
          ? (this._peekCounter += 1)
          : (this._peekCounter = 0),
        this._peekCounter >= 1024)
      ) {
        let i = `Infinite loop detected while parsing "${this.latex(0)}" at "${this._lastPeek}" (index ${this.index})`;
        throw (console.error(i), new Error(i));
      }
      return ((this._lastPeek = t), t);
    }
    nextToken() {
      return this._tokens[this.index++];
    }
    get atEnd() {
      return this.index >= this._tokens.length;
    }
    atTerminator(t) {
      return this.atBoundary || ((t?.condition && t.condition(this)) ?? !1);
    }
    get atBoundary() {
      if (this.atEnd) return !0;
      let t = this.index;
      for (let i of this._boundaries)
        if (this.matchBoundaryTokens(i.tokens)) return ((this.index = t), !0);
      return !1;
    }
    matchBoundaryTokens(t) {
      return this.matchAll(t)
        ? !0
        : t.length === 2 &&
            $r.has(t[0]) &&
            this._tokens[this.index] === t[0] &&
            this._tokens[this.index + 1] === "."
          ? ((this.index += 2), !0)
          : !1;
    }
    addBoundary(t) {
      this._boundaries.push({ index: this.index, tokens: t });
    }
    removeBoundary() {
      this._boundaries.pop();
    }
    matchBoundary() {
      let t = this._boundaries[this._boundaries.length - 1],
        i = t && this.matchBoundaryTokens(t.tokens);
      return (i && this._boundaries.pop(), i);
    }
    boundaryError(t) {
      let i = this._boundaries[this._boundaries.length - 1];
      return (this._boundaries.pop(), this.error(t, i.index));
    }
    canSkipMatchfixReparsing(t, i, r) {
      return (
        !r &&
        i.length === 1 &&
        (t === "(" || t === "\\lparen") &&
        (i[0] === "]" || i[0] === "\\rbrack")
      );
    }
    latex(t, i) {
      return ue(this._tokens.slice(t, i));
    }
    sourceOffsets(t, i = this.index) {
      let r = this.tokenPrefixOffsets(),
        n = this._tokens.length,
        s = r[Math.max(0, Math.min(t, n))],
        a = r[Math.max(0, Math.min(i, n))];
      return s <= a ? [s, a] : [a, s];
    }
    tokenPrefixOffsets() {
      if (this._tokenPrefixOffsets !== null) return this._tokenPrefixOffsets;
      let t = this._tokens,
        i = new Array(t.length + 1);
      i[0] = 0;
      let r = 0,
        n = "";
      for (let s = 0; s < t.length; s++) {
        let a = Ar[t[s]] ?? t[s];
        (/[a-zA-Z]/.test(a[0]) && (r += n.length),
          (n = /\\[a-zA-Z]+\*?$/.test(a) ? " " : ""),
          (r += a.length),
          (i[s + 1] = r));
      }
      return ((this._tokenPrefixOffsets = i), i);
    }
    lookAhead() {
      if (this._lookAheadIndex === this.index && this._lookAheadCache !== null)
        return this._lookAheadCache;
      let t = Math.min(
          this._dictionary.lookahead,
          this._tokens.length - this.index,
        ),
        i = [],
        r = "",
        n = "";
      for (let s = 0; s < t; s++) {
        let a = this._tokens[this.index + s],
          l = Ar[a] ?? a;
        (/[a-zA-Z]/.test(l[0]) && (r += n),
          (n = /\\[a-zA-Z]+\*?$/.test(l) ? " " : ""),
          (r += l),
          (i[t - 1 - s] = [s + 1, r]));
      }
      return (
        (this._lookAheadCache = i),
        (this._lookAheadIndex = this.index),
        i
      );
    }
    peekDefinitions(t) {
      if (this.atEnd) return [];
      let i = [],
        r = this._dictionary,
        n;
      switch (t) {
        case "infix":
          n = r.infixByTrigger;
          break;
        case "prefix":
          n = r.prefixByTrigger;
          break;
        case "postfix":
          n = r.postfixByTrigger;
          break;
        case "function":
          n = r.functionByTrigger;
          break;
        case "symbol":
          n = r.symbolByTrigger;
          break;
        case "expression":
          n = r.expressionByTrigger;
          break;
        case "operator":
          n = r.operatorByTrigger;
          break;
      }
      let s = r.universalDefs.get(t);
      if (s) for (let l of s) i.push([l, 0]);
      for (let [l, o] of this.lookAhead()) {
        let u = n.get(o);
        if (u) for (let p of u) i.push([p, l]);
      }
      let a = r.symbolTriggerDefs.get(t);
      if (a) {
        let l = this.index,
          o = ft(this)?.trim(),
          u = this.index - l;
        if (((this.index = l), o && u > 0)) {
          let p = a.get(o);
          if (p) for (let g of p) i.push([g, u]);
        }
      }
      return i;
    }
    skipSpaceTokens() {
      for (; this.match("<space>"););
    }
    skipSpace() {
      if (!this.atEnd && this.peek === "<{>") {
        let i = this.index;
        for (this.nextToken(); this.match("<space>"););
        if (this.nextToken() === "<}>") return (this.skipSpace(), !0);
        this.index = i;
      }
      if (!this.options.skipSpace) return !1;
      let t = !1;
      for (; this.match("<space>");) t = !0;
      return (t && this.skipSpace(), t);
    }
    skipVisualSpace() {
      if (this.options.skipSpace) {
        if (
          (this.skipSpace(),
          Al.has(this.peek) && (this.nextToken(), this.skipVisualSpace()),
          this.match("\\hspace") &&
            (this.match("*"), this.parseStringGroup(), this.skipVisualSpace()),
          this.match("\\hskip") || this.match("\\kern"))
        ) {
          for (
            this.skipSpace(), this.match("-") || this.match("+");
            /^[\d.]$/.test(this.peek);
          )
            this.nextToken();
          for (let t of wl) if (this.matchAll(t)) break;
          this.skipVisualSpace();
        }
        this.skipSpace();
      }
    }
    match(t) {
      return this._tokens[this.index] !== t ? !1 : (this.index++, !0);
    }
    matchAll(t) {
      if (t.length === 0) return !1;
      let i,
        r = 0;
      do i = this._tokens[this.index + r] === t[r++];
      while (i && r < t.length);
      return (i && (this.index += r), i);
    }
    matchAny(t) {
      return t.includes(this._tokens[this.index])
        ? this._tokens[this.index++]
        : "";
    }
    parseLatexNumber(t = !0) {
      let i = !1,
        r = this.peek;
      for (; r === "<space>" || r === "+" || r === "-";)
        (r === "-" && (i = !i), this.nextToken(), (r = this.peek));
      let n = 10,
        s = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
      if (this.match("'"))
        ((n = 8), (s = ["0", "1", "2", "3", "4", "5", "6", "7"]), (t = !0));
      else if (this.match('"') || this.match("x"))
        ((n = 16),
          (s = [
            "0",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "A",
            "B",
            "C",
            "D",
            "E",
            "F",
          ]),
          (t = !0));
      else if (this.match("`"))
        return (
          (r = this.nextToken()),
          r
            ? r.startsWith("\\") && r.length === 2
              ? (i ? -1 : 1) * (r.codePointAt(1) ?? 0)
              : (i ? -1 : 1) * (r.codePointAt(0) ?? 0)
            : null
        );
      let a = "";
      for (; s.includes(this.peek);) a += this.nextToken();
      if (!t && this.match("."))
        for (a += "."; s.includes(this.peek);) a += this.nextToken();
      let l = t ? Number.parseInt(a, n) : Number.parseFloat(a);
      return Number.isNaN(l) ? null : i ? -l : l;
    }
    parseChar() {
      let t = this.index,
        i = 0;
      for (; this.match("^");) i += 1;
      if ((i < 2 && (this.index = t), i >= 2)) {
        let r = "",
          n = 0;
        for (; n != i;) {
          let s = this.matchAny([
            "0",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "a",
            "b",
            "c",
            "d",
            "e",
            "f",
          ]);
          if (!s) break;
          ((r += s), (n += 1));
        }
        if (r.length === i) return String.fromCodePoint(Number.parseInt(r, 16));
      } else if (this.match("\\char")) {
        let r = Math.floor(this.parseLatexNumber() ?? Number.NaN);
        return (
          (!Number.isFinite(r) || r < 0 || r > 1114111) && (r = 10067),
          String.fromCodePoint(r)
        );
      } else if (this.match("\\unicode"))
        if ((this.skipSpaceTokens(), this.match("<{>"))) {
          let r = this.parseLatexNumber();
          if (this.match("<}>") && r !== null && r >= 0 && r <= 1114111)
            return String.fromCodePoint(r);
        } else {
          let r = this.parseLatexNumber();
          if (r !== null && r >= 0 && r <= 1114111)
            return String.fromCodePoint(r);
        }
      return ((this.index = t), null);
    }
    matchDelimiter(t, i) {
      let r = this.index,
        n = Oe[this.peek];
      n && this.nextToken();
      let s = n && this.peek === "<{>";
      if ((s && this.nextToken(), Array.isArray(t))) {
        if ((Array.isArray(i), t.length === 1)) {
          if (!(wr[t[0]] ?? [t[0]]).includes(this.peek))
            return ((this.index = r), !1);
          if ((this.nextToken(), s && !this.match("<}>")))
            return ((this.index = r), !1);
          let u = i[0],
            p = n ? (s ? [n, "<{>", u, "<}>"] : [n, u]) : [u];
          return (this.addBoundary(p), !0);
        }
        if (!this.matchAll(t)) return ((this.index = r), !1);
        let o = n ? [n, ...i] : i;
        return (this.addBoundary(o), !0);
      }
      if ((Array.isArray(i), t === "||" && this.matchAll(["|", "|"])))
        return (this.addBoundary(["|", "|"]), !0);
      if (!(wr[t] ?? [t]).includes(this.peek)) return ((this.index = r), !1);
      if (((t = this.nextToken()), s && !this.match("<}>")))
        return ((this.index = r), !1);
      let a = pi[t] ?? i,
        l = n ? (s ? [n, "<{>", a, "<}>"] : [n, a]) : [a];
      return (this.addBoundary(l), !0);
    }
    parseGroup() {
      let t = this.index;
      if ((this.skipSpaceTokens(), this.match("<{>"))) {
        this.addBoundary(["<}>"]);
        let i = this.parseExpression();
        if ((this.skipSpace(), this.matchBoundary())) return i ?? "Nothing";
        for (; !this.matchBoundary() && !this.atEnd;) this.nextToken();
        if (f(i) === "Error") return i;
        let r = this.error("expected-closing-delimiter", t);
        return i !== null ? ["InvisibleOperator", i, r] : r;
      }
      return ((this.index = t), null);
    }
    parseOptionalGroup() {
      let t = this.index;
      if ((this.skipSpaceTokens(), this.match("["))) {
        this.addBoundary(["]"]);
        let i = this.parseExpression();
        return (
          this.skipSpace(),
          this.matchBoundary()
            ? i
            : this.boundaryError("expected-closing-delimiter")
        );
      }
      return ((this.index = t), null);
    }
    parseToken() {
      return (
        this.skipSpace(),
        Sl.has(this.peek)
          ? null
          : /^[0-9]$/.test(this.peek)
            ? parseInt(this.nextToken(), 10)
            : (this.parseGenericExpression() ?? this.parseSymbol())
      );
    }
    parseTabular() {
      let t = [],
        i = [],
        r = null;
      for (; !this.atBoundary;)
        if ((this.skipSpace(), this.match("&")))
          (i.push(r ?? "Nothing"), (r = null));
        else if (this.match("\\\\") || this.match("\\cr"))
          (this.skipSpace(),
            this.parseOptionalGroup(),
            r !== null && i.push(r),
            t.push(i),
            (i = []),
            (r = null));
        else {
          let n = [],
            s = this.peek;
          for (; s !== "&" && s !== "\\\\" && s !== "\\cr" && !this.atBoundary;)
            ((r = this.parseExpression({
              minPrec: 0,
              condition: (a) => {
                let l = a.peek;
                return l === "&" || l === "\\\\" || l === "\\cr";
              },
            })),
              r !== null
                ? n.push(r)
                : (n.push(["Error", "'unexpected-token'", { str: ue(s) }]),
                  this.nextToken()),
              this.skipSpace(),
              (s = this.peek));
          n.length > 1 ? (r = ["Sequence", ...n]) : (r = n[0] ?? "Nothing");
        }
      return (r !== null && i.push(r), i.length > 0 && t.push(i), t);
    }
    parseStringGroupContent() {
      let t = this.index,
        i = "",
        r = 0;
      for (; !this.atEnd && (!this.atBoundary || r > 0);) {
        let n = this.nextToken();
        if (n === "<$>" || n === "<$$>") return ((this.index = t), "");
        if (n === "<{>") ((r += 1), (i += "\\{"));
        else if (n === "<}>") ((r -= 1), (i += "\\}"));
        else if (n === "<space>") i += " ";
        else if (n[0] === "\\") {
          let s = zl().get(n);
          i += s ?? n;
        } else i += n;
      }
      return i;
    }
    parseStringGroup(t, i) {
      t === void 0 && (t = !1);
      let r = this.index;
      for (; this.match("<space>"););
      if (this.match(t ? "[" : "<{>")) {
        let n = this.index;
        this.addBoundary([t ? "]" : "<}>"]);
        let s = this.parseStringGroupContent();
        if (this.matchBoundary())
          return (i && i.push(...this._tokens.slice(n, this.index - 1)), s);
        this.removeBoundary();
      }
      return ((this.index = r), null);
    }
    parseDoubleQuoteString() {
      if (this.peek !== '"') return null;
      let t = this.index;
      (this.nextToken(), this.addBoundary(['"']));
      let i = this.parseStringGroupContent();
      return this.matchBoundary()
        ? { str: i }
        : (this.removeBoundary(), this.error("expected-closing-delimiter", t));
    }
    parseEnvironment(t) {
      let i = this.index;
      if (!this.match("\\begin")) return null;
      let r = [],
        n = this.parseStringGroup(!1, r)?.trim();
      if (!n) return this.error("expected-environment-name", i);
      for (; r[0] === "<space>";) r.shift();
      for (; r[r.length - 1] === "<space>";) r.pop();
      this.addBoundary(["\\end", "<{>", ...r, "<}>"]);
      for (let s of this.getDefs("environment"))
        if (s.symbolTrigger === n) {
          let a = s.parse(this, t);
          return (
            this.skipSpace(),
            this.matchBoundary()
              ? a !== null
                ? this.decorate(a, i)
                : ((this.index = i), null)
              : this.boundaryError("unbalanced-environment")
          );
        }
      return (
        this.parseTabular(),
        this.skipSpace(),
        this.matchBoundary()
          ? this.error(["unknown-environment", { str: n }], i)
          : this.boundaryError("unbalanced-environment")
      );
    }
    parseRepeatingDecimal() {
      return In(this, this._numberFormatTokens);
    }
    parseNumber() {
      return El(this, this._numberFormatTokens);
    }
    parsePrefixOperator(t) {
      (t || (t = { minPrec: 0 }), t.minPrec || (t = { ...t, minPrec: 0 }));
      let i = this.index;
      for (let [r, n] of this.peekDefinitions("prefix")) {
        this.index = i + n;
        let s = r.parse(this, { ...t, minPrec: r.precedence + 1 });
        if (s !== null) return s;
      }
      return ((this.index = i), null);
    }
    parseInfixOperator(t, i) {
      ((i ??= { minPrec: 0 }),
        i.minPrec,
        i.minPrec === void 0 && (i = { ...i, minPrec: 0 }));
      let r = this.index;
      for (let [n, s] of this.peekDefinitions("infix"))
        if (n.precedence >= i.minPrec) {
          this.index = r + s;
          let a = n.parse(this, t, i);
          if (a !== null) return a;
        }
      if (((this.index = r), this.peek === "\\textcolor")) {
        let n = this.parseStyledInfixOperator(t, i);
        if (n !== null) return n;
        this.index = r;
      }
      return null;
    }
    parseStyledInfixOperator(t, i) {
      let r = this.index;
      if (!this.match("\\textcolor")) return null;
      if (this.parseStringGroup() === null) return ((this.index = r), null);
      if ((this.skipSpace(), !this.match("<{>")))
        return ((this.index = r), null);
      this.skipSpace();
      let n = this.index;
      for (let [s, a] of this.peekDefinitions("infix")) {
        if (s.precedence < i.minPrec) continue;
        if (((this.index = n + a), this.skipSpace(), !this.match("<}>"))) {
          this.index = n;
          continue;
        }
        let l = s.parse(this, t, i);
        if (l !== null) return l;
        this.index = n;
      }
      return ((this.index = r), null);
    }
    wouldMatchTextInfix(t) {
      let i = this.index;
      for (let [r, n] of t)
        if (
          r.kind === "infix" &&
          ((this.index = i + n),
          r.parse(this, "Nothing", { minPrec: 0 }) !== null)
        )
          return ((this.index = i), !0);
      return ((this.index = i), !1);
    }
    parseArguments(t = "enclosure", i) {
      if (this.atTerminator(i)) return null;
      let r = this.index,
        n = this.parseEnclosure();
      if (t === "enclosure") return n === null ? null : (St(n) ?? []);
      if (t === "implicit") {
        if (f(n) === "Delimiter") {
          let a = c(n, 1);
          return f(a) === "Sequence" ? T(a) : a === null ? [] : [a];
        }
        if (n !== null) return [n];
        let s = this.parseExpression({ ...i, minPrec: H });
        return s === null ? null : [s];
      }
      return ((this.index = r), null);
    }
    parseEnclosure() {
      let t = this.index,
        i = this.peek,
        r = Oe[i],
        n = r ? this._tokens[this.index + 1] : i;
      r && n === "<{>" && (n = this._tokens[this.index + 2]);
      let s = this._dictionary.matchfixByOpen.get(n) ?? [];
      s.length === 0 && !n && (s = [...this.getDefs("matchfix")]);
      for (let a of s) {
        if (((this.index = t), a.closeTokens.size > 0)) {
          let m = !1,
            b = this._tokens;
          for (let I = t; I < b.length; I++) {
            if (a.closeTokens.has(b[I])) {
              m = !0;
              break;
            }
            if (r && $r.has(b[I]) && b[I + 1] === ".") {
              m = !0;
              break;
            }
          }
          if (!m) continue;
        }
        if (
          (typeof a.openTrigger == "string" &&
            a.openTrigger === "." &&
            !Oe[i]) ||
          !this.matchDelimiter(a.openTrigger, a.closeTrigger)
        )
          continue;
        let l = this.index;
        this.skipSpace();
        let o = this.parseExpression();
        this.skipSpace();
        let u = this._boundaries[this._boundaries.length - 1]?.tokens,
          p = this.matchBoundary(),
          g =
            (typeof a.openTrigger == "string" &&
              typeof a.closeTrigger == "string" &&
              a.openTrigger === a.closeTrigger) ||
            (Array.isArray(a.openTrigger) &&
              Array.isArray(a.closeTrigger) &&
              a.openTrigger.length === a.closeTrigger.length &&
              a.openTrigger.every((m, b) => m === a.closeTrigger[b]));
        if (p && M(o) && g && u) {
          if (
            ((this.index = l),
            this.skipSpace(),
            (o = this.parseExpression()),
            this.skipSpace(),
            !this.matchAll(u))
          ) {
            if (((this.index = t), !this.atEnd)) continue;
            return null;
          }
        } else if (!p) {
          let m = this._boundaries[this._boundaries.length - 1]?.tokens;
          if (!m) {
            this.index = t;
            continue;
          }
          if (this.canSkipMatchfixReparsing(n, m, g)) {
            (this.removeBoundary(), (this.index = t));
            continue;
          } else if (
            (this.removeBoundary(),
            (this.index = l),
            this.skipSpace(),
            (o = this.parseExpression()),
            this.skipSpace(),
            !this.matchAll(m))
          ) {
            if (((this.index = t), !this.atEnd)) continue;
            return null;
          }
        }
        let d = a.parse(this, o ?? "Nothing");
        if (d !== null) return d;
      }
      return ((this.index = t), null);
    }
    parseGenericExpression(t) {
      if (this.atTerminator(t)) return null;
      let i = this.index,
        r = null,
        n = this.peekDefinitions("expression") ?? [];
      for (let [s, a] of n)
        if (((this.index = i + a), typeof s.parse == "function")) {
          if (((r = s.parse(this, t)), r !== null)) return r;
        } else return s.name;
      return ((this.index = i), null);
    }
    parseFunction(t) {
      if (this.atTerminator(t)) return null;
      let i = this.index,
        r = null,
        n = "enclosure";
      for (let [l, o] of this.peekDefinitions("function"))
        if (((this.index = i + o), typeof l.parse == "function")) {
          if (((r = l.parse(this, t)), r !== null)) return r;
        } else {
          ((r = l.name), (n = l.arguments ?? "enclosure"));
          break;
        }
      let s = !1;
      if (
        r === null &&
        ((this.index = i), (r = ft(this)), !this.isFunctionOperator(r))
      ) {
        if (!this.looksLikePredicate(r)) return ((this.index = i), null);
        s = !0;
      }
      do {
        let l = this.parsePostfixOperator(r, t);
        if (l === null) break;
        r = l;
      } while (!0);
      let a = this.parseArguments(n, t);
      return a === null
        ? r
        : s &&
            typeof r == "string" &&
            (this.inQuantifierScope || r === "D" || r === "N")
          ? ["Predicate", r, ...a]
          : typeof r == "string"
            ? [r, ...a]
            : ["Apply", r, ...a];
    }
    parseSymbol(t) {
      if (this.atTerminator(t)) return null;
      let i = this.index;
      for (let [n, s] of this.peekDefinitions("symbol"))
        if (((this.index = i + s), typeof n.parse == "function")) {
          let a = n.parse(this, t);
          if (a !== null) return a;
        } else return n.name;
      this.index = i;
      let r = ft(this);
      return r !== null && !this.getSymbolType(r).matches("error")
        ? r
        : ((this.index = i), null);
    }
    tryParseBareFunction(t) {
      if (this.options.strict !== !1) return null;
      let i = this.index;
      if (i > 0 && /^[a-zA-Z]$/.test(this._tokens[i - 1])) return null;
      let r = "";
      for (; !this.atEnd && /^[a-zA-Z]$/.test(this.peek);)
        ((r += this.peek), this.index++);
      if (!r) return ((this.index = i), null);
      this.skipSpace();
      let n = null;
      if (this.peek === "_") {
        if ((this.index++, (n = this.parseGroup()), n === null)) {
          if (!this.atEnd && /^[a-zA-Z]$/.test(this.peek))
            ((n = this.peek), this.index++);
          else {
            let u = "";
            for (; !this.atEnd && /^[0-9]$/.test(this.peek);)
              ((u += this.peek), this.index++);
            u && (n = parseInt(u));
          }
          if (n === null) return ((this.index = i), null);
        }
        this.skipSpace();
      }
      let s = null;
      if (this.peek === "^") {
        if ((this.index++, (s = this.parseGroup()), s === null)) {
          let u = !1;
          this.peek === "-" && ((u = !0), this.index++);
          let p = "";
          for (; !this.atEnd && /^[0-9]$/.test(this.peek);)
            ((p += this.peek), this.index++);
          if (p) {
            let g = parseInt(p);
            s = u ? -g : g;
          } else return ((this.index = i), null);
        }
        this.skipSpace();
      }
      if (this.peek !== "(") return ((this.index = i), null);
      let a = $l[r];
      if (!a) return ((this.index = i), null);
      let l = this.parseArguments("enclosure", t);
      if (l === null) return ((this.index = i), null);
      if (r === "cbrt") {
        let u = ["Root", l[0] ?? "Nothing", 3];
        return s !== null ? ["Power", u, s] : u;
      }
      let o;
      return (
        r === "log" && n !== null
          ? n === 2
            ? (o = ["Lb", ...l])
            : n === 10
              ? (o = ["Log", ...l])
              : (o = ["Log", l[0], n])
          : (o = [a, ...l]),
        s !== null ? ["Power", o, s] : o
      );
    }
    static BARE_SYMBOL_MAP = {
      alpha: "alpha",
      beta: "beta",
      gamma: "gamma",
      delta: "delta",
      epsilon: "epsilon",
      varepsilon: "varepsilon",
      zeta: "zeta",
      eta: "eta",
      theta: "theta",
      vartheta: "vartheta",
      iota: "iota",
      kappa: "kappa",
      lambda: "lambda",
      mu: "mu",
      nu: "nu",
      xi: "xi",
      omicron: "omicron",
      pi: "Pi",
      rho: "rho",
      sigma: "sigma",
      tau: "tau",
      upsilon: "upsilon",
      phi: "phi",
      varphi: "varphi",
      chi: "chi",
      psi: "psi",
      omega: "omega",
      Gamma: "Gamma",
      Delta: "Delta",
      Theta: "Theta",
      Lambda: "Lambda",
      Xi: "Xi",
      Sigma: "Sigma",
      Upsilon: "Upsilon",
      Phi: "Phi",
      Psi: "Psi",
      Omega: "Omega",
      oo: "PositiveInfinity",
      inf: "PositiveInfinity",
      ii: "ImaginaryUnit",
    };
    tryParseBareSymbol() {
      if (this.options.strict !== !1) return null;
      let t = this.index;
      if (t > 0 && /^[a-zA-Z]$/.test(this._tokens[t - 1])) return null;
      let i = "";
      for (; !this.atEnd && /^[a-zA-Z]$/.test(this.peek);)
        ((i += this.peek), this.index++);
      return i
        ? En.BARE_SYMBOL_MAP[i] || ((this.index = t), null)
        : ((this.index = t), null);
    }
    parseSupsub(t) {
      if (this.atEnd) return t;
      let i = this.index;
      if (
        this.options.strict === !1 &&
        typeof t == "string" &&
        t.length === 1 &&
        /^[a-zA-Z]$/.test(t) &&
        /^[2-9]$/.test(this.peek)
      ) {
        let l = parseInt(this.peek);
        return (this.index++, this.parseSupsub(["Power", t, l]));
      }
      this.skipSpace();
      let r = [],
        n = [],
        s = i;
      for (; this.peek === "_" || this.peek === "^";) {
        if (this.match("_"))
          if (((s = this.index), this.match("_") || this.match("^")))
            n.push(this.error("syntax-error", s));
          else {
            let l = this.parseGroup();
            if (l === null && this.options.strict === !1) {
              let o = "";
              for (; !this.atEnd && /^[0-9]$/.test(this.peek);)
                ((o += this.peek), this.index++);
              o && (l = parseInt(o));
            }
            if (
              ((l ??= this.parseToken()),
              l === null &&
                this.options.strict === !1 &&
                this.peek === "(" &&
                (l = this.parseEnclosure()),
              (l ??= this.parseStringGroup()),
              l === null)
            )
              return this.error("missing", i);
            n.push(l);
          }
        else if (this.match("^"))
          if (((s = this.index), this.match("_") || this.match("^")))
            r.push(this.error("syntax-error", s));
          else {
            let l = this.parseGroup();
            if (l === null && this.options.strict === !1) {
              let o = this.index,
                u = !1;
              this.peek === "-" && ((u = !0), this.index++);
              let p = "";
              for (; !this.atEnd && /^[0-9]$/.test(this.peek);)
                ((p += this.peek), this.index++);
              if (p) {
                let g = parseInt(p);
                l = u ? -g : g;
              } else this.index = o;
            }
            if (
              ((l ??= this.parseToken()),
              l === null &&
                this.options.strict === !1 &&
                this.peek === "(" &&
                (l = this.parseEnclosure()),
              l === null)
            )
              return this.error("missing", i);
            r.push(l);
          }
        ((s = this.index), this.skipSpace());
      }
      if (r.length === 0 && n.length === 0) return ((this.index = i), t);
      let a = t;
      if (n.length > 0) {
        let l = this._dictionary.infixByTrigger.get("_") ?? [];
        if (l) {
          let o = ["Subscript", a, n.length === 1 ? n[0] : ["List", ...n]];
          for (let u of l)
            if (
              (typeof u.parse == "function"
                ? (a = u.parse(this, o, { minPrec: 0 }))
                : (a = o),
              a !== null)
            )
              break;
        }
      }
      if (r.length > 0) {
        let l = this._dictionary.infixByTrigger.get("^") ?? [];
        if (l) {
          let o = r.filter((u) => !M(u));
          if (o.length !== 0) {
            let u = o.length === 1 ? o[0] : ["List", ...o],
              p = ["Superscript", a, u];
            for (let g of l)
              if (
                (typeof g.parse == "function"
                  ? (a = g.parse(this, p, { minPrec: 0 }))
                  : (a = p),
                a !== null)
              )
                break;
          }
        }
      }
      return (a === null && (this.index = i), a);
    }
    parsePostfixOperator(t, i) {
      if (t === null || this.atEnd) return null;
      let r = this.index;
      for (let [n, s] of this.peekDefinitions("postfix")) {
        this.index = r + s;
        let a = n.parse(this, t, i);
        if (a !== null) return a;
      }
      return ((this.index = r), null);
    }
    parseSyntaxError() {
      let t = this.index;
      if (this.peek === "^")
        return (
          (this.index += 1),
          ["Superscript", this.error("missing", t), F(this.parseGroup())]
        );
      let i = this.peekDefinitions("operator");
      if (i.length > 0) {
        if (((i = this.peekDefinitions("postfix")), i.length > 0)) {
          let [l, o] = i[0];
          if (((this.index += o), typeof l.parse == "function")) {
            let u = l.parse(this, this.error("missing", t));
            if (u !== null) return u;
          }
          return this.error("unexpected-operator", t);
        }
        if (((i = this.peekDefinitions("prefix")), i.length > 0)) {
          let [l, o] = i[0];
          if (((this.index += o), typeof l.parse == "function")) {
            let u = l.parse(this, { minPrec: 0 });
            if (u !== null) return u;
          }
          return l.name
            ? [l.name, this.parseExpression() ?? this.error("missing", t)]
            : this.error("unexpected-operator", t);
        }
        if (((i = this.peekDefinitions("infix")), i.length > 0)) {
          let [l, o] = i[0];
          this.index += o;
          let u = l.parse(this, this.error("missing", t), { minPrec: 0 });
          return u !== null ? u : this.error("unexpected-operator", t);
        }
      }
      let r = this.index,
        n = xr(this);
      if (n !== null) return n;
      if (((n = ft(this)), n !== null))
        return this.error(["unexpected-symbol", { str: n }], r);
      let s = this.peek;
      if (!s) return this.error("syntax-error", t);
      if (Fl(this)) return this.error("unexpected-delimiter", t);
      if (s[0] !== "\\")
        return (
          this.nextToken(),
          this.error(["unexpected-token", { str: ue(s) }], t)
        );
      let a = this.nextToken();
      if ((this.skipSpaceTokens(), a === "\\end")) {
        let l = this.parseStringGroup();
        return l === null
          ? this.error("expected-environment-name", t)
          : this.error(["unbalanced-environment", { str: l }], t);
      }
      for (; this.match("[");) {
        let l = 0;
        for (; !this.atEnd && l === 0 && this.peek !== "]";)
          (this.peek === "[" && (l += 1),
            this.peek === "]" && (l -= 1),
            this.nextToken());
        this.match("]");
      }
      for (; this.match("<{>");) {
        let l = 0;
        for (; !this.atEnd && l === 0 && this.peek !== "<}>";)
          (this.peek === "<{>" && (l += 1),
            this.peek === "<}>" && (l -= 1),
            this.nextToken());
        this.match("<}>");
      }
      return this.error(["unexpected-command", { str: ue(a) }], t);
    }
    parsePrimary(t) {
      if (this.atBoundary || this.atTerminator(t)) return null;
      let i = null,
        r = this.index;
      if (this.match("<}>"))
        return this.error("unexpected-closing-delimiter", r);
      if (
        ((i ??= this.parseGroup()),
        (i ??= this.parseNumber()),
        (i ??= this.parseDoubleQuoteString()),
        (i ??= this.parseEnclosure()),
        (i ??= this.parseEnvironment(t)),
        i === null &&
          this.matchAll(this._positiveInfinityTokens) &&
          (i = "PositiveInfinity"),
        i === null &&
          this.matchAll(this._negativeInfinityTokens) &&
          (i = "NegativeInfinity"),
        i === null && this.matchAll(this._notANumberTokens) && (i = "NaN"),
        i === null &&
          this.matchAll(this._imaginaryUnitTokens) &&
          (i = "ImaginaryUnit"),
        (i ??= this.tryParseBareFunction(t)),
        (i ??= this.tryParseBareSymbol()),
        (i ??=
          this.parseGenericExpression(t) ??
          this.parseFunction(t) ??
          this.parseSymbol(t) ??
          xr(this)),
        i !== null && M(i))
      )
        return this.parsePrimary(t);
      if (i !== null) {
        i = this.decorate(i, r);
        let n = null,
          s = this.index;
        do {
          if (
            ((n = this.parsePostfixOperator(i, t)),
            (i = n ?? i),
            this.index === s && n !== null)
          ) {
            this.index;
            break;
          }
          s = this.index;
        } while (n !== null);
      }
      if ((i !== null && (i = this.parseSupsub(i)), i !== null)) {
        let n = null,
          s = this.index;
        do {
          if (
            ((n = this.parsePostfixOperator(i, t)),
            (i = n ?? i),
            this.index === s && n !== null)
          ) {
            this.index;
            break;
          }
          s = this.index;
        } while (n !== null);
      }
      if (
        i === null &&
        ((i = this.options.parseUnexpectedToken?.(null, this) ?? null),
        i === null && this.peek.startsWith("\\"))
      ) {
        if (this.peek === "\\") {
          let n = this.index;
          if ((this.nextToken(), this.skipVisualSpace(), this.atEnd))
            return this.decorate(null, r);
          this.index = n;
        }
        (this.nextToken(), (i = this.error("unexpected-command", r)));
      }
      return this.decorate(i, r);
    }
    parseExpression(t) {
      this.skipSpace();
      let i = this.index;
      if (this.atBoundary) return ((this.index = i), null);
      ((t ??= { minPrec: 0 }),
        t.minPrec,
        t.minPrec === void 0 && (t = { ...t, minPrec: 0 }));
      let r = this.parsePrefixOperator({ ...t, minPrec: 0 });
      if (((r ??= this.parsePrimary(t)), r !== null)) {
        let n = !1;
        for (; !n && !this.atTerminator(t);) {
          this.skipSpace();
          let s = this.parseInfixOperator(r, t);
          if (s === null && t.minPrec <= Ci) {
            let a = this.peekDefinitions("operator");
            if (
              (a.length === 0 ||
                a.every(
                  ([l]) =>
                    l.latexTrigger === "\\text" ||
                    l.latexTrigger === "\\keyword",
                )) &&
              !(a.length > 0 && this.wouldMatchTextInfix(a))
            ) {
              let l = this.parseExpression({ ...t, minPrec: Ci + 1 });
              l !== null
                ? f(r) === "InvisibleOperator"
                  ? f(l) === "InvisibleOperator"
                    ? (s = ["InvisibleOperator", ...T(r), ...T(l)])
                    : (s = ["InvisibleOperator", ...T(r), l])
                  : f(l) === "InvisibleOperator"
                    ? (s = ["InvisibleOperator", r, ...T(l)])
                    : (s = ["InvisibleOperator", r, l])
                : s === null &&
                  (s = this.options.parseUnexpectedToken?.(r, this) ?? null);
            }
          }
          s !== null ? (r = s) : (n = !0);
        }
      }
      return this.decorate(r, i);
    }
    decorate(t, i) {
      if (t === null) return null;
      if (!this.options.preserveLatex) return t;
      let r = this.latex(i, this.index);
      return (
        Array.isArray(t)
          ? (t = { latex: r, fn: t })
          : typeof t == "number"
            ? (t = { latex: r, num: Number(t).toString() })
            : typeof t == "string"
              ? t.startsWith("'")
                ? (t = { latex: r, str: t.slice(1, -1) })
                : (t = { latex: r, sym: t })
              : typeof t == "object" && t !== null && (t.latex = r),
        t
      );
    }
    error(t, i) {
      let r;
      typeof t == "string"
        ? (t.startsWith("'"), (r = { str: t }))
        : (t[0].startsWith("'"),
          (r = ["ErrorCode", { str: t[0] }, ...t.slice(1)]));
      let n = this.latex(i, this.index),
        s = n ? ["Error", r, ["LatexString", { str: n }]] : ["Error", r],
        a =
          typeof t == "string" && t === "missing"
            ? this.sourceOffsets(i, i)
            : this.sourceOffsets(i, this.index);
      return { fn: s, sourceOffsets: a };
    }
    isFunctionOperator(t) {
      return t === null || t === "D" || t === "N"
        ? !1
        : !!this.getSymbolType(t).matches("function");
    }
    looksLikePredicate(t) {
      return t === null || typeof t != "string" || !/^[A-Z]$/.test(t)
        ? !1
        : (this.skipSpace(), this.peek === "(" || this.peek === "\\left");
    }
    *getDefs(t) {
      if (t === "operator")
        for (let i = this._dictionary.defs.length - 1; i >= 0; i--) {
          let r = this._dictionary.defs[i];
          /^prefix|infix|postfix/.test(r.kind) && (yield r);
        }
      else
        for (let i = this._dictionary.defs.length - 1; i >= 0; i--) {
          let r = this._dictionary.defs[i];
          r.kind === t && (yield r);
        }
    }
  };
  function Fl(e) {
    let t = e.peek;
    return Object.values(pi).includes(t) || pi[t]
      ? (e.nextToken(), !0)
      : Oe[t] || Object.values(Oe).includes(t)
        ? (e.nextToken(), e.nextToken(), !0)
        : !1;
  }
  function Ml(e, t, i) {
    let r = new Pl(j(e), t, i),
      n = r.parseExpression();
    if (!r.atEnd) {
      let s = r.parseSyntaxError();
      n = n !== null ? ["Sequence", n, s] : s;
    }
    if (((n ??= "Nothing"), i.preserveLatex)) {
      if (Array.isArray(n)) return { latex: e, fn: n };
      if (typeof n == "number") return { latex: e, num: Number(n).toString() };
      if (typeof n == "string") {
        if (Un(n)) return { latex: e, str: P(n) };
        if (At(n)) return { latex: e, sym: n };
        if (nt(n)) return { latex: e, num: n };
      }
      typeof n == "object" && n !== null && (n.latex = e);
    }
    return n;
  }
  function Sn(e, t, i) {
    if (i.repeatingDecimal && i.repeatingDecimal !== "none") {
      let s = e.slice(0, -1);
      for (let a = 0; a < e.length - 16; a++) {
        let l = s.substring(0, a);
        for (let o = 0; o < 17; o++) {
          let u = s.substring(a, a + o + 1),
            p = Math.floor((s.length - l.length) / u.length);
          if (p <= 3) break;
          if ((l + u.repeat(p + 1)).startsWith(s)) {
            if (u === "0") return Jt(l, i);
            let g =
              {
                vinculum: "\\overline{#}",
                parentheses: "(#)",
                dots: "\\overset{\\cdots}{#1}#2\\overset{\\cdots}{#3}",
                arc: "\\wideparen{#}",
              }[i.repeatingDecimal] ?? "\\overline{#}";
            return (
              (g = g
                .replace(/#1/g, u[0])
                .replace(/#2/g, u.slice(1))
                .replace(/#3/g, u.slice(-1))
                .replace(/#/, u)),
              Jt(l, i) + g
            );
          }
        }
      }
    }
    let r = typeof i.fractionalDigits == "number" ? i.fractionalDigits : 1 / 0;
    (r < 0 && (r = r - t), r < 0 && (r = 0));
    let n = e.length > r;
    return (
      n && (e = e.substring(0, r)),
      (e = Jt(e, i)),
      n && (e += i.truncationMarker),
      e
    );
  }
  function An(e, t) {
    return !e || e === "0"
      ? ""
      : t.beginExponentMarker
        ? t.beginExponentMarker + e + (t.endExponentMarker ?? "")
        : `10^{${e}}`;
  }
  function Ol(e, t) {
    if (e === null) return "";
    let i;
    if (typeof e == "number" || typeof e == "string") i = e;
    else if (typeof e == "object" && "num" in e) i = e.num;
    else return "";
    if (typeof i == "number") {
      if (i === 1 / 0) return t.positiveInfinity;
      if (i === -1 / 0) return t.negativeInfinity;
      if (Number.isNaN(i)) return t.notANumber;
      let s;
      return (
        t.notation === "engineering"
          ? (s = Pe(i.toExponential(), t, 3))
          : t.notation === "scientific"
            ? (s = Pe(i.toExponential(), { ...t, avoidExponentsInRange: null }))
            : t.notation === "adaptiveScientific" &&
              (s = Pe(i.toExponential(), t)),
        s ?? hi(i.toString(), t)
      );
    }
    if (
      ((i = i.toLowerCase().replace(/[\u0009-\u000d\u0020\u00a0]/g, "")),
      i === "infinity" || i === "+infinity" || i === "oo" || i === "+oo")
    )
      return t.positiveInfinity;
    if (i === "-infinity" || i === "-oo") return t.negativeInfinity;
    if (i === "nan") return t.notANumber;
    if (!/^[-+\.]?[0-9]/.test(i)) return "";
    if (((i = i.replace(/[nd]$/, "")), /\([0-9]+\)/.test(i))) {
      let [s, a, l, o] = i.match(/(.+)\(([0-9]+)\)(.*)$/) ?? [];
      i = a + l.repeat(6) + o;
    }
    let r = "";
    for (
      i[0] === "-"
        ? ((r = "-"), (i = i.substring(1)))
        : i[0] === "+" && (i = i.substring(1));
      i[0] === "0";
    )
      i = i.substring(1);
    i.length === 0 ? (i = "0") : i[0] === "." && (i = "0" + i);
    let n;
    return (
      t.notation === "engineering"
        ? (n = Pe(i, t, 3))
        : t.notation === "scientific"
          ? (n = Pe(i, { ...t, avoidExponentsInRange: null }))
          : t.notation === "adaptiveScientific" && (n = Pe(i, t)),
      r + (n ?? hi(i, { ...t }))
    );
  }
  function Pe(e, t, i = 1) {
    let r = e.match(/^(.*)[e|E]([-+]?[0-9]+)$/);
    if (!r) {
      let p = "";
      if (
        (e[0] === "-"
          ? ((p = "-"), (e = e.substring(1)))
          : e[0] === "+" && (e = e.substring(1)),
        e.indexOf(".") < 0)
      )
        e.length === 1
          ? (e = p + e + "e+0")
          : (e =
              p + e[0] + "." + e.slice(1) + "e+" + (e.length - 1).toString());
      else {
        let [g, d, m] = e.match(/^(.*)\.(.*)$/);
        for (m || (m = ""); d.startsWith("0");) d = d.substring(1);
        if (d)
          e =
            p + d[0] + "." + d.slice(1) + m + "e+" + (d.length - 1).toString();
        else {
          let b = 0;
          for (; m[b] === "0";) b++;
          if (b === m.length) e = p + "0e+0";
          else {
            let I = m.slice(b),
              w = I[0],
              z = I.slice(1),
              O = -(b + 1);
            z ? (e = p + w + "." + z + "e" + O) : (e = p + w + "e" + O);
          }
        }
      }
      r = e.match(/^(.*)[e|E]([-+]?[0-9]+)$/);
    }
    if (!r) return hi(e, t);
    let n = parseInt(r[2]),
      s = r[1];
    {
      let p = s.match(/^(-?)/),
        g = p ? p[1] : "",
        d = (g ? s.substring(1) : s).match(/^(\d+)(?:\.(\d*))?$/);
      if (d) {
        let m = d[1],
          b = d[2] ?? "";
        (m.length > 1 &&
          ((b = m.slice(1) + b), (n += m.length - 1), (m = m[0])),
          (s = g + m),
          b && (s += "." + b));
      }
    }
    if (Math.abs(n) % i !== 0) {
      let p = n > 0 ? n % i : -((i + n) % i);
      n = n >= 0 ? n - p : n + p;
      let [g, d, m] = s.match(/^(.*)\.(.*)$/) ?? ["", s, ""];
      s =
        d +
        (m + "00000000000000000").slice(0, Math.abs(p)) +
        "." +
        m.slice(Math.abs(p));
    }
    let a = t.avoidExponentsInRange;
    if (a && n >= a[0] && n <= a[1]) return;
    let l = "",
      o = s;
    ((r = o.match(/^(.*)\.(.*)$/)), r && ((o = r[1]), (l = r[2])));
    let u = An(Number(n).toString(), t);
    return (
      (l = Sn(l, o.length, t)),
      l && (l = t.decimalSeparator + l),
      (o = $n(o, t)),
      u ? o + l + t.exponentProduct + u : o + l
    );
  }
  function hi(e, t) {
    let i = e.match(/^(.*)[e|E]([-+]?[0-9]+)$/i),
      r = 0,
      n = 0;
    i?.[1] && i[2] && ((r = parseInt(i[2])), (n = r), (e = i[1]));
    let s = i?.[1] ?? e,
      a = "";
    ((i = e.match(/^(.*)\.(.*)$/)),
      i?.[1] && i[2] && ((s = i[1]), (a = i[2])),
      r !== 0 && a && ((s += a), (r -= a.length), (a = "")));
    let l = t.avoidExponentsInRange;
    r !== 0 && l && n >= l[0] && n <= l[1] && (([s, a] = Cl(s, a, r)), (r = 0));
    let o = An(r.toString(), t);
    if (
      (a && (a = t.decimalSeparator + Sn(a, s.length, t)), (s = $n(s, t)), !o)
    )
      return s + a;
    if (!a) {
      if (s === "1") return o;
      if (s === "-1") return "-" + o;
    }
    return s + a + t.exponentProduct + o;
  }
  function zr(e, t, i) {
    let r = new RegExp(`(\\d{${t}})(?=\\d)`, "g");
    return e.replace(r, `$1${i}`);
  }
  function Dl(e, t, i) {
    let r = new RegExp(`(\\d{${t}})(?=\\d)`, "g"),
      n = i.split("").reverse().join("");
    return e
      .split("")
      .reverse()
      .join("")
      .replace(r, `$1${n}`)
      .split("")
      .reverse()
      .join("");
  }
  function Rl(e, t) {
    let i = e.split("").reverse().join(""),
      r = t.split("").reverse().join(""),
      n = i.replace(/(\d{3})(?=\d)/, `$1${r}`);
    return (
      (n = n.replace(/(\d{2})(?=(\d{2})+,)/g, `$1${r}`)),
      n.split("").reverse().join("")
    );
  }
  function wn(e, t, i) {
    let r = t.digitGroup;
    typeof r != "string" && Array.isArray(r) && (r = r[i]);
    let n =
      typeof t.digitGroupSeparator == "string"
        ? t.digitGroupSeparator
        : t.digitGroupSeparator[i];
    return n
      ? r === "lakh"
        ? i === 0
          ? Rl(e, n)
          : zr(e, 3, n)
        : r === !1 || r <= 0
          ? e
          : i === 1
            ? zr(e, r, n)
            : Dl(e, r, n)
      : e;
  }
  function Jt(e, t) {
    return wn(e, t, 1);
  }
  function $n(e, t) {
    return wn(e, t, 0);
  }
  function Cl(e, t, i) {
    let r = e + t,
      n = e.length + i,
      s,
      a;
    return (
      n > 0
        ? n >= r.length
          ? ((r = r + "0".repeat(n - r.length)), (s = r), (a = ""))
          : ((s = r.slice(0, n)), (a = r.slice(n)))
        : ((s = "0"), (a = "0".repeat(-n) + r)),
      [s, a]
    );
  }
  var Bl = {
    First: ".x",
    Second: ".y",
    Third: ".z",
    Real: ".\\operatorname{real}",
    Imaginary: ".\\operatorname{imag}",
    Length: ".\\operatorname{count}",
    Sum: ".\\operatorname{total}",
    Max: ".\\max",
    Min: ".\\min",
  };
  function ql(e, t) {
    if (!e.options.dotNotation) return null;
    let i = T(t);
    if (!i || i.length !== 1) return null;
    let r = f(t);
    if (!r) return null;
    let n = Bl[r];
    return n === void 0 ? null : `${e.wrap(i[0], 810)}${n}`;
  }
  var gi = {
      deg: (e) => `${e}\\degree`,
      prime: (e) => `${e}^{\\prime}`,
      dprime: (e) => `${e}^{\\doubleprime}`,
      ring: (e) => `\\mathring{${e}}`,
      hat: (e) => `\\hat{${e}}`,
      tilde: (e) => `\\tilde{${e}}`,
      vec: (e) => `\\vec{${e}}`,
      bar: (e) => `\\overline{${e}}`,
      underbar: (e) => `\\underline{${e}}`,
      dot: (e) => `\\dot{${e}}`,
      ddot: (e) => `\\ddot{${e}}`,
      tdot: (e) => `\\dddot{${e}}`,
      qdot: (e) => `\\ddddot{${e}}`,
      acute: (e) => `\\acute{${e}}`,
      grave: (e) => `\\grave{${e}}`,
      breve: (e) => `\\breve{${e}}`,
      check: (e) => `\\check{${e}}`,
    },
    di = {
      upright: (e) => `\\mathrm{${e}}`,
      italic: (e) => `\\mathit{${e}}`,
      bold: (e) => `\\mathbf{${e}}`,
      script: (e) => `\\mathscr{${e}}`,
      fraktur: (e) => `\\mathfrak{${e}}`,
      doublestruck: (e) => `\\mathbb{${e}}`,
      blackboard: (e) => `\\mathbb{${e}}`,
      calligraphic: (e) => `\\mathcal{${e}}`,
      gothic: (e) => `\\mathfrak{${e}}`,
      sansserif: (e) => `\\mathsf{${e}}`,
      monospace: (e) => `\\mathtt{${e}}`,
    },
    Ll = class {
      options;
      dictionary;
      level = -1;
      constructor(e, t) {
        ((this.dictionary = e),
          (this.options = { dmsFormat: !1, angleNormalization: "none", ...t }));
      }
      wrap(e, t) {
        if (e == null) return "";
        if (t === void 0) {
          let r = f(e);
          return r && this.dictionary.ids.get(r)?.kind === "matchfix"
            ? this.serialize(e)
            : this.wrapString(
                this.serialize(e),
                this.options.groupStyle(e, this.level + 1),
              );
        }
        if (typeof e == "number" || it(e)) {
          let r = S(e);
          return r !== null && r < 0 && t > V
            ? this.wrap(e)
            : this.serialize(e);
        }
        let i = f(e);
        if (i && i !== "Delimiter" && i !== "Subscript") {
          let r = this.dictionary.ids.get(i);
          if (
            r &&
            (r.kind === "symbol" ||
              r.kind === "expression" ||
              r.kind === "prefix" ||
              r.kind === "infix" ||
              r.kind === "postfix") &&
            r.precedence < t
          )
            return this.wrapString(
              this.serialize(e),
              this.options.applyFunctionStyle(e, this.level),
            );
        }
        return this.serialize(e);
      }
      wrapShort(e) {
        if (e == null) return "";
        let t = this.serialize(e);
        if (k(e) !== null || (Me(e) && !/^(-|\.)/.test(t))) return t;
        let i = f(e);
        return (i === "Delimiter" && B(e) === 1) ||
          (i !== "Add" &&
            i !== "Negate" &&
            i !== "Subtract" &&
            i !== "PlusMinus" &&
            i !== "Multiply")
          ? t
          : this.wrapString(t, this.options.groupStyle(e, this.level + 1));
      }
      wrapString(e, t, i) {
        if (t === "none") return e;
        i ??= "()";
        let r = i?.[0] ?? ".",
          n = i?.[1] ?? ".";
        return (
          r === '"'
            ? (r = "``")
            : r === "|"
              ? (r = "\\lvert")
              : (r = kt[r] ?? r),
          n === '"'
            ? (n = "''")
            : n === "|"
              ? (n = "\\rvert")
              : (n = kt[n] ?? n),
          r === "." && n === "."
            ? e
            : ((r === "." || n === ".") && t === "normal" && (t = "scaled"),
              t === "scaled"
                ? `\\left${r}${e}\\right${n}`
                : t === "big"
                  ? `\\Bigl${r}${e}\\Bigr${n}`
                  : r + e + n)
        );
      }
      wrapArguments(e) {
        return this.wrapString(
          T(e)
            .map((t) => this.serialize(t))
            .join(", "),
          this.options.applyFunctionStyle(e, this.level),
        );
      }
      serializeSymbol(e, t) {
        return (
          typeof e == "string" || rt(e),
          t?.kind === "function"
            ? (Xt(k(e) ?? "") ?? "")
            : (t?.serialize?.(this, e) ?? Xt(k(e)) ?? "")
        );
      }
      serializeFunction(e, t) {
        let i = ql(this, e);
        if (i !== null) return i;
        if (t?.serialize) return t.serialize(this, e);
        let r = f(e);
        return Xt(r, "auto") + this.wrapArguments(e);
      }
      serialize(e) {
        if (e == null) return "";
        this.level += 1;
        try {
          let t = (() => {
            let i = Ol(e, this.options);
            if (i) return i;
            let r = P(e);
            if (r !== null) return `\\text{${r}}`;
            let n = k(e);
            if (n !== null)
              return this.serializeSymbol(e, this.dictionary.ids.get(n));
            let s = f(e);
            if (s) {
              let a = this.dictionary.ids.get(s);
              return this.serializeFunction(e, a);
            }
            throw Error(
              `Syntax error ${e ? JSON.stringify(e, void 0, 4) : ""}`,
            );
          })();
          return ((this.level -= 1), t ?? "");
        } catch {}
        return ((this.level -= 1), "");
      }
      applyFunctionStyle(e, t) {
        return this.options.applyFunctionStyle(e, t);
      }
      groupStyle(e, t) {
        return this.options.groupStyle(e, t);
      }
      rootStyle(e, t) {
        return this.options.rootStyle(e, t);
      }
      fractionStyle(e, t) {
        return this.options.fractionStyle(e, t);
      }
      logicStyle(e, t) {
        return this.options.logicStyle(e, t);
      }
      powerStyle(e, t) {
        return this.options.powerStyle(e, t);
      }
      numericSetStyle(e, t) {
        return this.options.numericSetStyle(e, t);
      }
      indexStyle(e, t) {
        return this.options.indexStyle(e, t);
      }
    },
    Ue = null;
  function Gl() {
    if (!Ue) {
      Ue = new Map();
      for (let [e, t] of Re) Ue.has(e) || Ue.set(e, t);
    }
    return Ue;
  }
  var Ye = null;
  function Vl() {
    if (!Ye) {
      Ye = new Map();
      for (let [, e, t] of Re) Ye.has(t) || Ye.set(t, e);
    }
    return Ye;
  }
  var jl = new Map([
      ["zero", "0"],
      ["one", "1"],
      ["two", "2"],
      ["three", "3"],
      ["four", "4"],
      ["five", "5"],
      ["six", "6"],
      ["seven", "7"],
      ["eight", "8"],
      ["nine", "9"],
      ["ten", "10"],
    ]),
    Zl = new Map([
      ["plus", "+"],
      ["minus", "-"],
      ["pm", "\\pm"],
      ["ast", "\\ast"],
      ["dag", "\\dag"],
      ["ddag", "\\ddag"],
      ["hash", "\\#"],
      ["bottom", "\\bot"],
      ["top", "\\top"],
      ["bullet", "\\bullet"],
      ["circle", "\\circ"],
      ["diamond", "\\diamond"],
      ["times", "\\times"],
      ["square", "\\square"],
      ["star", "\\star"],
    ]);
  function fi(e) {
    let t = e.match(/^____([0-9A-Fa-f]{6})(.*)/s);
    if (t)
      return [
        `\\unicode{"${(t[1].replace(/^0+/, "") || "0").padStart(4, "0")}}`,
        t[2],
      ];
    let i = e.match(/^([^_]+)/)?.[1] ?? "",
      r = Gl().get(i);
    if (r !== void 0) return [r, e.substring(i.length)];
    let n = jl.get(i);
    if (n !== void 0) return [n, e.substring(i.length)];
    let s = e.codePointAt(0);
    if (s !== void 0) {
      let l = Vl().get(s);
      if (l !== void 0) return [l, e.substring(1)];
    }
    let a = Zl.get(i);
    return a !== void 0
      ? [a, e.substring(i.length)]
      : [i, e.substring(i.length)];
  }
  function Ul(e) {
    let [t, i] = fi(e),
      r = [];
    for (; i.length > 0;) {
      let s = i.match(/^_([a-zA-Z]+)(.*)/);
      if (!s || !gi[s[1]]) break;
      (r.push(s[1]), (i = s[2]));
    }
    let n = [];
    for (; i.length > 0;) {
      let s = i.match(/^_([a-zA-Z]+)(.*)/);
      if (!s || !di[s[1]]) break;
      (n.push(s[1]), (i = s[2]));
    }
    return [t, r, n, i];
  }
  function Et(e, t = !0, i = "auto") {
    let [r, n, s, a] = Ul(e);
    for (let o of n) gi[o] && (r = gi[o](r));
    for (; a.length > 0 && !a.startsWith("_") && !/^\d/.test(a);) {
      let [o, u] = fi(a);
      if (o === "" || u === a) break;
      ((r += o), (a = u));
    }
    let l = r;
    if (t) {
      let o = [],
        u = [],
        p = r.match(/^([^\d].*?)(\d+)$/);
      for (p && (u.push(p[2]), (r = p[1])); a.length > 0;) {
        let g = a.match(/^____([0-9A-Fa-f]{6})(.*)/s);
        if (g) {
          let d = g[1].replace(/^0+/, "") || "0";
          if (
            ((r += `\\unicode{"${d.padStart(4, "0")}}`),
            (a = g[2]),
            a.length > 0 && !a.startsWith("_"))
          ) {
            let [m, b] = fi(a);
            ((r += m), (a = b));
          }
        } else if (a.startsWith("__")) {
          let [d, m] = Et(a.substring(2), !1, "none");
          (o.push(d), (a = m));
        } else if (a.startsWith("_")) {
          let [d, m] = Et(a.substring(1), !1, "none");
          (u.push(d), (a = m));
        } else break;
      }
      ((l = r),
        o.length > 0 && (r = De("^", r, o.join(","))),
        u.length > 0 && (r = De("_", r, u.join(","))));
    }
    for (let o of s) di[o] && (r = di[o](r));
    if (s.length === 0 && i !== "none")
      switch (i) {
        case "auto":
          Rr(l) > 1 &&
            (r.includes("\\unicode")
              ? (r = `\\operatorname{${r}}`)
              : (r = `\\mathrm{${r}}`));
          break;
        case "operator":
          r = `\\operatorname{${r}}`;
          break;
        case "italic":
          r = `\\mathit{${r}}`;
          break;
        case "upright":
          r = `\\mathrm{${r}}`;
          break;
      }
    return [r, a];
  }
  function Xt(e, t = "auto") {
    if (e === null) return null;
    if (st.test(e)) return e;
    let i = e.match(/^(_+)(.*)/);
    if (i && !e.match(/^____[0-9A-Fa-f]{6}/)) {
      let [s, a] = Et(i[2], !0, "none");
      return `\\operatorname{${"\\_".repeat(i[1].length) + s + a}}`;
    }
    let [r, n] = Et(e, !0, t);
    return n.length > 0 ? `\\operatorname{${e}}` : r;
  }
  function Yl(e, t, i) {
    return new Ll(t, i).serialize(e);
  }
  function Hl(e) {
    return {
      imaginaryUnit: "\\imaginaryI",
      positiveInfinity: "\\infty",
      negativeInfinity: "-\\infty",
      notANumber: "\\operatorname{NaN}",
      decimalSeparator: e.decimalSeparator ?? ".",
      digitGroupSeparator: e.digitGroupSeparator ?? "\\,",
      digitGroup: e.digitGroup ?? 3,
      exponentProduct: "\\cdot",
      beginExponentMarker: "10^{",
      endExponentMarker: "}",
      truncationMarker: "\\ldots",
      repeatingDecimal: "auto",
      strict: e.parseStrict ?? !0,
      skipSpace: e.skipSpace ?? !0,
      parseNumbers: e.parseNumbers ?? "auto",
      preserveLatex: e.preserveLatex ?? !1,
      quantifierScope: e.quantifierScope ?? "tight",
      timeDerivativeVariable: e.timeDerivativeVariable ?? "t",
      tolerance: 1e-7,
      getSymbolType: (t) => be.unknown,
      hasSubscriptEvaluate: (t) => !1,
      parseUnexpectedToken: (t, i) => null,
    };
  }
  function Wl(e) {
    return {
      imaginaryUnit: "\\imaginaryI",
      positiveInfinity: "\\infty",
      negativeInfinity: "-\\infty",
      notANumber: "\\operatorname{NaN}",
      decimalSeparator: e.decimalSeparator ?? ".",
      digitGroupSeparator: e.digitGroupSeparator ?? "\\,",
      digitGroup: e.digitGroup ?? 3,
      exponentProduct: "\\cdot",
      beginExponentMarker: "10^{",
      endExponentMarker: "}",
      truncationMarker: "\\ldots",
      repeatingDecimal: "vinculum",
      fractionalDigits: e.fractionalDigits ?? "max",
      notation: e.notation ?? "auto",
      avoidExponentsInRange: e.avoidExponentsInRange ?? [-7, 20],
      prettify: e.prettify ?? !0,
      materialization: !1,
      invisibleMultiply: "",
      invisiblePlus: "",
      multiply: "\\times",
      missingSymbol: "\\blacksquare",
      keywordStyle: "text",
      dotNotation: !1,
      dmsFormat: !1,
      angleNormalization: "none",
      applyFunctionStyle: Us,
      groupStyle: Ys,
      rootStyle: Hs,
      fractionStyle: Ws,
      logicStyle: Qs,
      powerStyle: Js,
      numericSetStyle: Xs,
      indexStyle: ea,
    };
  }
  var zn = class {
    _options;
    _indexed;
    constructor(e) {
      this._options = e ?? {};
    }
    get indexed() {
      if (!this._indexed) {
        let e = this._options.dictionary ?? Ma;
        this._indexed = Va(e, (t) => {
          console.error("LatexSyntax dictionary warning:", t);
        });
      }
      return this._indexed;
    }
    parse(e, t) {
      let i = Hl(this._options);
      return Ml(e, this.indexed, { ...i, ...t });
    }
    serialize(e, t) {
      let i = Wl(this._options);
      return Yl(e, this.indexed, { ...i, ...t });
    }
  };
  var v = { relation: 1, add: 2, multiply: 3, unary: 4, power: 5, atom: 6 },
    _n = {
      Alpha: "Alpha",
      Beta: "Beta",
      Gamma: "Gamma",
      Delta: "Delta",
      Epsilon: "Epsilon",
      Zeta: "Zeta",
      Eta: "Eta",
      Theta: "Theta",
      Iota: "Iota",
      Kappa: "Kappa",
      Lambda: "Lambda",
      Mu: "Mu",
      Nu: "Nu",
      Xi: "Xi",
      Omicron: "Omicron",
      Rho: "Rho",
      Sigma: "Sigma",
      Tau: "Tau",
      Upsilon: "Upsilon",
      Phi: "Phi",
      Chi: "Chi",
      Psi: "Psi",
      Omega: "Omega",
    },
    Pn = {
      alpha: "\u03B1",
      beta: "\u03B2",
      gamma: "\u03B3",
      delta: "\u03B4",
      epsilon: "\u03B5",
      zeta: "\u03B6",
      eta: "\u03B7",
      theta: "\u03B8",
      iota: "\u03B9",
      kappa: "\u03BA",
      lambda: "\u03BB",
      mu: "\u03BC",
      nu: "\u03BD",
      xi: "\u03BE",
      omicron: "\u03BF",
      pi: "\u03C0",
      rho: "\u03C1",
      sigma: "\u03C3",
      tau: "\u03C4",
      upsilon: "\u03C5",
      phi: "\u03C6",
      chi: "\u03C7",
      psi: "\u03C8",
      omega: "\u03C9",
      Gamma: "\u0393",
      Delta: "\u0394",
      Theta: "\u0398",
      Lambda: "\u039B",
      Xi: "\u039E",
      Pi: "\u03A0",
      Sigma: "\u03A3",
      Upsilon: "\u03A5",
      Phi: "\u03A6",
      Psi: "\u03A8",
      Omega: "\u03A9",
    },
    On = {
      Sin: "sin",
      Cos: "cos",
      Tan: "tan",
      Sec: "sec",
      Csc: "csc",
      Cot: "cot",
      Arcsin: "arcsin",
      Arccos: "arccos",
      Arctan: "arctan",
      Arcsec: "arcsec",
      Arccsc: "arccsc",
      Arccot: "arccot",
      Sinh: "sinh",
      Cosh: "cosh",
      Tanh: "tanh",
      Sech: "sech",
      Csch: "csch",
      Coth: "coth",
      Arsinh: "arcsinh",
      Arcosh: "arccosh",
      Artanh: "arctanh",
      Arsech: "arcsech",
      Arcsch: "arccsch",
      Arcoth: "arccoth",
      Ln: "ln",
      Exp: "exp",
      Abs: "abs",
      Factorial: "factorial",
      Gamma: "gamma",
    },
    Kl = new zn({ parseStrict: !1 });
  function Fn(e) {
    return [...new Set(e)];
  }
  function L(e, t) {
    return e.precedence < t ? `(${e.text})` : e.text;
  }
  function Mn(e) {
    return Array.isArray(e) ? e : null;
  }
  function Pt(e, t) {
    if (e === "Pi") return "pi";
    if (e === "EulerGamma") return "gamma";
    if (e === "ExponentialE" || e === "EulerE") return "e";
    if (e === "ImaginaryUnit") return "i";
    if (
      e === "PositiveInfinity" ||
      e === "NegativeInfinity" ||
      e === "ComplexInfinity"
    )
      return (
        t.push("Infinity is not supported by the standard MITx calculator."),
        e === "NegativeInfinity" ? "(-1/0)" : "(1/0)"
      );
    if (_n[e]) return _n[e];
    let i = e
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9_]/g, "_")
      .replace(/^([0-9])/, "_$1");
    return (
      i ||
      (t.push(`Could not convert the symbol \u201C${e}\u201D.`),
      "unknown_symbol")
    );
  }
  function Ft(e) {
    let t = e[0];
    return typeof t == "string" ? t : "";
  }
  function eii(e) {
    if (Ce(e)) return e.fn;
    if (it(e)) {
      let t = S(e);
      return t ?? Number(e.num);
    }
    return rt(e) ? e.sym : xi(e) ? e.str : e;
  }
  function Dn(e, t) {
    return e.map((i) => q(i, t).text);
  }
  function Ee(e, t, i) {
    let r = Dn(t, i);
    return { text: `${e}(${r.join(",")})`, precedence: v.atom };
  }
  function Ql(e, t, i) {
    return (
      i.mode === "numeric" &&
        i.warnings.push(
          "Equations and inequalities depend on a symbolic or custom grader.",
        ),
      {
        text: t.map((n) => L(q(n, i), v.relation)).join(e),
        precedence: v.relation,
      }
    );
  }
  function q(e, t) {
    if (((e = eii(e)), Number.isNaN(e)))
      return (
        t.warnings.push(
          "Non-finite numbers are not supported by the standard MITx calculator.",
        ),
        { text: "NaN", precedence: v.atom }
      );
    if (e === null)
      return (
        t.errors.push("The expression is empty."),
        { text: "", precedence: v.atom }
      );
    if (typeof e == "number")
      return (
        Number.isFinite(e) ||
          t.warnings.push(
            "Non-finite numbers are not supported by the standard MITx calculator.",
          ),
        { text: String(e), precedence: v.atom }
      );
    if (typeof e == "string")
      return { text: Pt(e, t.warnings), precedence: v.atom };
    if (!Array.isArray(e))
      return (
        t.errors.push("The parser returned an unsupported expression object."),
        { text: "", precedence: v.atom }
      );
    let i = Ft(e),
      r = e.slice(1);
    if (i === "Error")
      return (
        t.errors.push("Part of the expression could not be parsed."),
        { text: "", precedence: v.atom }
      );
    if (i === "Delimiter")
      return { text: `(${q(r[0] ?? null, t).text})`, precedence: v.atom };
    if (i === "Add") {
      let a = [];
      return (
        r.forEach((l, o) => {
          let u = Mn(l);
          if (o > 0 && u && Ft(u) === "Negate") {
            let p = q(u[1] ?? null, t);
            a.push(`-${L(p, v.add + 1)}`);
          } else {
            let p = q(l, t);
            a.push(`${o > 0 ? "+" : ""}${L(p, v.add)}`);
          }
        }),
        { text: a.join(""), precedence: v.add }
      );
    }
    if (i === "Subtract") {
      let a = q(r[0] ?? null, t),
        l = q(r[1] ?? null, t);
      return {
        text: `${L(a, v.add)}-${l.text.startsWith("-") ? `(${l.text})` : L(l, v.add + 1)}`,
        precedence: v.add,
      };
    }
    if (i === "Negate") {
      let a = q(r[0] ?? null, t);
      return { text: `-${L(a, v.unary)}`, precedence: v.unary };
    }
    if (i === "Multiply" || i === "InvisibleOperator") {
      if (
        i === "InvisibleOperator" &&
        typeof r[0] == "string" &&
        r.length === 2
      ) {
        let l = Mn(r[1] ?? null);
        if (l && Ft(l) === "Delimiter") {
          let o = Pt(r[0], t.warnings);
          return Ee(o, [l[1] ?? null], t);
        }
      }
      return {
        text: r.map((l) => L(q(l, t), v.multiply)).join("*"),
        precedence: v.multiply,
      };
    }
    if (i === "Divide") {
      let a = q(r[0] ?? null, t),
        l = q(r[1] ?? null, t);
      return {
        text: `${L(a, v.multiply)}/${L(l, v.multiply + 1)}`,
        precedence: v.multiply,
      };
    }
    if (i === "Power") {
      let a = q(r[0] ?? null, t),
        l = q(r[1] ?? null, t);
      return { text: `${L(a, v.power)}^${L(l, v.atom)}`, precedence: v.power };
    }
    if (i === "Square") {
      let a = q(r[0] ?? null, t);
      return { text: `${L(a, v.power)}^2`, precedence: v.power };
    }
    if (i === "Sqrt") return Ee("sqrt", [r[0] ?? null], t);
    if (i === "Root") {
      t.warnings.push("An nth root was converted to exponent form.");
      let a = q(r[0] ?? null, t),
        l = q(r[1] ?? null, t);
      return {
        text: `${L(a, v.power)}^(1/${L(l, v.multiply + 1)})`,
        precedence: v.power,
      };
    }
    if (i === "Log")
      return (
        t.warnings.push("Desmos log(x) was translated as base-10 log10(x)."),
        Ee("log10", [r[0] ?? null], t)
      );
    if (i === "Lg") return Ee("log10", [r[0] ?? null], t);
    if (i === "Lb") return Ee("log2", [r[0] ?? null], t);
    let n = On[i];
    if (n) return Ee(n, r, t);
    let s = {
      Equal: "=",
      NotEqual: "!=",
      Less: "<",
      LessEqual: "<=",
      Greater: ">",
      GreaterEqual: ">=",
      Approx: "~=",
    };
    if (s[i]) return Ql(s[i], r, t);
    if (i === "Subscript") {
      let a = q(r[0] ?? null, t).text,
        l = q(r[1] ?? null, t).text;
      return (
        t.warnings.push(
          "Subscripted variables require a grader that accepts underscore names.",
        ),
        { text: `${a}_${l}`, precedence: v.atom }
      );
    }
    if (i === "PlusMinus" || i === "MinusPlus") {
      t.warnings.push(
        "\xB1 cannot represent two answers in a standard MITx formula field. Choose one sign or enter answers separately.",
      );
      let a = q(r.at(-1) ?? null, t);
      return { text: L(a, v.unary), precedence: v.unary };
    }
    if (i === "List" || i === "Tuple") {
      t.warnings.push(
        "Lists and tuples are only accepted by some custom graders.",
      );
      let a = Dn(r, t),
        l = i === "List" ? ["[", "]"] : ["(", ")"];
      return { text: `${l[0]}${a.join(",")}${l[1]}`, precedence: v.atom };
    }
    if (
      [
        "Sum",
        "Product",
        "Integrate",
        "Derivative",
        "Limit",
        "Which",
        "Matrix",
      ].includes(i)
    )
      return (
        t.errors.push(
          `${i} notation cannot be converted reliably for a standard MITx answer field.`,
        ),
        { text: "", precedence: v.atom }
      );
    if (
      i === "Floor" ||
      i === "Ceil" ||
      i === "Round" ||
      i === "Sign" ||
      i === "Sgn"
    ) {
      let a = i === "Sgn" ? "sign" : i.toLowerCase();
      return (
        t.warnings.push(
          `${i} is not a standard MITx calculator function; it may work only in a custom grader.`,
        ),
        Ee(a, r, t)
      );
    }
    if (i) {
      let a = Pt(i, t.warnings);
      return (
        t.warnings.push(
          `${i} is not in the standard MITx function list; it may require a custom grader.`,
        ),
        Ee(a, r, t)
      );
    }
    return (
      t.errors.push("The expression has no recognizable operation."),
      { text: "", precedence: v.atom }
    );
  }
  var psetterContextAliasCache = new WeakMap();
  var psetterContextFunctionNames = new Set([
    "sin",
    "cos",
    "tan",
    "sec",
    "csc",
    "cot",
    "asin",
    "acos",
    "atan",
    "arcsin",
    "arccos",
    "arctan",
    "sinh",
    "cosh",
    "tanh",
    "ln",
    "log",
    "log10",
    "log2",
    "sqrt",
  ]);
  // Some MathLive symbols have a named semantic node even when the user
  // entered a single-letter variable. MITx questions commonly use G for the
  // gravitational constant, while the parser's built-in meaning for bare G
  // is CatalanConstant. Keep this mapping data-driven so additional parser
  // collisions can be added without changing the editor or field lifecycle.
  var psetterReservedSymbolAliases = [
    { parserName: "CatalanConstant", sourceName: "G" },
    { parserName: "GoldenRatio", sourceName: "phi", latexNames: ["\\phi", "\\varphi"] },
    { parserName: "EulerGamma", sourceName: "gamma", latexNames: ["\\gamma"] },
  ];
  function psetterProblemSourceRoot(e) {
    if (!e) return null;
    for (let t = e; t && t !== document.body; t = t.parentElement)
      if (t.getAttribute?.("data-content")) return t;
    return (
      e.closest?.(".problem, .problems-wrapper, .vert, .xblock, .problem-block") ??
      e.parentElement ??
      null
    );
  }
  function restorePsetterMultiLetterSymbols(e, t, n) {
    if (typeof e != "string" || typeof t != "string" || !t) return t;
    let i = t,
      r = n instanceof Set ? n : new Set();
    for (let s of r) {
      if (
        typeof s != "string" ||
        !/^[A-Za-z][A-Za-z0-9_]*$/.test(s) ||
        s.length < 2 ||
        psetterContextFunctionNames.has(s.toLowerCase())
      )
        continue;
      // Restore only a contiguous name from the original MathQuill LaTeX.
      // Explicit \cdot/* multiplication remains multiplication, even when it
      // spells the same letters (for example h*a*t*i).
      let a = new RegExp(`(^|[^A-Za-z0-9_])${s}(?=[^A-Za-z0-9_]|$)`).test(e);
      // MathQuill can expose a typed multi-letter name with spacing between
      // its glyphs. Accept that representation too, while deliberately not
      // accepting `h*a*t*i`, which is explicit multiplication.
      if (!a) {
        let c = s.split("").join("\\s*");
        a = new RegExp(`(^|[^A-Za-z0-9_])${c}(?=[^A-Za-z0-9_]|$)`).test(e);
      }
      if (!a) continue;
      let l = s.split("").join("\\*");
      i = i.replace(
        new RegExp(`(^|[^A-Za-z0-9_])${l}(?=[^A-Za-z0-9_]|$)`, "g"),
        `$1${s}`,
      );
    }
    return i;
  }
  function restorePsetterReservedSymbols(e, t) {
    if (typeof e != "string" || typeof t != "string" || !e || !t) return t;
    let i = t;
    for (let r of psetterReservedSymbolAliases) {
      let n = r.sourceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        s = new RegExp(`(^|[^A-Za-z0-9_])${n}(?=[^A-Za-z0-9_]|$)`, "g"),
        a = e.match(s)?.length ?? 0;
      // MathQuill can wrap an uppercase single-letter variable in a
      // semantic command (for example \\operatorname{G}). Count that form
      // as the same source symbol, while still requiring a standalone G so
      // identifiers such as Gforce are not changed.
      if (a === 0 && Array.isArray(r.latexNames)) {
        for (let u of r.latexNames) {
          let d = new RegExp(u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
          a += e.match(d)?.length ?? 0;
        }
      }
      if (a === 0) {
        let l = new RegExp(
          `\\\\(?:operatorname|mathrm|mathit)\\{${n}\\}`,
          "g",
        );
        a = e.match(l)?.length ?? 0;
      }
      if (a === 0) continue;
      let l = new RegExp(`\\b${r.parserName}\\b`, "g"),
        o = 0;
      i = i.replace(l, (u) => (o++ < a ? r.sourceName : u));
    }
    return i;
  }
  function discoverPsetterContextAliases(e) {
    let t = psetterProblemSourceRoot(e);
    if (!t) return new Set();
    let i = t.getAttribute?.("data-content") || t.innerHTML || "",
      r = psetterContextAliasCache.get(t);
    if (r?.source === i) return r.aliases;
    let n = new Set(),
      s = (a) => {
        typeof a == "string" &&
          /^[A-Za-z][A-Za-z0-9_]*$/.test(a) &&
          a.length >= 2 &&
          !psetterContextFunctionNames.has(a.toLowerCase()) &&
          n.add(a);
      };
    // MITx's authored problem HTML uses this form for vector aliases such as
    // \hat{i} ("hati"). It is scoped to the current problem, never global.
    for (let a of i.matchAll(
      /(?:\[mathjaxinline\][\s\S]*?\[\/mathjaxinline\]|\\\([\s\S]*?\\\))\s*\(\s*["“”']([A-Za-z][A-Za-z0-9_]*)["“”']\s*\)/g,
    ))
      s(a[1]);
    // MITx's current problem markup puts the accepted spelling in a code
    // element immediately before the explanation, for example
    // `<code>hati</code> for [mathjaxinline]\\hat{\\mathbf{i}}[/mathjaxinline]`.
    // Read that authored spelling directly instead of inferring it from
    // rendered MathJax.
    for (let a of i.matchAll(
      /<code\b[^>]*>\s*([A-Za-z][A-Za-z0-9_]*)\s*<\/code>\s*(?:for|as)\b/gi,
    ))
      s(a[1]);
    // Some problems explicitly tell students what spelling to type, e.g.
    // “simply type in \"v_0\"”. Preserve that spelling as metadata too.
    for (let a of i.matchAll(
      /(?:type\s+in|enter\s+(?:your\s+)?answer\s+as)\s*["“”']([A-Za-z][A-Za-z0-9_]*)["“”']/gi,
    ))
      s(a[1]);
    psetterContextAliasCache.set(t, { source: i, aliases: n });
    return n;
  }
  function X(e, t) {
    if (((e = eii(e)), Number.isNaN(e))) return { text: "NaN", precedence: v.atom };
    if (e === null) return { text: "", precedence: v.atom };
    if (typeof e == "number") return { text: String(e), precedence: v.atom };
    if (typeof e == "string") {
      if (e === "Pi") return { text: "\u03C0", precedence: v.atom };
      if (e === "PositiveInfinity")
        return { text: "\u221E", precedence: v.atom };
      if (e === "NegativeInfinity")
        return { text: "\u2212\u221E", precedence: v.atom };
      let a = Pt(e, t);
      return { text: Pn[a] ?? Pn[e] ?? a, precedence: v.atom };
    }
    if (!Array.isArray(e)) return { text: "", precedence: v.atom };
    let i = Ft(e),
      r = e.slice(1),
      n = (a) => X(r[a] ?? null, t);
    return i === "Delimiter"
      ? { text: `(${n(0).text})`, precedence: v.atom }
      : i === "Add"
        ? { text: r.map((a) => X(a, t).text).join(" + "), precedence: v.add }
        : i === "Subtract"
          ? { text: `${n(0).text} \u2212 ${n(1).text}`, precedence: v.add }
          : i === "Negate"
            ? { text: `\u2212${L(n(0), v.unary)}`, precedence: v.unary }
            : i === "Multiply" || i === "InvisibleOperator"
              ? {
                  text: r.map((a) => L(X(a, t), v.multiply)).join("\xB7"),
                  precedence: v.multiply,
                }
              : i === "Divide"
                ? {
                    text: `${L(n(0), v.multiply)}/${L(n(1), v.multiply)}`,
                    precedence: v.multiply,
                  }
                : i === "Power"
                  ? {
                      text: `${L(n(0), v.power)}^(${n(1).text})`,
                      precedence: v.power,
                    }
                  : i === "Sqrt"
                    ? { text: `\u221A(${n(0).text})`, precedence: v.atom }
                    : i === "Root"
                      ? {
                          text: `${n(1).text}\u221A(${n(0).text})`,
                          precedence: v.atom,
                        }
                      : i === "Abs"
                        ? { text: `|${n(0).text}|`, precedence: v.atom }
                        : i === "PlusMinus"
                          ? {
                              text: `\xB1${n(r.length - 1).text}`,
                              precedence: v.unary,
                            }
                          : i === "Equal"
                            ? {
                                text: r.map((a) => X(a, t).text).join(" = "),
                                precedence: v.relation,
                              }
                            : i === "LessEqual"
                              ? {
                                  text: r
                                    .map((a) => X(a, t).text)
                                    .join(" \u2264 "),
                                  precedence: v.relation,
                                }
                              : i === "GreaterEqual"
                                ? {
                                    text: r
                                      .map((a) => X(a, t).text)
                                      .join(" \u2265 "),
                                    precedence: v.relation,
                                  }
                                : i === "NotEqual"
                                  ? {
                                      text: r
                                        .map((a) => X(a, t).text)
                                        .join(" \u2260 "),
                                      precedence: v.relation,
                                    }
                                  : i === "Less"
                                    ? {
                                        text: r
                                          .map((a) => X(a, t).text)
                                          .join(" < "),
                                        precedence: v.relation,
                                      }
                                    : i === "Greater"
                                      ? {
                                          text: r
                                            .map((a) => X(a, t).text)
                                            .join(" > "),
                                          precedence: v.relation,
                                        }
                                      : {
                                          text: `${On[i] ?? (i === "Log" ? "log" : i === "Lg" ? "log10" : i === "Lb" ? "log\u2082" : i === "Sgn" ? "sign" : i.toLowerCase())}(${r.map((a) => X(a, t).text).join(", ")})`,
                                          precedence: v.atom,
                                        };
  }
  function tii(e, t, i, r) {
    let n = `${t}\\left(`,
      s = 0,
      a = "";
    for (;;) {
      let l = e.indexOf(n, s);
      if (l === -1) return a + e.slice(s);
      a += e.slice(s, l) + i;
      let o = l + n.length,
        u = 1,
        p = o;
      for (; p < e.length && u > 0; )
        e.startsWith("\\left(", p)
          ? ((u += 1), (p += 6))
          : e.startsWith("\\right)", p)
            ? ((u -= 1), u === 0 ? 0 : (p += 7))
            : (p += 1);
      if (u !== 0) return e;
      ((a += e.slice(o, p) + r), (s = p + 7));
    }
  }
  function nii(e) {
    return tii(
      tii(
        e
          .replace(/\\log10(?=\\left\()/g, "lg")
          .replace(/\\log2(?=\\left\()/g, "lb")
          .replace(/\bsign(?=\\left\()/g, "sgn"),
        "floor",
        "\\lfloor ",
        " \\rfloor",
      ),
      "ceil",
      "\\lceil ",
      " \\rceil",
    );
  }
  function Rn(e, t, aliases = new Set()) {
    if (!e.trim())
      return { output: "", warnings: [], errors: [], isSupported: !0 };
    if (/(?:\\parallel\b|\|\|)/.test(e))
      return {
        output: "",
        warnings: [],
        errors: [
          "The parallel symbol is not supported in standard MITx answer syntax.",
        ],
        isSupported: !1,
      };
    if (/(?:\\infty\b|\b(?:infty|infinity)\b)/i.test(e))
      return {
        output: "",
        warnings: [],
        errors: [
          "Infinity is not supported in standard MITx answer syntax.",
        ],
        isSupported: !1,
      };
    let i = [],
      r = [];
    try {
      let n = Kl.parse(nii(e)),
        s = restorePsetterMultiLetterSymbols(
          e,
          restorePsetterReservedSymbols(
            e,
            t === "literal"
              ? X(n, i).text
              : q(n, { mode: t, warnings: i, errors: r }).text,
          ),
          aliases,
        );
      return (
        /\b[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+\b/.test(s) &&
          i.push(
            "Subscripted variables require a grader that accepts underscore names.",
          ),
        {
        output: s,
        warnings: Fn(i),
        errors: Fn(r),
        isSupported: r.length === 0,
        }
      );
    } catch (n) {
      return {
        output: "",
        warnings: [],
        errors: [
          n instanceof Error ? n.message : "Unable to parse the expression.",
        ],
        isSupported: !1,
      };
    }
  }
  function Nii(e, t, i) {
    return Rn(Bt(e), t, i);
  }
  function isPsetterDetailsEvent(e) {
    return !!e?.composedPath?.().some(
      (t) =>
        t?.classList?.contains?.("pset-math-details") ||
        t?.classList?.contains?.("pset-math-details-slot"),
    );
  }
  var Bii = {
    "\\alpha": "alpha",
    "\\beta": "beta",
    "\\gamma": "gamma",
    "\\delta": "delta",
    "\\theta": "theta",
    "\\lambda": "lambda",
    "\\mu": "mu",
    "\\rho": "rho",
    "\\sigma": "sigma",
    "\\phi": "phi",
    "\\omega": "omega",
    "\\Delta": "Delta",
    "\\Omega": "Omega",
    "\\pi": "pi",
    "\\infty": "infty",
    "\\partial": "partial",
    "\\cdot": "*",
    "\\times": "*",
    "\\left": "",
    "\\right": "",
  };
  function Hii(e) {
    let t = typeof e == "string" ? e : "";
    if (!t.trim()) return "";
    let i = t;
    for (let [r, n] of Object.entries(Bii)) i = i.split(r).join(n);
    return i
      .replace(/\\sqrt\s*\{/g, "sqrt(")
      .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)")
      .replace(/\{/g, "(")
      .replace(/\}/g, ")")
      .replace(/\\/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*([()+\-*/^=<>!,_])\s*/g, "$1")
      .trim();
  }
  function Kii(e, t = "", a = new Set()) {
    if (!e.trim()) return "";
    let i = [],
      r = [],
      n = "";
    try {
      let s = Kl.parse(nii(e));
      n = restorePsetterMultiLetterSymbols(
        e,
        restorePsetterReservedSymbols(
          e,
          q(s, { mode: "symbolic", warnings: i, errors: r }).text,
        ),
        a,
      );
    } catch {}
    return n || Hii(e) || t || "";
  }
  var Cn = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  function Bn(e, t) {
    Cn ? Cn.call(e, t) : (e.value = t);
    try {
      e.dispatchEvent(
        new InputEvent("input", {
          bubbles: !0,
          composed: !0,
          inputType: "insertText",
          data: t,
        }),
      );
    } catch {
      e.dispatchEvent(new Event("input", { bubbles: !0, composed: !0 }));
    }
    (e.dispatchEvent(new Event("change", { bubbles: !0, composed: !0 })),
      e.dispatchEvent(
        new KeyboardEvent("keyup", {
          bubbles: !0,
          composed: !0,
          key: "Unidentified",
        }),
      ));
  }
  var Si = [
      {
        id: "pi",
        label: "\u03C0",
        search: "pi constant",
        latex: "\\pi",
        group: "common",
      },
      {
        id: "sqrt",
        label: "\u221A",
        search: "sqrt square root radical",
        latex: "\\sqrt{}",
        group: "common",
      },
      {
        id: "abs",
        label: "|x|",
        search: "absolute value abs",
        latex: "\\left|\\right|",
        group: "common",
      },
      {
        id: "exp",
        label: "e\u02E3",
        search: "exponential e power",
        latex: "e^{}",
        group: "common",
      },
      {
        id: "sin",
        label: "sin",
        search: "sine trig",
        latex: "\\sin\\left(\\right)",
        group: "common",
      },
      {
        id: "cos",
        label: "cos",
        search: "cosine trig",
        latex: "\\cos\\left(\\right)",
        group: "common",
      },
      {
        id: "tan",
        label: "tan",
        search: "tangent trig",
        latex: "\\tan\\left(\\right)",
        group: "common",
      },
      {
        id: "ln",
        label: "ln",
        search: "natural logarithm",
        latex: "\\ln\\left(\\right)",
        group: "common",
      },
      {
        id: "log",
        label: "log",
        search: "base ten logarithm",
        latex: "\\log\\left(\\right)",
        group: "common",
      },
      {
        id: "alpha",
        label: "\u03B1",
        search: "alpha",
        latex: "\\alpha",
        group: "greek",
      },
      {
        id: "beta",
        label: "\u03B2",
        search: "beta",
        latex: "\\beta",
        group: "greek",
      },
      {
        id: "gamma",
        label: "\u03B3",
        search: "gamma",
        latex: "\\gamma",
        group: "greek",
      },
      {
        id: "delta",
        label: "\u03B4",
        search: "delta",
        latex: "\\delta",
        group: "greek",
      },
      {
        id: "epsilon",
        label: "\u03B5",
        search: "epsilon",
        latex: "\\epsilon",
        group: "greek",
      },
      {
        id: "theta",
        label: "\u03B8",
        search: "theta angle",
        latex: "\\theta",
        group: "greek",
      },
      {
        id: "lambda",
        label: "\u03BB",
        search: "lambda wavelength",
        latex: "\\lambda",
        group: "greek",
      },
      {
        id: "mu",
        label: "\u03BC",
        search: "mu micro",
        latex: "\\mu",
        group: "greek",
      },
      {
        id: "rho",
        label: "\u03C1",
        search: "rho density",
        latex: "\\rho",
        group: "greek",
      },
      {
        id: "sigma",
        label: "\u03C3",
        search: "sigma",
        latex: "\\sigma",
        group: "greek",
      },
      {
        id: "phi",
        label: "\u03C6",
        search: "phi",
        latex: "\\phi",
        group: "greek",
      },
      {
        id: "omega",
        label: "\u03C9",
        search: "omega angular frequency",
        latex: "\\omega",
        group: "greek",
      },
      {
        id: "Delta",
        label: "\u0394",
        search: "capital delta change",
        latex: "\\Delta",
        group: "greek",
      },
      {
        id: "Sigma",
        label: "\u03A3",
        search: "capital sigma sum",
        latex: "\\Sigma",
        group: "greek",
      },
      {
        id: "Omega",
        label: "\u03A9",
        search: "capital omega ohm",
        latex: "\\Omega",
        group: "greek",
      },
      {
        id: "plus",
        label: "+",
        search: "plus add addition",
        latex: "+",
        group: "relations",
      },
      {
        id: "le",
        label: "\u2264",
        search: "less equal inequality",
        latex: "\\le",
        group: "relations",
      },
      {
        id: "ge",
        label: "\u2265",
        search: "greater equal inequality",
        latex: "\\ge",
        group: "relations",
      },
      {
        id: "ne",
        label: "\u2260",
        search: "not equal inequality",
        latex: "\\ne",
        group: "relations",
      },
      {
        id: "approx",
        label: "\u2248",
        search: "approximately equal",
        latex: "\\approx",
        group: "relations",
      },
    ],
    Jl = {
      alpha: [/α/i, /\\alpha\b/i],
      beta: [/β/i, /\\beta\b/i],
      gamma: [/γ/i, /\\gamma\b/i],
      delta: [/δ/i, /\\delta\b/i],
      epsilon: [/ε/i, /\\epsilon\b/i],
      theta: [/θ/i, /\\theta\b/i],
      lambda: [/λ/i, /\\lambda\b/i],
      mu: [/μ|µ/i, /\\mu\b/i],
      rho: [/ρ/i, /\\rho\b/i],
      sigma: [/σ/i, /\\sigma\b/i],
      phi: [/φ|ϕ/i, /\\phi\b/i],
      omega: [/ω/i, /\\omega\b/i],
      Delta: [/Δ/, /\\Delta\b/],
      Omega: [/Ω/, /\\Omega\b/],
      pi: [/π/i, /\\pi\b/i],
      infty: [/∞/, /\\infty\b/i],
      partial: [/∂/, /\\partial\b/i],
    };
  function qn(e) {
    let t =
      e.closest(
        ".problem, .problems-wrapper, .vert, .xblock, .problem-block",
      ) ?? e.parentElement;
    if (!t) return [];
    let i = [...t.querySelectorAll("code")]
      .map((r) => r.textContent?.trim() ?? "")
      .filter((r) => /^[A-Za-z][A-Za-z0-9_]*$/.test(r));
    if (i.length > 0)
      return [...new Set(i)].slice(0, 10).map((r) => ({
        id: `term:${r}`,
        label: r,
        display: (() => {
          let [n, s] = r.split("_", 2),
            a = {
              alpha: "α", beta: "β", gamma: "γ", delta: "δ",
              epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ",
              rho: "ρ", sigma: "σ", phi: "φ", omega: "ω",
            }[n] ?? n;
          return { base: a, subscript: s ?? "" };
        })(),
        search: `term ${r}`,
        latex: `\\left(\\operatorname{${r.replace(/_/g, "\\_")}}\\right)`,
        group: "context",
        kind: "term",
      }));
    let r = `${t.textContent ?? ""}
${t.innerHTML}`;
    return Si.filter((n) => Jl[n.id]?.some((s) => s.test(r))).slice(0, 10);
  }
  function qii(e) {
    if (typeof e != "string") return e;
    let t = e
      .split(/\s+/)
      .map((i) => i.trim())
      .filter((i) => /^[A-Za-z]{2,}$/.test(i));
    return t.join(" ");
  }
  function Uii(e) {
    if (!e || typeof e != "object") return e;
    let t = { ...e };
    return (
      "autoOperatorNames" in t &&
        (t.autoOperatorNames = qii(t.autoOperatorNames)),
      "autoCommands" in t && typeof t.autoCommands == "string" &&
        (t.autoCommands = qii(t.autoCommands)),
      t
    );
  }
  function Wii(e) {
    if (!e || e.__psetterSanitized) return e;
    let t = typeof e.config == "function" ? e.config : null,
      i = typeof e.MathField == "function" ? e.MathField : null;
    return (
      t &&
        (e.config = function (r) {
          return t.call(this, Uii(r));
        }),
      i &&
        (e.MathField = function (r, n) {
          return i.call(this, r, Uii(n));
        }),
      Object.defineProperty(e, "__psetterSanitized", {
        value: !0,
        configurable: !1,
        enumerable: !1,
        writable: !1,
      }),
      e
    );
  }
  if (globalThis.MathQuill) {
    let e = globalThis.MathQuill,
      t = typeof e.getInterface == "function" ? e.getInterface.bind(e) : null,
      i = typeof e.config == "function" ? e.config.bind(e) : null;
    i &&
      (e.config = function (r) {
        return i(Uii(r));
      }),
      t &&
        (e.getInterface = function (r) {
          return Wii(t(r));
        });
  }
  var Xl = Wii(MathQuill.getInterface(2));
  function R(e, t, i) {
    let r = document.createElement(e);
    return (t && (r.className = t), i !== void 0 && (r.textContent = i), r);
  }
  function Be(e, t, i) {
    let r = R("button", t, e);
    return (
      (r.type = "button"),
      (r.title = i),
      r.setAttribute("aria-label", i),
      r
    );
  }
  function oei(e, t, i, r, n = {}) {
    return {
      id: e,
      category: t,
      expression: i,
      mode: r,
      expected_output: n.output,
      expected_status: n.status ?? "ready",
      expected_warning_substrings: n.warning_substrings ?? [],
      expected_error_substrings: n.error_substrings ?? [],
      notes: n.notes ?? "",
    };
  }
  var qaTests = __PSETTER_DEV_BUILD__ ? [
    oei("N01", "numbers", "0", "numeric", { output: "0" }),
    oei("N02", "numbers", "42", "numeric", { output: "42" }),
    oei("N03", "numbers", "3.14", "numeric", { output: "3.14" }),
    oei("N04", "numbers", "-3", "numeric", { output: "-3" }),
    oei("N05", "numbers", "(3)", "numeric", { output: "(3)" }),
    oei("A01", "arithmetic", "1+2", "numeric", { output: "1+2" }),
    oei("A02", "arithmetic", "7-4", "numeric", { output: "7-4" }),
    oei("A03", "arithmetic", "3*5", "numeric", { output: "3*5" }),
    oei("A04", "arithmetic", "8/2", "numeric", { output: "8/2" }),
    oei("A05", "arithmetic", "1+2*3", "numeric", { output: "1+2*3" }),
    oei("A06", "arithmetic", "(1+2)*3", "numeric", { output: "(1+2)*3" }),
    oei("A07", "arithmetic", "-x+2", "numeric", { output: "-x+2" }),
    oei("A08", "arithmetic", "2-(-3)", "numeric", { output: "2-(-3)" }),
    oei("A09", "arithmetic", "(a+b)/(c-d)", "numeric", {
      output: "(a+b)/(c-d)",
    }),
    oei("A10", "arithmetic", "a/(b+c*d-e^f)", "numeric", {
      output: "a/(b+c*d-e^f)",
    }),
    oei("P01", "powers", "x^2", "numeric", { output: "x^2" }),
    oei("P02", "powers", "(x+1)^2", "numeric", { output: "(x+1)^2" }),
    oei("P03", "powers", "x^(-2)", "numeric", { output: "x^(-2)" }),
    oei("P04", "powers", "sqrt(x)", "numeric", { output: "sqrt((x))" }),
    oei("P05", "powers", "sqrt(x+1)", "numeric", { output: "sqrt((x+1))" }),
    oei("P06", "powers", "x^(1/2)", "numeric", { output: "x^(1/2)" }),
    oei("P07", "powers", "sqrt(x^2+y^2)", "numeric", {
      output: "sqrt((x^2+y^2))",
    }),
    oei("V01", "variables", "x", "numeric", { output: "x" }),
    oei("V02", "variables", "xy", "numeric", { output: "x*y" }),
    oei("V03", "variables", "x_1", "numeric", {
      output: "x_1",
      status: "warning",
      warning_substrings: ["Subscripted variables"],
    }),
    oei("V04", "variables", "m_1*g", "numeric", {
      output: "m_1*g",
      status: "warning",
      warning_substrings: ["Subscripted variables"],
    }),
    oei("V05", "variables", "mu*m_1*g", "numeric", {
      output: "mu*m_1*g",
      status: "warning",
      warning_substrings: ["Subscripted variables"],
    }),
    oei("V06", "variables", "m_1+m_2+m_3", "numeric", {
      output: "m_1+m_2+m_3",
      status: "warning",
      warning_substrings: ["Subscripted variables"],
    }),
    oei("G01", "greek", "pi", "numeric", { output: "pi" }),
    oei("G02", "greek", "theta", "numeric", { output: "theta" }),
    oei("G03", "greek", "alpha", "numeric", { output: "alpha" }),
    oei("G04", "greek", "Delta", "numeric", { output: "Delta" }),
    oei("R01", "relations", "x=2", "numeric", {
      output: "x=2",
      status: "warning",
      warning_substrings: ["Equations and inequalities"],
    }),
    oei("R02", "relations", "x!=2", "numeric", {
      output: "x!=2",
      status: "warning",
      warning_substrings: ["Equations and inequalities"],
    }),
    oei("R03", "relations", "x<=2", "numeric", {
      output: "x<=2",
      status: "warning",
      warning_substrings: ["Equations and inequalities"],
    }),
    oei("R04", "relations", "x>=2", "numeric", {
      output: "x>=2",
      status: "warning",
      warning_substrings: ["Equations and inequalities"],
    }),
    oei("R05", "relations", "x+y=z", "numeric", {
      output: "x+y=z",
      status: "warning",
      warning_substrings: ["Equations and inequalities"],
    }),
    oei("R06", "relations", "0<=x<=1", "numeric", {
      output: "0<=x<=1",
      status: "warning",
      warning_substrings: ["Equations and inequalities"],
    }),
    oei("R07", "relations", "a=b=c", "numeric", {
      output: "a=b=c",
      status: "warning",
      warning_substrings: ["Equations and inequalities"],
    }),
    oei("F01", "functions", "sin(x)", "numeric", { output: "sin(x)" }),
    oei("F02", "functions", "cos(x)", "numeric", { output: "cos(x)" }),
    oei("F03", "functions", "tan(x)", "numeric", { output: "tan(x)" }),
    oei("F04", "functions", "sec(x)", "numeric", { output: "sec(x)" }),
    oei("F05", "functions", "csc(x)", "numeric", { output: "csc(x)" }),
    oei("F06", "functions", "cot(x)", "numeric", { output: "cot(x)" }),
    oei("F07", "functions", "arcsin(x)", "numeric", { output: "arcsin(x)" }),
    oei("F08", "functions", "arccos(x)", "numeric", { output: "arccos(x)" }),
    oei("F09", "functions", "arctan(x)", "numeric", { output: "arctan(x)" }),
    oei("F10", "functions", "sinh(x)", "numeric", { output: "sinh(x)" }),
    oei("F11", "functions", "cosh(x)", "numeric", { output: "cosh(x)" }),
    oei("F12", "functions", "tanh(x)", "numeric", { output: "tanh(x)" }),
    oei("F13", "functions", "ln(x)", "numeric", { output: "ln(x)" }),
    oei("F14", "functions", "exp(x)", "numeric", { output: "exp(x)" }),
    oei("F15", "functions", "abs(x)", "numeric", { output: "abs(x)" }),
    oei("L01", "logs", "log(x)", "numeric", {
      output: "log10(x)",
      status: "warning",
      warning_substrings: ["base-10 log10"],
    }),
    oei("L02", "logs", "log2(x)", "numeric", { output: "log2(x)" }),
    oei("L03", "logs", "log10(x)", "numeric", { output: "log10(x)" }),
    oei("L04", "logs", "ln(x+1)", "numeric", { output: "ln(x+1)" }),
    oei("W01", "warnings", "floor(x)", "numeric", {
      output: "floor(x)",
      status: "warning",
      warning_substrings: ["Floor is not a standard MITx calculator function"],
    }),
    oei("W02", "warnings", "ceil(x)", "numeric", {
      output: "ceil(x)",
      status: "warning",
      warning_substrings: ["Ceil is not a standard MITx calculator function"],
    }),
    oei("W03", "warnings", "round(x)", "numeric", {
      output: "round(x)",
      status: "warning",
      warning_substrings: ["Round is not a standard MITx calculator function"],
    }),
    oei("W04", "warnings", "sign(x)", "numeric", {
      output: "sign(x)",
      status: "warning",
      warning_substrings: ["Sgn is not a standard MITx calculator function"],
    }),
    oei("W05", "warnings", "sgn(x)", "numeric", {
      output: "sign(x)",
      status: "warning",
      warning_substrings: ["Sgn is not a standard MITx calculator function"],
    }),
    oei("M01", "physics", "k*x^2/2", "numeric", { output: "k*x^2/2" }),
    oei("M02", "physics", "n*R*T/V", "numeric", { output: "n*R*T/V" }),
    oei("M03", "physics", "q_1*q_2/r^2", "numeric", {
      output: "q_1*q_2/r^2",
      status: "warning",
      warning_substrings: ["Subscripted variables"],
    }),
    oei("M04", "physics", "rho*g*h", "numeric", { output: "rho*g*h" }),
    oei("M05", "physics", "P*V=n*R*T", "numeric", {
      output: "P*V=n*R*T",
      status: "warning",
      warning_substrings: ["Equations and inequalities"],
    }),
    oei("M06", "physics", "A*exp(-Ea/(R*T))", "numeric", {
      output: "A*exp(-Ea/(R*T))",
    }),
    oei("M07", "physics", "c_1*v_1=c_2*v_2", "numeric", {
      output: "c_1*v_1=c_2*v_2",
      status: "warning",
      warning_substrings: ["Equations and inequalities", "Subscripted variables"],
    }),
    oei("M08", "physics", "(m_3*g-(mu*m_1*g+mu*m_2*g))/(m_1+m_2+m_3)", "numeric", {
      output: "(m_3*g-(mu*m_1*g+mu*m_2*g))/(m_1+m_2+m_3)",
      status: "warning",
      warning_substrings: ["Subscripted variables"],
    }),
    oei("M09", "physics", "mu_s*g", "numeric", {
      output: "mu_s*g",
      status: "warning",
      warning_substrings: ["Subscripted variables"],
    }),
    oei(
      "M10",
      "physics",
      "sqrt(R*g*(sin(beta)-mu_s*cos(beta))/(cos(beta)+mu_s*sin(beta)))",
      "numeric",
      {
        output:
          "sqrt((R*g*(sin(beta)-mu_s*cos(beta)))/(cos(beta)+mu_s*sin(beta)))",
        status: "warning",
        warning_substrings: ["Subscripted variables"],
      },
    ),
    oei("M11", "physics", "G*M*m/r^2", "numeric", {
      output: "G*M*m/r^2",
      notes: "Bare G must remain the MITx gravitational variable, not CatalanConstant.",
    }),
    oei("M12", "physics", "G/r^2*M*m", "numeric", {
      output: "G/r^2*M*m",
      notes: "Reserved-symbol restoration must preserve multiplication order.",
    }),
    oei("M13", "physics", "G*M*m*r^(-2)", "numeric", {
      output: "G*M*m*r^(-2)",
      notes: "Reserved-symbol restoration must preserve negative exponents.",
    }),
    oei("M14", "physics", "(G*M*m)/r^2", "numeric", {
      output: "(G*M*m)/r^2",
      notes: "Reserved-symbol restoration must preserve grouping.",
    }),
    oei("M15", "vector-aliases", "hati+hatj+hatk", "symbolic", {
      output: "hati+hatj+hatk",
      notes: "Question-provided vector aliases must stay contiguous variables.",
    }),
    oei("M16", "vector-aliases", "3*hati-2*hatj+6*hatk", "symbolic", {
      output: "3*hati-2*hatj+6*hatk",
      notes: "Explicit multiplication must not split question-provided aliases.",
    }),
    oei("M17", "vector-aliases", "S_1^2+S_2^2-S_1*S_2", "symbolic", {
      output: "S_1^2+S_2^2-S_1*S_2",
      notes: "Subscripted multi-character variables must survive translation.",
    }),
    oei("M18", "reserved-symbols", "phi+G", "symbolic", {
      output: "phi+G",
      notes: "Question variables named phi and G must not become parser constants.",
    }),
    oei("M19", "reserved-symbols", "gamma+G", "symbolic", {
      output: "gamma+G",
      notes: "Greek gamma variables must remain MITx's gamma spelling.",
    }),
    oei("T01", "typing", "sin(theta)+cos(theta)", "numeric", {
      output: "sin(theta)+cos(theta)",
    }),
    oei("T02", "typing", "sqrt(x^2+y^2)", "numeric", {
      output: "sqrt((x^2+y^2))",
    }),
    oei("T03", "typing", "ln(x+1)/(1+x^2)", "numeric", {
      output: "ln(x+1)/(1+x^2)",
    }),
    oei("T04", "typing", "abs(x-y)", "numeric", { output: "abs(x-y)" }),
    oei("T05", "typing", "m_1*(m_3*g-(mu*m_1*g+mu*m_2*g))", "numeric", {
      output: "m_1*(m_3*g-(mu*m_1*g+mu*m_2*g))",
      status: "warning",
      warning_substrings: ["Subscripted variables"],
    }),
    oei("S01", "symbolic", "x+y=z", "symbolic", { output: "x+y=z" }),
    oei("S02", "symbolic", "x_1+x_2", "symbolic", {
      output: "x_1+x_2",
      status: "warning",
      warning_substrings: ["Subscripted variables"],
    }),
    oei("S03", "symbolic", "0<=x<=1", "symbolic", { output: "0<=x<=1" }),
    oei("LIT1", "literal", "sqrt(x)+pi", "literal", {
      output: "\u221A((x) + \u03C0)",
    }),
    oei("LIT2", "literal", "theta+mu", "literal", {
      output: "\u03B8 + \u03BC",
    }),
    oei("E01", "errors", "x+", "numeric", {
      output: "x",
      status: "error",
      error_substrings: ["unsupported expression object"],
    }),
    oei("E02", "errors", "(", "numeric", {
      output: "",
      status: "error",
      error_substrings: ["empty"],
    }),
    oei("E03", "errors", "0<", "numeric", {
      output: "0",
      status: "error",
      error_substrings: ["parsed"],
    }),
  ] : [];
  function qaWait(e) {
    return new Promise((t) => window.setTimeout(t, e));
  }
  var Mt = class {
    trigger;
    input;
    kind;
    settings;
    hooks;
    active = !1;
    inlineEnabled = !1;
    detailsOpen = !1;
    controls;
    editorSurface;
    detailsPanel;
    detailsMount;
    mathField;
    mode;
    outputCode;
    statusText;
    warningList;
    errorList;
    modeSelect;
    paletteGrid;
    paletteSearch;
    lastResult = { output: "", warnings: [], errors: [], isSupported: !0 };
    hasInitialResult = !1;
    trackedProductCount = 0;
    operationCountTimer;
    lastCommittedOutput = "";
    draftExpression = "";
    writingNative = !1;
    originalTabIndex;
    externalInputListener;
    focusTransferTimer;
    equationFitFrame;
    originalInlineHeight;
    originalInlineBoxSizing;
    contextAliases;
    restoreControl;
    restoreHint;
    restoreHintPositionFrame;
    restoreHintCounted = !1;
    restoreAvailable = !1;
    activationPending = !1;
    activationOriginalValue = "";
    activationBaselineLatex = "";
    activationInitialOutput = "";
    skipNextDeactivateCommit = !1;
    historyStates = [];
    historyIndex = -1;
    historyApplying = !1;
    formElement;
    formSubmitListener;
    symbolsOpen = !0;
    symbolsPreferenceTouched = !1;
    symbolsToggle;
    constructor(t, i, r, n) {
      ((this.input = t),
        (this.contextAliases = discoverPsetterContextAliases(t)),
        (this.kind = i),
        (this.settings = r),
        (this.hooks = n),
        (this.inlineEnabled = !!r.inlineEnabledDefault),
        (this.mode = r.defaultMode),
        (this.lastCommittedOutput = t.value),
        (this.draftExpression = t.value),
        (this.originalTabIndex = t.getAttribute("tabindex")),
        (this.trigger = Be(
          "",
          "pset-math-trigger",
           "Show the full Psetter editor",
        )),
        (this.trigger.dataset.fieldKind = i),
        (() => {
          let s = R("span", "pset-math-trigger-label");
          let a = R("img");
          a.src = getExtensionUrl("icons/psetter-px-logo-white.svg");
          a.alt = "P^x";
          a.setAttribute("aria-hidden", "true");
          a.draggable = !1;
          s.appendChild(a);
          this.trigger.replaceChildren(s);
        })(),
        (this.trigger.hidden = !0),
        this.trigger.addEventListener("mousedown", (s) => s.preventDefault()),
        this.trigger.addEventListener("click", () => {
          this.active || this.hooks.requestActivation(this), this.toggleDetails();
        }),
        (t.dataset.psetMathEnhanced = "true"),
        t.insertAdjacentElement("afterend", this.trigger),
        (this.restoreControl = R("span", "pset-math-restore-control")),
        this.restoreControl.setAttribute("role", "button"),
        this.restoreControl.setAttribute("tabindex", "0"),
        this.restoreControl.setAttribute(
          "aria-label",
          "Restore the original answer before Psetter translated it",
        ),
        this.restoreControl.setAttribute(
          "title",
          "Restore the original answer",
        ),
        (() => {
          let s = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
            a = document.createElementNS("http://www.w3.org/2000/svg", "path");
          s.setAttribute("viewBox", "0 0 24 24");
          s.setAttribute("aria-hidden", "true");
          s.setAttribute("focusable", "false");
          a.setAttribute("d", "M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3");
          s.appendChild(a);
          this.restoreControl.appendChild(s);
        })(),
        (this.restoreControl.hidden = !0),
        this.restoreControl.addEventListener("mousedown", (s) => {
          s.preventDefault();
          s.stopPropagation();
        }),
        this.restoreControl.addEventListener("click", (s) => {
          s.preventDefault();
          s.stopPropagation();
          this.restoreOriginal();
        }),
        this.restoreControl.addEventListener("keydown", (s) => {
          if (s.key !== "Enter" && s.key !== " ") return;
          s.preventDefault();
          s.stopPropagation();
          this.restoreOriginal();
        }),
        this.trigger.insertAdjacentElement("afterend", this.restoreControl),
        (this.restoreHint = R(
          "div",
          "pset-math-restore-hint",
          "Think Psetter got it wrong? Click here to restore.",
        )),
        this.restoreHint.setAttribute("role", "status"),
        this.restoreHint.setAttribute("aria-hidden", "true"),
        this.restoreHint.addEventListener("pointerdown", (s) => {
          s.preventDefault();
          s.stopPropagation();
        }),
        (document.body ?? document.documentElement).appendChild(this.restoreHint),
        (this.formElement = t.form ?? t.closest?.("form")),
        (this.formSubmitListener = () => {
          ((this.restoreAvailable = !1), this.renderRestoreControl());
        }),
        this.formElement?.addEventListener("submit", this.formSubmitListener),
        t.addEventListener("focus", () => {
          (this.hooks.requestActivation(this), this.scheduleMathFieldFocus());
        }),
        t.addEventListener("keydown", (s) => this.handleNativeKeydown(s)),
        (this.externalInputListener = () => {
          this.writingNative ||
            !this.active ||
            !this.mathField ||
            (this.input.value !== this.lastCommittedOutput &&
              ((this.draftExpression = this.input.value),
              this.mathField.latex(Bt(this.input.value)),
              this.recompute()));
        }),
        t.addEventListener("input", this.externalInputListener));
    }
    get isActive() {
      return this.active;
    }
    updateSettings(t) {
      if (((this.settings = t), !t.enabled)) {
        this.deactivate();
        return;
      }
      (this.active || (this.mode = t.defaultMode),
        this.active &&
          this.inlineEnabled !== !!t.inlineEnabledDefault &&
          (t.inlineEnabledDefault ? this.enableInline() : this.disableInline()),
        !this.active && (this.inlineEnabled = !!t.inlineEnabledDefault),
        this.active && this.renderDetailsVisibility(),
        this.renderControls(),
        this.hooks.onControllerStateChanged?.(this));
    }
    resolvePanelHost() {
      let t = this.input.parentElement,
        i =
          ".formulaequationinput, .text-input-dynamath, .capa_inputtype.textline, .capa_inputtype, .inputtype, .problem-response, .response, .response-field, .answer";
      for (let r = this.input; r && r !== document.body; r = r.parentElement)
        r.matches?.(i) && (t = r);
      return t ?? this.input.parentElement;
    }
    ownsTarget(t) {
      if (!t || (typeof t !== "object" && typeof t !== "function")) return !1;
      return [
        this.input,
        this.trigger,
        this.controls,
        this.editorSurface,
        this.detailsMount,
        this.restoreControl,
      ].some((i) => {
        if (!i) return !1;
        try {
          return i === t || i.contains(t);
        } catch {
          return !1;
        }
      });
    }
    ownsEvent(t) {
      return (
        this.ownsTarget(t.target) ||
        !!t.composedPath?.().some((i) => this.ownsTarget(i))
      );
    }
    toggleDetails() {
      ((this.detailsOpen = !this.detailsOpen),
        this.detailsOpen && !this.detailsPanel && this.mountDetailsPanel(),
        this.hooks.onDetailsToggled(this.detailsOpen),
        this.renderDetailsVisibility());
    }
    setMode(t) {
      ((this.mode = t),
        this.modeSelect && (this.modeSelect.value = t),
        this.recompute());
    }
    toggleInline() {
      (this.inlineEnabled ? this.disableInline() : this.enableInline(),
        this.renderControls(),
        this.hooks.onControllerStateChanged?.(this));
    }
    clearExpression() {
      this.clearActivationRestore();
      this.inlineEnabled && this.mathField
        ? ((this.mathField.latex(""), this.recompute(), this.mathField.focus()))
        : ((this.lastCommittedOutput = ""), Bn(this.input, ""));
    }
    typeCharacter(t) {
      if (!this.inlineEnabled) return !1;
      this.mathField || this.mountInlineEditor();
      if (!this.mathField) return !1;
      this.clearActivationRestore();
      return (
        t === " "
          ? this.mathField.typedText?.(" ")
          : this.mathField.typedText
            ? this.mathField.typedText(t)
            : this.mathField.write(t),
        this.recompute(),
        this.mathField.focus(),
        !0
      );
    }
    scheduleMathFieldFocus() {
      this.focusTransferTimer && window.clearTimeout(this.focusTransferTimer),
        (this.focusTransferTimer = window.setTimeout(() => {
          this.focusTransferTimer = void 0;
          if (!this.active || !this.inlineEnabled) return;
          this.mathField || this.mountInlineEditor(),
            this.mathField &&
              (this.mathField.focus(),
              typeof this.mathField.moveToRightEnd == "function" &&
                this.mathField.moveToRightEnd());
        }, 0));
    }
    handleNativeKeydown(t) {
      this.active &&
        this.inlineEnabled &&
        !this.mathField &&
        this.mountInlineEditor();
      if (
        !this.active ||
        !this.inlineEnabled ||
        !this.mathField ||
        t.defaultPrevented ||
        t.isComposing
      )
        return;
      let i = !1;
      if (t.key.length === 1 && !t.ctrlKey && !t.metaKey && !t.altKey)
        (this.clearActivationRestore(),
          this.mathField.typedText
          ? this.mathField.typedText(t.key)
          : this.mathField.write(t.key),
          (i = !0));
      else {
        let r = {
          Backspace: "Backspace",
          Delete: "Del",
          ArrowLeft: "Left",
          ArrowRight: "Right",
          ArrowUp: "Up",
          ArrowDown: "Down",
          Home: "Home",
          End: "End",
          Tab: "Tab",
        }[t.key];
        r &&
          typeof this.mathField.keystroke == "function" &&
          (this.clearActivationRestore(), this.mathField.keystroke(r), (i = !0));
      }
      i &&
        (t.preventDefault(),
        this.recompute(),
        this.scheduleMathFieldFocus());
    }
    mountInlineEditor() {
      if (this.controls || !this.input.isConnected) return;
      let t = R("span", "pset-math-takeover"),
        i = R("div", "pset-math-editor-surface"),
        r = R("span", "pset-math-field");
      (i.setAttribute("role", "group"),
        i.setAttribute("aria-label", "Psetter answer input"),
        // Keep editor interactions inside Psetter. Preventing the default
        // mousedown here used to block MathQuill's own focus/cursor logic.
        i.addEventListener("pointerdown", (n) => n.stopPropagation()),
        i.addEventListener("mousedown", (n) => n.stopPropagation()),
        i.addEventListener("focusin", (n) => n.stopPropagation()),
        i.addEventListener("keydown", (n) => this.handleEditorShortcut(n)),
        i.appendChild(r),
        this.input.parentNode?.insertBefore(t, this.input),
        t.append(this.input, i),
        (this.controls = t),
        (this.editorSurface = i),
        (this.originalInlineHeight = this.input.style.height),
        (this.originalInlineBoxSizing = this.input.style.boxSizing),
        (this.input.style.boxSizing = "border-box"),
        this.input.classList.add("pset-math-native-covered"),
        (this.mathField = Xl.MathField(r, {
          spaceBehavesLikeTab: !0,
          leftRightIntoCmdGoes: "up",
          restrictMismatchedBrackets: !0,
          supSubsRequireOperand: !0,
          charsThatBreakOutOfSupSub: "+-=<>*/),",
          autoCommands: [
            "pi",
            "theta",
            "alpha",
            "beta",
            "gamma",
            "delta",
            "lambda",
            "mu",
            "rho",
            "sigma",
            "phi",
            "omega",
            "sqrt",
            "sum",
          ].join(" "),
          handlers: {
            edit: () => {
              this.historyApplying || this.activationPending || this.clearActivationRestore();
              this.recompute();
            },
            enter: () => {
              this.detailsOpen &&
                ((this.detailsOpen = !1), this.renderDetailsVisibility());
            },
          },
        })));
      let n = (this.draftExpression || this.input.value).trim();
        (n && this.mathField.latex(Bt(n)),
        this.recompute(),
        (this.activationPending = !1),
        this.renderRestoreControl(),
        this.maybeShowRestoreHint(),
        this.scheduleMathFieldFocus());
    }
    unmountInlineEditor() {
      (this.equationFitFrame && window.cancelAnimationFrame(this.equationFitFrame),
        (this.equationFitFrame = void 0),
        (this.input.style.height = this.originalInlineHeight ?? ""),
        (this.input.style.boxSizing = this.originalInlineBoxSizing ?? ""),
        (this.originalInlineHeight = void 0),
        (this.originalInlineBoxSizing = void 0),
        this.controls?.parentNode &&
        (this.controls.parentNode.insertBefore(this.input, this.controls),
        this.controls.remove()),
        this.input.classList.remove("pset-math-native-covered"),
        (this.controls = void 0),
        (this.editorSurface = void 0),
        (this.mathField = void 0));
    }
    getDraftValue(t = this.mathField?.latex?.() ?? "") {
      if (!this.mathField) return this.draftExpression || this.input.value || "";
      return Kii(t, this.draftExpression, this.contextAliases);
    }
    getCommittedValue() {
      if (!this.mathField) return this.lastCommittedOutput || this.input.value;
        let t = this.mathField.latex(),
        i = this.getDraftValue(t),
        r = Rn(t, this.mode, this.contextAliases);
      if (((this.lastResult = r), r.isSupported)) {
        // MathQuill's plain-text form preserves contiguous authored aliases
        // in cases where its LaTeX form has already been normalized into
        // implicit products. Keep explicit `*` multiplication untouched.
        let n = this.mathField.text?.() ?? t;
        return restorePsetterMultiLetterSymbols(n, r.output, this.contextAliases);
      }
      return i.trim() ? i : this.lastCommittedOutput;
    }
    writeNativeValue(t) {
      // Keep the value sent back to MITx aligned with the user's source
      // spelling. This final guard covers parser paths that may normalize a
      // reserved single-letter symbol before Rn() returns its result.
      let i = this.mathField?.latex?.() ?? "";
      t = restorePsetterReservedSymbols(i, t);
      t = restorePsetterMultiLetterSymbols(i, t, this.contextAliases);
      t = restorePsetterMultiLetterSymbols(this.mathField?.text?.() ?? i, t, this.contextAliases);
      if (
        typeof t != "string" ||
        (t === this.lastCommittedOutput && this.input.value === t)
      )
        return;
      this.writingNative = !0;
      try {
        ((this.lastCommittedOutput = t), Bn(this.input, t));
      } finally {
        this.writingNative = !1;
      }
    }
    commitNativeValue() {
      this.writeNativeValue(this.getCommittedValue());
    }
    enableInline() {
      ((this.inlineEnabled = !0),
        this.mountInlineEditor(),
        this.input.classList.add("pset-math-active-field"));
    }
    disableInline() {
      this.mathField && this.commitNativeValue();
      ((this.inlineEnabled = !1),
        (this.detailsOpen = !1),
        this.detailsMount?.remove(),
        this.unmountInlineEditor(),
        this.input.classList.remove("pset-math-active-field"),
        (this.detailsPanel = void 0),
        (this.detailsMount = void 0),
        (this.outputCode = void 0),
        (this.statusText = void 0),
        (this.warningList = void 0),
        (this.errorList = void 0),
        (this.modeSelect = void 0),
        (this.paletteGrid = void 0),
        (this.paletteSearch = void 0));
    }
    renderControls() {
      ((this.trigger.hidden = !this.active || !this.inlineEnabled),
        this.trigger.classList.toggle("is-inline-off", !this.inlineEnabled),
        this.renderRestoreControl());
    }
    activate() {
      this.active ||
        !this.input.isConnected ||
        ((this.active = !0),
        (this.activationOriginalValue = this.input.value),
        (this.activationBaselineLatex = ""),
        (this.activationInitialOutput = ""),
        (this.restoreHintCounted = !1),
        (this.activationPending = !0),
        // Keep the recovery affordance available for the entire activation
        // session. It is cleared only by an explicit edit, restore, or submit.
        (this.restoreAvailable = this.activationOriginalValue.length > 0),
        this.renderRestoreControl(),
        this.input.value !== this.lastCommittedOutput &&
          (this.draftExpression = this.input.value),
        (this.detailsOpen = !1),
        this.inlineEnabled && this.enableInline(),
        this.renderControls(),
        this.renderDetailsVisibility(),
        this.hooks.onControllerStateChanged?.(this));
    }
    deactivate() {
      this.active &&
        (this.mathField &&
          !this.skipNextDeactivateCommit &&
          this.commitNativeValue(),
        (this.skipNextDeactivateCommit = !1),
        ((this.active = !1),
        (this.detailsOpen = !1),
        this.detailsMount?.remove(),
        this.unmountInlineEditor(),
        this.input.classList.remove("pset-math-active-field"),
        this.input.classList.remove("pset-math-native-covered"),
        this.trigger.classList.remove("is-open"),
        this.trigger.setAttribute("aria-pressed", "false"),
        (this.trigger.hidden = !0),
        (this.detailsPanel = void 0),
        (this.detailsMount = void 0),
        (this.outputCode = void 0),
        (this.statusText = void 0),
        (this.warningList = void 0),
        (this.errorList = void 0),
        (this.modeSelect = void 0),
        (this.paletteGrid = void 0),
        (this.paletteSearch = void 0),
        this.hideRestoreHint(),
        this.renderRestoreControl()),
        this.hooks.onControllerStateChanged?.(this));
    }
    renderRestoreControl() {
      let t =
        this.active &&
        this.restoreAvailable &&
        this.activationOriginalValue.length > 0;
      this.restoreControl &&
        ((this.restoreControl.hidden = !t),
          this.restoreControl.classList.toggle(
            "is-visible",
            t,
          ),
          this.restoreControl.setAttribute(
            "aria-hidden",
            this.active && this.restoreAvailable ? "false" : "true",
          )),
        !t && this.hideRestoreHint();
    }
    clearActivationRestore() {
      this.restoreAvailable &&
        ((this.restoreAvailable = !1), this.hideRestoreHint(), this.renderRestoreControl());
    }
    positionRestoreHint() {
      if (!this.restoreHint || !this.restoreControl || this.restoreControl.hidden)
        return;
      let t = this.restoreControl.getBoundingClientRect(),
        n = this.restoreHint.getBoundingClientRect().width || 0,
        i = Math.max(8, Math.min(window.innerWidth - n - 8, t.left + t.width / 2 - 12)),
        r = Math.max(8, t.top - 8);
      (this.restoreHint.style.left = `${i}px`),
        (this.restoreHint.style.top = `${r}px`);
    }
    showRestoreHint() {
      if (!this.restoreHint || !this.restoreAvailable || !this.active) return;
      this.positionRestoreHint();
      this.restoreHint.classList.add("is-visible");
      this.restoreHint.setAttribute("aria-hidden", "false");
      this.restoreHintPositionFrame &&
        window.cancelAnimationFrame(this.restoreHintPositionFrame);
      this.restoreHintPositionFrame = window.requestAnimationFrame(() => {
        this.restoreHintPositionFrame = void 0;
        this.positionRestoreHint();
      });
    }
    hideRestoreHint() {
      if (!this.restoreHint) return;
      this.restoreHint.classList.remove("is-visible");
      this.restoreHint.setAttribute("aria-hidden", "true");
      this.restoreHintPositionFrame &&
        (window.cancelAnimationFrame(this.restoreHintPositionFrame),
        (this.restoreHintPositionFrame = void 0));
    }
    maybeShowRestoreHint() {
      if (this.restoreHintCounted || !this.restoreAvailable || !this.active) return;
      this.restoreHintCounted = !0;
      recordPsetterRestoreHintTranslation().then((t) => {
        if (!t?.shouldShow) return;
        this.showRestoreHint();
        // Wait one frame so the restore control has its final page position.
        window.requestAnimationFrame(() => this.showRestoreHint());
      });
    }
    handleEditorShortcut(t) {
      if (
        !this.active ||
        !this.mathField ||
        !(t.ctrlKey || t.metaKey) ||
        t.altKey
      )
        return;
      let i = String(t.key ?? "").toLowerCase();
      if (i === "z") {
        t.preventDefault();
        t.stopPropagation();
        t.shiftKey ? this.redoHistory() : this.restoreAvailable ? this.restoreOriginal() : this.undoHistory();
      } else if (i === "y" && !t.metaKey) {
        t.preventDefault();
        t.stopPropagation();
        this.redoHistory();
      }
    }
    recordHistoryState(t) {
      if (this.historyApplying || typeof t != "string") return;
      if (this.historyStates[this.historyIndex] === t) return;
      this.historyStates = this.historyStates.slice(0, this.historyIndex + 1);
      this.historyStates.push(t);
      this.historyIndex = this.historyStates.length - 1;
      if (this.historyStates.length > 50) {
        this.historyStates.shift();
        this.historyIndex--;
      }
    }
    restoreHistoryState(t) {
      if (!this.mathField || typeof t != "string") return;
      this.historyApplying = !0;
      try {
        this.mathField.latex(t);
      } finally {
        this.historyApplying = !1;
      }
      this.recompute();
      this.mathField.focus();
    }
    undoHistory() {
      if (this.historyIndex <= 0) return;
      this.historyIndex--;
      this.restoreHistoryState(this.historyStates[this.historyIndex]);
    }
    redoHistory() {
      if (this.historyIndex < 0 || this.historyIndex >= this.historyStates.length - 1)
        return;
      this.historyIndex++;
      this.restoreHistoryState(this.historyStates[this.historyIndex]);
    }
    restoreOriginal() {
      if (!this.restoreAvailable || typeof this.activationOriginalValue != "string")
        return;
      let t = this.activationOriginalValue;
      ((this.restoreAvailable = !1),
        this.activationPending = !1,
        this.skipNextDeactivateCommit = !0,
        this.deactivate(),
        (this.lastCommittedOutput = t),
        (this.draftExpression = t),
        Bn(this.input, t),
        this.renderRestoreControl());
    }
    dispose() {
      (this.deactivate(),
        this.focusTransferTimer && window.clearTimeout(this.focusTransferTimer),
        this.operationCountTimer && window.clearTimeout(this.operationCountTimer),
        this.input.removeEventListener("input", this.externalInputListener),
        this.formElement?.removeEventListener("submit", this.formSubmitListener),
        this.input.removeAttribute("data-pset-math-enhanced"),
        this.trigger.remove(),
        this.restoreControl?.remove(),
        this.restoreHintPositionFrame &&
          window.cancelAnimationFrame(this.restoreHintPositionFrame),
        this.restoreHint?.remove());
    }
    focus() {
      this.mathField?.focus();
    }
    mountDetailsPanel() {
      if (this.detailsPanel || !this.input.isConnected) return;
      let t = this.resolvePanelHost(),
        i = this.buildDetailsPanel(),
        r = R("div", "pset-math-details-slot");
      (r.style.setProperty("--pset-math-panel-width", "460px"),
        r.appendChild(i),
        t?.insertAdjacentElement("afterend", r),
        (this.detailsMount = r),
        (this.detailsPanel = i),
        i.addEventListener("pointerdown", (n) => n.stopPropagation()),
        i.addEventListener("mousedown", (n) => n.stopPropagation()),
        i.addEventListener("click", (n) => n.stopPropagation()),
        i.addEventListener("focusin", (n) => n.stopPropagation()),
        i.addEventListener("pointerup", (n) => n.stopPropagation()),
        i.addEventListener("keydown", (n) => {
          n.key === "Escape" &&
            (n.preventDefault(),
            (this.detailsOpen = !1),
            this.renderDetailsVisibility(),
            this.input.focus());
        }));
    }
    buildDetailsPanel() {
      let t = R("div", "pset-math-details"),
        w = qn(this.input);
      this.settings.remoteFeatures?.contextSymbols !== !1 &&
        w.length > 0 &&
        t.appendChild(this.buildSymbolSection("From this question", w));
      (w.length === 0 || this.settings.remoteFeatures?.contextSymbols === !1) &&
        t.classList.add("pset-math-no-context");
      let z = R("div", "pset-math-palette-header"),
        O = R("strong", void 0, "Symbols"),
        ee = R("input", "pset-math-symbol-search pset-math-internal");
      let oe = Be("-", "pset-math-symbol-toggle", "Collapse Symbols");
      let ue = R("span", "pset-math-symbol-heading");
      (oe.setAttribute("aria-expanded", "true"),
        oe.addEventListener("click", () => {
          ((this.symbolsPreferenceTouched = !0),
            this.setSymbolsOpen(!this.symbolsOpen, !0));
        }),
        (this.symbolsToggle = oe),
        ue.append(O, oe),
        (ee.type = "search"),
        (ee.placeholder = "Search symbols"),
        ee.setAttribute("aria-label", "Search symbols"),
        (ee.hidden = this.settings.remoteFeatures?.symbolSearch === !1),
        ee.addEventListener("input", () => {
          ee.value.trim() &&
            ((this.symbolsPreferenceTouched = !0), this.setSymbolsOpen(!0));
          this.renderPalette(ee.value);
        }),
        (this.paletteSearch = ee),
        z.append(ue, ee));
      let re = R("div", "pset-math-symbol-grid");
      let ie = R("div", "pset-math-brand-footer"),
        pe = R("img", "pset-math-brand-logo"),
        de = R("span", "pset-math-brand-name", "Psetter™"),
        ae = R("div", "pset-math-brand-links"),
        le = R("a", void 0, "GitHub"),
        ce = R("a", "pset-math-feedback-link", "Feedback");
      pe.src = getExtensionUrl("icons/psetter-px-logo-white.svg");
      pe.alt = "P^x";
      le.href = "https://github.com/pedrovillafranco/psetter";
      le.target = "_blank";
      le.rel = "noopener noreferrer";
      ce.setAttribute("role", "button");
      ce.setAttribute("tabindex", "0");
      ce.setAttribute("aria-label", "Open feedback form");
      let openFeedback = () => this.hooks.onFeedbackRequested?.();
      ce.addEventListener("click", openFeedback);
      ce.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openFeedback();
      });
      ce.hidden = this.settings.feedbackDisabled === !0;
      ae.append(le, ce);
      ie.append(pe, de, ae);
      return (
        (this.paletteGrid = re),
        t.append(z, re, ie),
        this.setSymbolsOpen(this.symbolsOpen),
        loadPsetterSymbolsPreference().then((n) => {
          n !== null &&
            !this.symbolsPreferenceTouched &&
            this.setSymbolsOpen(n);
        }).catch(() => {}),
        this.renderPalette(""),
        t
      );
    }
    setSymbolsOpen(t, i = !1) {
      ((this.symbolsOpen = !!t),
        this.paletteGrid &&
          ((this.paletteGrid.hidden = !this.symbolsOpen),
            this.paletteGrid.setAttribute(
              "aria-hidden",
              this.symbolsOpen ? "false" : "true",
            )),
        this.symbolsToggle &&
          ((this.symbolsToggle.textContent = this.symbolsOpen ? "-" : "+"),
            this.symbolsToggle.setAttribute(
              "aria-expanded",
              this.symbolsOpen ? "true" : "false",
            ),
            this.symbolsToggle.setAttribute(
              "aria-label",
              this.symbolsOpen ? "Collapse Symbols" : "Expand Symbols",
            )),
        i && savePsetterSymbolsPreference(this.symbolsOpen));
    }
    buildSymbolSection(t, i) {
      let r = R("div", "pset-math-nearby-symbols");
      r.appendChild(R("span", "pset-math-section-label", t));
      let n = R("div", "pset-math-symbol-grid compact");
      return (
        i.forEach((s) => n.appendChild(this.buildSymbolButton(s))),
        r.appendChild(n),
        r
      );
    }
    buildSymbolButton(t) {
      let i = Be(t.label, "pset-math-symbol-button", `Insert ${t.search}`);
      if (t.display) {
        let r = R("span", "pset-math-context-term", t.display.base);
        if (t.display.subscript) {
          let n = document.createElement("sub");
          ((n.textContent = t.display.subscript), r.appendChild(n));
        }
        i.replaceChildren(r);
      }
      return (
        (i.dataset.symbolId = t.id),
        i.addEventListener("click", () => this.insertSymbol(t)),
        i
      );
    }
    renderPalette(t) {
      if (!this.paletteGrid) return;
      let i = t.trim().toLowerCase(),
        r = Si.filter(
          (n) =>
            !i || `${n.label} ${n.search} ${n.id}`.toLowerCase().includes(i),
        );
      this.paletteGrid.replaceChildren(
        ...r.map((n) => this.buildSymbolButton(n)),
      );
    }
    insertSymbol(t) {
      if (!this.mathField) return;
      this.clearActivationRestore();
      let i = new Map([
        ["pi", "\\pi"],
        ["alpha", "\\alpha"],
        ["beta", "\\beta"],
        ["gamma", "\\gamma"],
        ["delta", "\\delta"],
        ["epsilon", "\\epsilon"],
        ["theta", "\\theta"],
        ["lambda", "\\lambda"],
        ["mu", "\\mu"],
        ["rho", "\\rho"],
        ["sigma", "\\sigma"],
        ["phi", "\\phi"],
        ["omega", "\\omega"],
        ["Delta", "\\Delta"],
        ["Sigma", "\\Sigma"],
        ["Omega", "\\Omega"],
        ["le", "\\le"],
        ["ge", "\\ge"],
        ["ne", "\\ne"],
        ["approx", "\\approx"],
        ["pm", "\\pm"],
      ]);
      let r = new Map([
        ["sin", "\\sin"],
        ["cos", "\\cos"],
        ["tan", "\\tan"],
        ["ln", "\\ln"],
        ["log", "\\log"],
      ]);
      // Insert structural symbols through MathQuill's commands rather than
      // writing raw LaTeX. Raw placeholders can become literal operators or
      // leave the cursor outside the intended structure.
      (t.kind === "term"
        ? this.mathField.write(t.latex)
        : t.id === "plus"
        ? this.mathField.typedText("+")
        : t.id === "abs"
        ? this.mathField.typedText("|")
        : t.id === "exp"
        ? this.mathField.typedText("e^")
        : t.id === "sqrt"
        ? this.mathField.cmd("\\sqrt")
        : r.has(t.id)
          ? (this.mathField.cmd(r.get(t.id)),
            typeof this.mathField.typedText == "function"
              ? this.mathField.typedText("(")
              : this.mathField.write("("))
        : i.has(t.id)
          ? this.mathField.cmd(i.get(t.id))
          : null,
        this.mathField.focus(),
        this.recompute());
    }
    recompute() {
      if (!this.mathField) return;
      this.contextAliases = discoverPsetterContextAliases(this.input);
      let t = this.mathField.latex(),
        i = this.getDraftValue(t),
        r = Rn(t, this.mode, this.contextAliases);
      let n = r.isSupported ? r.output : i;
      if (this.activationPending) {
        this.activationBaselineLatex = t;
        this.activationInitialOutput = n;
      }
      ((this.draftExpression = i),
        (this.lastResult = r),
        this.writeNativeValue(n));
      this.recordHistoryState(t);
      this.renderRestoreControl();
      (this.queueTermCombinationCount(),
        this.renderResult(r),
        this.fitEquationHeight(),
        __PSETTER_DEV_BUILD__ && globalThis.__psetterQaHarness?.recordController(this));
    }
    queueTermCombinationCount() {
      let t = (this.lastResult?.output?.match(/\*/g) ?? []).length;
      if (!this.hasInitialResult) {
        ((this.hasInitialResult = !0), (this.trackedProductCount = t));
        return;
      }
      (this.operationCountTimer && window.clearTimeout(this.operationCountTimer),
        (this.operationCountTimer = window.setTimeout(() => {
          let i = (this.lastResult?.output?.match(/\*/g) ?? []).length,
            r = i - this.trackedProductCount;
          ((this.trackedProductCount = i),
            r > 0 && this.hooks.onTermCombined?.(r));
        }, 450)));
    }
    fitEquationHeight() {
      this.equationFitFrame && window.cancelAnimationFrame(this.equationFitFrame);
      this.equationFitFrame = window.requestAnimationFrame(() => {
        this.equationFitFrame = void 0;
        if (!this.controls || !this.editorSurface || !this.input.isConnected) return;
        let t = this.editorSurface.querySelector(".pset-math-field"),
          i = this.editorSurface.querySelector(".mq-root-block"),
          r = t ? getComputedStyle(t) : null,
          n =
            (parseFloat(r?.paddingTop ?? "0") || 0) +
            (parseFloat(r?.paddingBottom ?? "0") || 0),
          s = i?.getBoundingClientRect().height ?? 0,
          a = Math.ceil(s + n);
        a > 0 && (this.input.style.height = `${Math.max(32, a)}px`);
      });
    }
    renderResult(t) {
      (this.outputCode &&
        ((this.outputCode.textContent = t.output || "\u2014"),
        (this.outputCode.title = t.output)),
        this.statusText &&
          ((this.statusText.className = "pset-math-status"),
          t.errors.length > 0
            ? ((this.statusText.textContent = "Needs manual entry"),
              this.statusText.classList.add("error"))
            : t.warnings.length > 0
              ? ((this.statusText.textContent = "Converted with a warning"),
                this.statusText.classList.add("warning"))
              : ((this.statusText.textContent = "Ready for MITx"),
                this.statusText.classList.add("ready"))));
      let i = (r, n) => {
        r &&
          (r.replaceChildren(...n.map((s) => R("li", void 0, s))),
          (r.hidden = n.length === 0));
      };
      (i(this.errorList, t.errors), i(this.warningList, t.warnings));
    }
    renderDetailsVisibility() {
      (this.detailsPanel && (this.detailsPanel.hidden = !this.detailsOpen),
        this.detailsMount &&
          ((this.detailsMount.hidden = !this.detailsOpen),
          this.detailsMount.classList.toggle("is-open", this.detailsOpen)),
        this.trigger.classList.toggle("is-open", this.detailsOpen),
        this.trigger.setAttribute(
          "aria-pressed",
          this.detailsOpen ? "true" : "false",
        ),
        (this.trigger.title = this.detailsOpen
          ? "Hide the full Psetter editor"
          : "Show the full Psetter editor"),
        this.trigger.setAttribute("aria-label", this.trigger.title));
    }
  };
  if (__PSETTER_DEV_BUILD__) {
    Mt.prototype.getQaSnapshot = function (t = {}) {
      let i = this.mathField?.latex?.() ?? "",
        r = this.getDraftValue(i),
        n = this.lastResult ?? {
          output: "",
          warnings: [],
          errors: [],
          isSupported: !0,
        };
      return {
        timestamp: new Date().toISOString(),
        page_url: location.href,
        input_id:
          this.input.id ||
          this.input.name ||
          this.input.getAttribute("aria-label") ||
          "",
        field_kind: this.kind,
        mode: this.mode,
        inline_enabled: this.inlineEnabled,
        details_open: this.detailsOpen,
        native_value: this.input.value,
        raw_latex: i,
        visible_psetter_text: r,
        mitx_output: n.output,
        warnings: [...n.warnings],
        errors: [...n.errors],
        status:
          n.errors.length > 0 ? "error" : n.warnings.length > 0 ? "warning" : "ready",
        ...t,
      };
    };
  }
  var PsetterQaHarness = __PSETTER_DEV_BUILD__ ? class {
    manager;
    logs = [];
    capturing = !1;
    running = !1;
    passCount = 0;
    failCount = 0;
    constructor(t) {
      this.manager = t;
    }
    get activeController() {
      return this.manager.activeController;
    }
    recordController(t, i = {}) {
      this.capturing && t && this.logs.push(t.getQaSnapshot({ source: "live", ...i }));
    }
    startCapture() {
      return (
        (this.logs = []),
        (this.passCount = 0),
        (this.failCount = 0),
        (this.capturing = !0),
        { ok: !0, message: "QA capture started.", entries: 0 }
      );
    }
    stopCapture() {
      return (
        (this.capturing = !1),
        {
          ok: !0,
          message: `QA capture stopped with ${this.logs.length} log entries.`,
          entries: this.logs.length,
        }
      );
    }
    exportLog() {
      if (this.logs.length === 0)
        return { ok: !1, message: "No QA log entries exist yet." };
      let t = new Blob([JSON.stringify(this.logs, null, 2)], {
          type: "application/json",
        }),
        i = URL.createObjectURL(t),
        r = document.createElement("a");
      return (
        (r.href = i),
        (r.download = `psetter-qa-${Date.now()}.json`),
        document.body.appendChild(r),
        r.click(),
        r.remove(),
        window.setTimeout(() => URL.revokeObjectURL(i), 0),
        {
          ok: !0,
          message: `Exported ${this.logs.length} QA entries to JSON.`,
          entries: this.logs.length,
        }
      );
    }
    async runScripted() {
      if (this.running)
        return { ok: !1, message: "Scripted QA is already running." };
      let t = this.activeController;
      if (!t)
        return {
          ok: !1,
          message: "Select an MITx answer box before running scripted QA.",
        };
      let i = this.capturing;
      ((this.running = !0),
        (this.logs = []),
        (this.passCount = 0),
        (this.failCount = 0),
        (this.capturing = !0));
      try {
        for (let r of qaTests) {
          await this.runTest(t, r);
          await qaWait(120);
        }
        return {
          ok: this.failCount === 0,
          message: `Scripted QA finished: ${this.passCount} passed, ${this.failCount} failed, ${qaTests.length} total, ${this.logs.length} logged steps.`,
          entries: this.logs.length,
          tests: qaTests.length,
          passed: this.passCount,
          failed: this.failCount,
        };
      } finally {
        ((this.running = !1), (this.capturing = i));
      }
    }
    evaluateExpectations(t, i) {
      let r = [];
      t.expected_output !== void 0 &&
        i.mitx_output !== t.expected_output &&
        r.push(
          `Expected MITx output "${t.expected_output}" but saw "${i.mitx_output}".`,
        );
      t.expected_status &&
        i.status !== t.expected_status &&
        r.push(`Expected status "${t.expected_status}" but saw "${i.status}".`);
      for (let n of t.expected_warning_substrings ?? [])
        i.warnings.some((s) => s.includes(n)) ||
          r.push(`Missing warning containing "${n}".`);
      for (let n of t.expected_error_substrings ?? [])
        i.errors.some((s) => s.toLowerCase().includes(n.toLowerCase())) ||
          r.push(`Missing error containing "${n}".`);
      return {
        pass: r.length === 0,
        failures: r,
      };
    }
    async runTest(t, i) {
      this.activeController !== t &&
        (this.manager.activeController?.deactivate(),
        (this.manager.activeController = t),
        t.activate());
      (t.inlineEnabled || t.enableInline(),
        t.renderControls(),
        t.setMode(i.mode),
        t.clearExpression(),
        this.logs.push(
          t.getQaSnapshot({
            source: "scripted",
            phase: "start",
            test_id: i.id,
            category: i.category,
            expression: i.expression,
            notes: i.notes,
            step_index: 0,
            typed_char: "",
          }),
        ),
        await qaWait(60));
      let r = 0;
      for (let n of i.expression) {
        (r += 1),
          t.typeCharacter(n),
          await qaWait(45),
          this.logs.push(
            t.getQaSnapshot({
              source: "scripted",
              phase: "step",
              test_id: i.id,
              category: i.category,
              expression: i.expression,
              notes: i.notes,
              step_index: r,
              typed_char: n,
            }),
          );
      }
      let n = t.getQaSnapshot({
          source: "scripted",
          phase: "complete",
          test_id: i.id,
          category: i.category,
          expression: i.expression,
          notes: i.notes,
          step_index: r,
          typed_char: "",
        }),
        s = this.evaluateExpectations(i, n);
      (s.pass ? this.passCount++ : this.failCount++,
        this.logs.push({
          ...n,
          expected_output: i.expected_output,
          expected_status: i.expected_status,
          expected_warning_substrings: i.expected_warning_substrings,
          expected_error_substrings: i.expected_error_substrings,
          qa_pass: s.pass,
          qa_failures: s.failures,
        }));
    }
  } : null;
  var Ai = class {
    settings;
    remoteConfig = PSETTER_REMOTE_API?.defaults ?? {
      disabled: !1,
      feedbackDisabled: !1,
      minimumSupportedVersion: null,
      compatibilityWarning: null,
      maintenanceMessage: null,
      developerMessage: null,
      features: { contextSymbols: !0, symbolSearch: !0 },
    };
    controllers = new Map();
    activeController;
    observer;
    scanQueued = !1;
    globalToggle;
    globalControls;
    developerMessageButton;
    developerMessagePanel;
    developerMessageReadId = null;
    globalNotice;
    feedbackOverlay;
    feedbackFrame;
    feedbackPreviousFocus;
    isTopWindow = window.top === window.self;
    started = !1;
    disposed = !1;
    intervalId;
    remoteConfigIntervalId;
    storageUnsubscribe = () => {};
    cleanupListeners = [];
    runtimeApi;
    runtimeMessageListener;
    listen(t, i, r, n) {
      t.addEventListener(i, r, n);
      this.cleanupListeners.push(() => t.removeEventListener(i, r, n));
    }
    isGlobalToggleTarget(t) {
      if (!t || (!this.globalToggle && !this.developerMessageButton)) return !1;
      try {
        return this.globalToggle?.contains(t) || this.developerMessageButton?.contains(t);
      } catch {
        return !1;
      }
    }
    isDeveloperMessageUnread() {
      return Boolean(
        PSETTER_REMOTE_API?.isDeveloperMessageUnread?.(
          this.remoteConfig.developerMessage,
          this.developerMessageReadId,
        ),
      );
    }
    openDeveloperMessage() {
      const message = this.remoteConfig.developerMessage;
      if (!message || !this.isDeveloperMessageUnread()) return !1;
      if (this.developerMessagePanel) {
        this.developerMessagePanel.querySelector(".pset-math-developer-message-close")?.focus();
        return !0;
      }
      const panel = R("section", "pset-math-developer-message-panel");
      const header = R("div", "pset-math-developer-message-header");
      const headerLogo = R("img", "pset-math-developer-message-header-logo");
      const headerLabel = R("strong", "pset-math-developer-message-header-label", "Notification");
      const close = Be("×", "pset-math-developer-message-close", "Dismiss developer message");
      const title = R("h2", "pset-math-developer-message-title", message.title);
      const text = R("p", "pset-math-developer-message-text", message.text);
      const signature = R("p", "pset-math-developer-message-signature", message.signature ?? "");
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Psetter developer message");
      headerLogo.src = getExtensionUrl("icons/psetter-px-logo-white.svg");
      headerLogo.alt = "P^x";
      signature.hidden = !message.signature;
      header.append(headerLogo, headerLabel, close);
      panel.append(header, title, text, signature);
      const dismissMessage = () => this.dismissDeveloperMessage();
      close.addEventListener("click", dismissMessage);
      panel.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          this.closeDeveloperMessage();
        }
      });
      this.developerMessagePanel = panel;
      (document.body ?? document.documentElement).appendChild(panel);
      close.focus();
      return !0;
    }
    async dismissDeveloperMessage() {
      const message = this.remoteConfig.developerMessage;
      if (!message || !PSETTER_REMOTE_API?.dismissDeveloperMessage) return !1;
      const saved = await PSETTER_REMOTE_API.dismissDeveloperMessage(message.id);
      if (!saved) return !1;
      this.developerMessageReadId = message.id;
      this.closeDeveloperMessage();
      this.renderDeveloperMessage();
      return !0;
    }
    closeDeveloperMessage() {
      this.developerMessagePanel?.remove();
      this.developerMessagePanel = void 0;
    }
    renderDeveloperMessage() {
      if (!this.developerMessageButton) return;
      const unread = this.isDeveloperMessageUnread();
      this.developerMessageButton.hidden = !unread;
      this.developerMessageButton.setAttribute("aria-hidden", unread ? "false" : "true");
      if (!unread) this.closeDeveloperMessage();
    }
    openFeedback() {
      if (this.remoteConfig.feedbackDisabled) return !1;
      if (!this.isTopWindow) {
        try {
          window.top.postMessage({ target: "psetter-open-feedback" }, "*");
          return !0;
        } catch {
          return !1;
        }
      }
      if (this.feedbackOverlay) {
        this.feedbackFrame?.focus();
        return !0;
      }
      let t = R("div", "pset-math-feedback-overlay"),
        i = R("div", "pset-math-feedback-dialog"),
        r = Be("×", "pset-math-feedback-close", "Close feedback form"),
        n = R("iframe", "pset-math-feedback-frame");
      i.setAttribute("role", "dialog");
      i.setAttribute("aria-modal", "true");
      i.setAttribute("aria-label", "Psetter feedback");
      n.setAttribute("title", "Psetter feedback form");
      n.setAttribute("referrerpolicy", "no-referrer");
      try {
        let s = new URL(getExtensionUrl("feedback-host.html"));
        s.searchParams.set(
          "version",
          getExtensionApi()?.runtime?.getManifest?.().version ?? "unknown",
        );
        n.src = s.href;
      } catch {
        return !1;
      }
      r.addEventListener("click", () => this.closeFeedback());
      t.addEventListener("pointerdown", (s) => {
        s.target === t && this.closeFeedback();
      });
      t.addEventListener("keydown", (s) => {
        if (s.key === "Escape") {
          s.preventDefault();
          this.closeFeedback();
        }
      });
      i.append(r, n);
      t.appendChild(i);
      this.feedbackPreviousFocus = document.activeElement;
      this.feedbackOverlay = t;
      this.feedbackFrame = n;
      document.documentElement.classList.add("pset-math-feedback-open");
      (document.body ?? document.documentElement).appendChild(t);
      r.focus();
      return !0;
    }
    closeFeedback(t = !0) {
      if (!this.feedbackOverlay) return;
      this.feedbackOverlay.remove();
      this.feedbackOverlay = void 0;
      this.feedbackFrame = void 0;
      document.documentElement.classList.remove("pset-math-feedback-open");
      let i = this.feedbackPreviousFocus;
      this.feedbackPreviousFocus = void 0;
      if (t && i?.isConnected && typeof i.focus === "function") i.focus();
    }
    controllerSettings() {
      return {
        ...this.settings,
        remoteFeatures: this.remoteConfig.features,
        feedbackDisabled: this.remoteConfig.feedbackDisabled,
      };
    }
    async start() {
      if (this.started || this.disposed) return;
      this.started = !0;
      [this.settings, this.remoteConfig, this.developerMessageReadId] = await Promise.all([
        _i(),
        PSETTER_REMOTE_API?.loadCached?.() ?? Promise.resolve(this.remoteConfig),
        PSETTER_REMOTE_API?.readDeveloperMessageReadId?.() ?? Promise.resolve(null),
      ]);
      if (this.disposed) return;
      this.mountGlobalToggle();
      this.mountGlobalNotice();
      this.applySettings();
      this.storageUnsubscribe = Pi((t) => {
        if (this.disposed) return;
        this.settings = t;
        this.applySettings();
      });
      try {
        const storage = getExtensionApi()?.storage;
        const readKey = PSETTER_REMOTE_API?.developerMessageReadKey;
        const remoteConfigKey = PSETTER_REMOTE_API?.remoteConfigKey;
        if (storage?.onChanged && readKey) {
          const onChanged = (changes, areaName) => {
            if (areaName !== "local" || !changes[readKey]) return;
            this.developerMessageReadId =
              PSETTER_REMOTE_API?.normalizeDeveloperMessageReadId?.(
                changes[readKey].newValue,
              ) ?? null;
            this.renderDeveloperMessage();
          };
          storage.onChanged.addListener(onChanged);
          this.cleanupListeners.push(() => storage.onChanged.removeListener(onChanged));
        }
        if (storage?.onChanged && remoteConfigKey) {
          const onRemoteConfigChanged = async (changes, areaName) => {
            if (areaName !== "local" || !changes[remoteConfigKey]) return;
            const nextConfig = await PSETTER_REMOTE_API?.loadCached?.();
            if (!this.disposed && nextConfig) this.applyRemoteConfig(nextConfig);
          };
          storage.onChanged.addListener(onRemoteConfigChanged);
          this.cleanupListeners.push(() => storage.onChanged.removeListener(onRemoteConfigChanged));
        }
      } catch {}
      this.observer = new MutationObserver(() => this.queueScan());
      this.observer.observe(document.documentElement, {
        childList: !0,
        subtree: !0,
      });
      this.listen(document, "focusin", (t) => {
        this.activeController &&
          !this.activeController.detailsOpen &&
          !this.isGlobalToggleTarget(t.target) &&
          !isPsetterDetailsEvent(t) &&
          !this.activeController.ownsEvent(t) &&
          (this.activeController.deactivate(),
          (this.activeController = void 0),
          this.renderGlobalToggle());
      });
      this.listen(document, "pointerdown", (t) => {
        if (
          this.developerMessagePanel &&
          !this.developerMessagePanel.contains(t.target) &&
          !this.developerMessageButton?.contains(t.target)
        ) {
          this.closeDeveloperMessage();
        }
        this.activeController &&
          !this.activeController.detailsOpen &&
          !this.isGlobalToggleTarget(t.target) &&
          !isPsetterDetailsEvent(t) &&
          !this.activeController.ownsEvent(t) &&
          (this.activeController.deactivate(),
          (this.activeController = void 0),
          this.renderGlobalToggle());
      });
      this.listen(window, "pageshow", () => this.queueScan());
      this.listen(document, "contentChanged", () => this.queueScan(), !0);
      this.listen(window, "message", (t) => {
        let i = t.data;
        if (!isAllowedPsetterMessageOrigin(t.origin)) return;
        i?.target === "psetter-open-feedback" && this.isTopWindow && this.openFeedback();
        if (i?.target === "psetter-remote-config-request" && t.source) {
          try {
            t.source.postMessage(
              { target: "psetter-remote-config-update", config: this.remoteConfig },
              { targetOrigin: t.origin },
            );
          } catch {}
        }
        i?.target === "psetter-remote-config-update" &&
          !this.isTopWindow &&
          i.config &&
          this.applyRemoteConfig(i.config);
      });
      this.listen(window, "message", (t) => {
        if (
          t.data?.target !== "psetter-feedback-close" ||
          t.source !== this.feedbackFrame?.contentWindow
        ) return;
        let i = "";
        try {
          i = new URL(getExtensionUrl("")).origin;
        } catch {}
        t.origin === i && this.closeFeedback();
      });
      this.intervalId = window.setInterval(() => this.reconcileSettings(), 1500);
      this.isTopWindow &&
        !psetterIsPackagedDemo &&
        (this.remoteConfigIntervalId = window.setInterval(
          () => this.refreshRemoteConfig(),
          5 * 60 * 1000,
        ));
      if (this.isTopWindow) {
        if (!psetterIsPackagedDemo) this.refreshRemoteConfig();
      } else {
        try {
          window.parent.postMessage({ target: "psetter-remote-config-request" }, "*");
        } catch {}
      }
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = !0;
      this.storageUnsubscribe?.();
      this.cleanupListeners.splice(0).forEach((t) => {
        try {
          t();
        } catch {}
      });
      this.observer?.disconnect();
      this.observer = void 0;
      this.intervalId && window.clearInterval(this.intervalId);
      this.intervalId = void 0;
      this.remoteConfigIntervalId && window.clearInterval(this.remoteConfigIntervalId);
      this.remoteConfigIntervalId = void 0;
      try {
        this.runtimeApi?.runtime?.onMessage?.removeListener?.(this.runtimeMessageListener);
      } catch {}
      this.runtimeMessageListener = void 0;
      this.runtimeApi = void 0;
      this.disposeAll();
      this.closeFeedback(!1);
      this.settings = void 0;
      this.closeDeveloperMessage();
      this.globalControls?.remove();
      this.globalControls = void 0;
      this.globalToggle = void 0;
      this.developerMessageButton = void 0;
      this.globalNotice?.remove();
      this.globalNotice = void 0;
      if (__PSETTER_DEV_BUILD__ && globalThis.__psetterQaHarness?.manager === this) {
        delete globalThis.__psetterQaHarness;
      }
      if (globalThis.__psetterRuntime === this) {
        delete globalThis.__psetterRuntime;
        document.documentElement.removeAttribute("data-pset-math-runtime");
      }
    }
    async reconcileSettings() {
      if (this.disposed) return;
      let t = await _i();
      if (!this.disposed && (!this.settings || !settingsEqual(this.settings, t))) {
        ((this.settings = t), this.applySettings());
      }
    }
    async refreshRemoteConfig() {
      if (this.disposed || !PSETTER_REMOTE_API?.load) return;
      let t = await PSETTER_REMOTE_API.load({ force: !0 });
      this.applyRemoteConfig(t);
    }
    applyRemoteConfig(t) {
      let r = PSETTER_REMOTE_API?.validate?.(t);
      if (!r || this.disposed) return;
      let n = JSON.stringify(r) !== JSON.stringify(this.remoteConfig);
      this.remoteConfig = r;
      this.remoteConfig.feedbackDisabled && this.closeFeedback();
      if (n) {
        this.disposeAll();
        this.applySettings();
      } else {
        this.renderGlobalToggle();
        this.renderGlobalNotice();
      }
    }
    mountGlobalToggle() {
      if (this.globalToggle || window.top !== window.self) return;
      let t = Be("", "pset-math-global-toggle", "Toggle Psetter on this page"),
        i = R("span", "pset-math-global-toggle-icon", "⏻"),
        r = R(
          "span",
          "pset-math-global-toggle-label",
          PSETTER_CONFIG.buildChannel === "dev" ? "Psetter Dev" : "Psetter",
        );
      (i.setAttribute("aria-hidden", "true"),
        t.append(i, r),
        t.addEventListener("pointerdown", (n) => {
          (n.preventDefault(), n.stopPropagation());
        }),
        t.addEventListener("pointerup", (n) => {
          (n.preventDefault(), n.stopPropagation(), this.toggleEnabled());
        }),
        t.addEventListener("click", (n) => {
          (n.preventDefault(), n.stopPropagation());
        }),
        t.addEventListener("keydown", (n) => {
          (n.key === "Enter" || n.key === " ") &&
            (n.preventDefault(), this.toggleEnabled());
        }),
        (this.globalToggle = t));
      const messageButton = Be("", "pset-math-developer-message-button", "Open developer message");
      const messageDot = R("span", "pset-math-developer-message-dot");
      messageDot.setAttribute("aria-hidden", "true");
      messageButton.appendChild(messageDot);
      messageButton.hidden = true;
      messageButton.addEventListener("pointerdown", (n) => {
        n.preventDefault();
        n.stopPropagation();
      });
      messageButton.addEventListener("click", (n) => {
        n.preventDefault();
        n.stopPropagation();
        this.openDeveloperMessage();
      });
      this.developerMessageButton = messageButton;
      this.globalControls = R("div", "pset-math-global-controls");
      this.globalControls.append(t, messageButton);
      (document.body ?? document.documentElement).appendChild(this.globalControls);
      this.renderDeveloperMessage();
    }
    mountGlobalNotice() {
      if (this.globalNotice || window.top !== window.self) return;
      this.globalNotice = R("div", "pset-math-remote-notice");
      this.globalNotice.setAttribute("role", "status");
      this.globalNotice.hidden = !0;
      (document.body ?? document.documentElement).appendChild(this.globalNotice);
      this.renderGlobalNotice();
    }
    renderGlobalNotice() {
      if (!this.globalNotice) return;
      let t = getExtensionApi()?.runtime?.getManifest?.().version ?? "0.0.0",
        i = PSETTER_REMOTE_API?.isVersionBelow?.(
          t,
          this.remoteConfig.minimumSupportedVersion,
        ),
        r = "";
      this.remoteConfig.disabled
        ? (r =
            this.remoteConfig.maintenanceMessage ||
            "Psetter is temporarily paused while a compatibility issue is resolved.")
        : i
          ? (r =
              this.remoteConfig.compatibilityWarning ||
              "Update Psetter for current MITx compatibility.")
          : this.remoteConfig.maintenanceMessage &&
            (r = this.remoteConfig.maintenanceMessage);
      this.globalNotice.textContent = r;
      this.globalNotice.hidden = !r;
      this.globalNotice.classList.toggle("is-error", this.remoteConfig.disabled);
      this.globalNotice.classList.toggle("is-warning", !!i && !this.remoteConfig.disabled);
    }
    renderGlobalToggle() {
      if (!this.globalToggle || !this.settings) return;
      let t = this.settings.enabled !== !1 && !this.remoteConfig.disabled;
      ((this.globalToggle.hidden = !1),
        this.globalToggle.classList.toggle("is-on", t),
        this.globalToggle.classList.toggle("is-off", !t),
        this.globalToggle.setAttribute("aria-pressed", t ? "true" : "false"),
        this.globalToggle.setAttribute(
          "aria-disabled",
          this.remoteConfig.disabled ? "true" : "false",
        ),
        this.globalToggle.setAttribute(
          "aria-label",
          this.remoteConfig.disabled
            ? "Psetter is temporarily paused"
            : t
              ? "Turn Psetter off"
              : "Turn Psetter on",
        ),
        (this.globalToggle.title = this.globalToggle.getAttribute("aria-label")));
      this.renderGlobalNotice();
      this.renderDeveloperMessage();
    }
    async toggleEnabled() {
      if (!this.settings || this.remoteConfig.disabled) return;
      let t = this.settings.enabled === !1;
      ((this.settings = { ...this.settings, enabled: t, inlineEnabledDefault: t }),
        this.applySettings(),
        // Persist first. A child frame polling storage must never overwrite a
        // just-received off message with the previous on value.
        await savePsetterSettings(this.settings));
    }
    applySettings() {
      if (this.settings) {
        this.renderGlobalToggle();
        if (!this.settings.enabled || this.remoteConfig.disabled) {
          (this.activeController?.deactivate(),
          (this.activeController = void 0)),
          this.disposeAll();
          return;
        }
        for (let [t, i] of this.controllers) {
          if (i.kind === "generic-text" && !this.settings.showGenericFields) {
            (i === this.activeController && (this.activeController = void 0),
              i.dispose(),
              this.controllers.delete(t));
            continue;
          }
          i.updateSettings(this.controllerSettings());
        }
        this.scan();
      }
    }
    queueScan() {
      if (this.disposed) return;
      this.scanQueued ||
        ((this.scanQueued = !0),
        window.requestAnimationFrame(() => {
          ((this.scanQueued = !1), this.scan());
        }));
    }
    scan() {
      if (!this.disposed && this.settings?.enabled && !this.remoteConfig.disabled) {
        for (let [t, i] of this.controllers)
          t.isConnected ||
            (i === this.activeController && (this.activeController = void 0),
            i.dispose(),
            this.controllers.delete(t));
        for (let t of $i(this.settings.showGenericFields)) {
          if (this.controllers.has(t.input)) continue;
          let i = new Mt(t.input, t.kind, this.controllerSettings(), {
            requestActivation: (r) => {
              if (
                !this.settings?.enabled ||
                this.remoteConfig.disabled ||
                r.settings?.enabled === !1 ||
                r.isActive
              )
                return;
              (this.activeController &&
                this.activeController !== r &&
                this.activeController.deactivate(),
                (this.activeController = r),
                r.activate(),
                this.renderGlobalToggle());
            },
            onModeSelected: (r) => {},
            onTermCombined: (r) => {
              recordSafeTermCombination(r);
            },
            onDetailsToggled: async (r) => {
              this.settings &&
                ((this.settings = { ...this.settings, openDetails: r }),
                await savePsetterSettings(this.settings));
            },
            onFeedbackRequested: () => this.openFeedback(),
            onControllerStateChanged: () => {
              this.renderGlobalToggle();
            },
          });
          (this.controllers.set(t.input, i),
            document.activeElement === t.input &&
              ((this.activeController = i), i.activate(), this.renderGlobalToggle()));
        }
      }
    }
    disposeAll() {
      ((this.activeController = void 0),
        this.controllers.forEach((t) => t.dispose()),
        this.controllers.clear());
    }
  };
  (() => {
    globalThis.__psetterRuntime?.dispose?.();
    let e = new Ai();
    let i = (r, n, s) => {
      if (r?.target === "psetter-open-feedback") {
        s({ ok: e.openFeedback() });
        return;
      }
      if (r?.target === "psetter-settings-update" && r.settings) {
        ((e.settings = zi(r.settings)), e.applySettings());
        s({ ok: !0 });
      }
    };
    if (__PSETTER_DEV_BUILD__) {
      const t = new PsetterQaHarness(e);
      const r = i;
      i = (n, s, o) => {
        if (n?.target !== "psetter-qa") return r(n, s, o);
        let a = async () => {
          switch (n.command) {
            case "start-capture":
              return t.startCapture();
            case "stop-capture":
              return t.stopCapture();
            case "run-scripted":
              return t.runScripted();
            case "export-log":
              return t.exportLog();
            default:
              return { ok: !1, message: `Unknown QA command: ${n.command}` };
          }
        };
        return (
          a().then(
            o,
            (l) =>
              o({
                ok: !1,
                message: l instanceof Error ? l.message : String(l),
              }),
          ),
          !0
        );
      };
      globalThis.__psetterQaHarness = t;
    }
    e.runtimeMessageListener = i;
    try {
      e.runtimeApi = getExtensionApi();
      e.runtimeApi?.runtime?.onMessage?.addListener(i);
    } catch {}
    globalThis.__psetterRuntime = e;
    document.documentElement.dataset.psetterBuildChannel =
      PSETTER_CONFIG.buildChannel === "dev" ? "dev" : "production";
    document.documentElement.dataset.psetMathRuntime = "true";
    e.start().catch((r) => {
      isContextInvalidatedError(r) ||
        console.error("Psetter failed to initialize.", r);
    });
  })();
})();
