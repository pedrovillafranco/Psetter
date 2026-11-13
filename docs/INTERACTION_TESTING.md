# Interaction regression workflow

See [ERROR_MODEL.md](ERROR_MODEL.md) for the error classes and recovery rules.

Psetter does not know every MITx grader. Tests must distinguish editor behavior
from acceptance by a question's grader. A safe local conversion is not proof
that a particular grader accepts an answer.

## Run the interaction checks

Use the repository-pinned pnpm version:

```sh
corepack pnpm test:interactions
```

The tests use the bundled MathQuill editor in a local DOM. They exercise real
typing, native answer hydration, conversion, answer events, and editor teardown.
They do not submit coursework or require an AI service.

The generated expression test uses a fixed seed and a bounded grammar. Each
failure reports its seed, iteration, source, and relevant output. Replay another
seed with:

```sh
PSETTER_INTERACTION_SEED=12345 corepack pnpm test:interactions
```

The automatic checks require the following:

- Supported completed expressions preserve the expected native parse tree.
- Activation and deactivation do not rewrite an unchanged answer or emit answer events.
- A completed expression remains editable after the editor is reopened.
- Each native write emits the expected input, change, and keyup events.
- Page callbacks during those events keep the active editor and insertion point.
- Runtime recovery retains the last visual draft if its source getter fails.
- Unsupported or ambiguous notation does not overwrite the native answer.
- Unsupported existing syntax leaves the native field editable and keyboard events available.
- Declared names stay atomic. Explicit multiplication stays multiplication.
- Question context stays inside its problem and excludes hidden instructions.

The native parse-tree comparison covers Psetter's supported grammar. It is not
an independent implementation of MITx grading. These DOM tests also do not
verify browser rendering, real focus behavior, IME input, or touch interaction.

## Turn a reported failure into a regression

1. Reproduce the failure in a local fixture with invented symbols and values.
2. Record the action sequence: initial native value, activation, typing, cursor
   movement, and any off/on cycle.
3. Specify the expected native value or parse tree. If grader semantics are
   unknown, require preservation and native fallback instead of a guessed conversion.
4. Add a failing regression. Fix the smallest relevant interaction or conversion path.
5. Run the interaction checks, rebuild with `corepack pnpm extension:build`,
   and run `corepack pnpm extension:check`.
6. Check the final behavior in a real browser before Store submission.

For manual browser checks, verify the rendered expression and underlying native
value before and after activation, editing, and turning Psetter off and on.
Use a local fixture first. Do not submit or save test answers on real coursework.

## Resolve names from evidence

Use explicit question declarations, structured math tokens, and existing native
identifiers as evidence. Preserve case. For example, a variable list can declare
`dt` as one name, while `d*t` must remain an explicit product. Do not globally
replace every `dt`, `dx`, or adjacent pair of letters with one interpretation.

Use invented fixtures for committed tests. Keep coursework answers, private
correspondence, credentials, and page exports out of the repository. AI review
can help investigate a reduced fixture, but it must not replace deterministic
checks or decide whether a live grader accepts an answer.
