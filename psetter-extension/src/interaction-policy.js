// Conversion validity and input ownership are separate decisions.
export function psetterInteractionFeedback(result, latex = "") {
  if (result.status === "safe") return { kind: "ready", message: "", canCommit: true };
  const kind = result.issueKind ?? (result.status === "ambiguous" ? "ambiguous" :
    result.status === "parse-error" ? "syntax" : "unsupported");
  const incomplete = kind === "incomplete" ||
    (kind === "syntax" || !result.issueKind && kind === "unsupported") && (
      /(?:[+\-*/^_=<>]|\\(?:cdot|times))\s*$/.test(latex) ||
      /(?:[_^]|\\sqrt)\s*\{\s*\}/.test(latex) ||
      /\\frac\s*\{[^{}]*\}\s*\{\s*\}/.test(latex) ||
      /\\frac\s*\{\s*\}/.test(latex) ||
      /(?:\\left\s*)?\(\s*(?:\\right\s*)?\)/.test(latex)
    );
  if (incomplete) return { kind: "incomplete", canCommit: false,
    message: "Finish this expression. MITx still has the last synced answer." };
  const messages = {
    syntax: "Check this expression. Changes have not been sent to MITx.",
    unsupported: "Psetter cannot convert this notation. Changes are not synced to MITx.",
    ambiguous: "Psetter cannot determine this expression's meaning. Changes are not synced to MITx.",
    "native-syntax": "Psetter cannot safely open this answer. Continue in the MITx input.",
    runtime: "Psetter encountered an internal error. The MITx input is available.",
  };
  return { kind, canCommit: false, message: messages[kind] ?? messages.unsupported };
}
