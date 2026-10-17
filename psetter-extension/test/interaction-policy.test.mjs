import assert from "node:assert/strict";
import test from "node:test";
import { psetterInteractionFeedback } from "../src/interaction-policy.js";

test("drafts, invalid syntax, ambiguous meaning, unsupported notation, and runtime faults have separate recovery states", () => {
  const cases = [
    [{ status: "safe" }, "x+1", "ready", true],
    [{ status: "unsupported", issueKind: "syntax" }, "x+", "incomplete", false],
    [{ status: "ambiguous", issueKind: "incomplete" }, String.raw`\sin`, "incomplete", false],
    [{ status: "unsupported", issueKind: "syntax" }, String.raw`\frac{x}{}`, "incomplete", false],
    [{ status: "unsupported", issueKind: "syntax" }, "x+*y", "syntax", false],
    [{ status: "ambiguous", issueKind: "unsupported" }, String.raw`\sum{x}+`, "unsupported", false],
    [{ status: "ambiguous" }, "foo(x)", "ambiguous", false],
    [{ status: "unsupported", issueKind: "native-syntax" }, "", "native-syntax", false],
    [{ status: "runtime-error", issueKind: "runtime" }, "x+", "runtime", false],
  ];
  for (const [result, source, kind, canCommit] of cases) {
    const feedback = psetterInteractionFeedback(result, source);
    assert.equal(feedback.kind, kind, source);
    assert.equal(feedback.canCommit, canCommit, source);
  }
});
