# Changelog

## 0.1.1

- Added explicit community and Store release channels with ignored candidate
  attestations, deterministic build identities, runtime provenance, and a
  final SHA-256 equality check. Store packaging fails closed until its reviewed
  private overlay is supplied.
- Refined the editor and popup UI with clearer visual hierarchy, improved
  controls and feedback states, updated branding and version display, and more
  consistent styling across the extension.
- Distinguished MITx numeric metric affixes from explicit multiplication in
  conversion, hydration, and semantic round-trip verification. Native metric
  atoms retain explicit editor provenance, while visually authored adjacency
  remains multiplication and question-defined variables take priority.
- Prevented fresh `G` and Greek input from being reinterpreted as generic
  symbolic-engine built-ins.
- Added explicit MITx mappings for documented Greek variants and improved
  question-side discovery of adjacent and structural identifiers. Known
  MathML function names are no longer promoted to problem-defined aliases;
  when application structure is present, they are classified as functions.
  Generic palette labels match the documented variant glyphs. Context
  visibility filtering remains bounded; computed hidden-ancestor detection is
  a low-priority context-discovery edge case.
- Kept incomplete function names in draft state and expanded verified MITx
  function coverage.
- Restricted cross-frame state messages to the expected parent/child window
  direction.
- Verified the factorial boundary: postfix `!` serializes as `factorial(...)`;
  freshly typed named `fact(...)`/`factorial(...)` remains unclaimed unless
  native or question context establishes that function.
- Hardened runtime ownership, lifecycle cleanup, native-answer hydration,
  numeric lexical preservation, and the community/private package boundary.

## 0.1.0

- Prepared a local-only, reproducible Manifest V3 release workflow.
- Added a visually distinct unpacked `Psetter Dev` build.
- Kept all parsing and conversion logic in the extension.
- Added strict, fixed-schema remote configuration for predefined flags and
  operational notices only.
- Moved the proprietary hosted feedback page and backend into private
  infrastructure.
- Restored the in-tab feedback dialog using an isolated packaged host frame and
  narrowly framed proprietary form.
- Added a hosted feedback-page fallback when Feedback is opened outside MITx.
- Added MIT licensing with an explicit Psetter branding exclusion.
