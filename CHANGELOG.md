# Changelog

## 0.1.4 (Unreleased)

- Kept incomplete typing silent and reused the reset comment box above the answer after typing stops.
- Underlined the native-input action, scoped it to one answer submission, and fixed the logo URL in the browser demo.
- Fixed outside-click dismissal with the full editor open and made notification progress text pure white.

- Fixed notification requests blocked by the Store popup page policy.

- Separated draft, syntax, unsupported-notation, ambiguity, and runtime recovery states.
- Added visible sync notices and a per-field native entry option.
- Preserved unfinished drafts across editor toggles and released fields after runtime faults.

- Kept normal Store builds unpacked and isolated packaging tests from local builds.
- Moved temporary ZIPs to dist/staging and versioned release files to dist/releases.

- Fixed parentheses during typing and activation of existing answers.
- Preserved nested addition, multiplication, and exponent grouping during activation.
- Preserved explicitly declared names such as dt, dx, and Deltat across answer fields.
- Added reproducible generated interaction tests and native fallback checks.
- Added a notification bell with an unread count and notification navigation.
- Separated notification minimization from explicit dismissal.
- Fixed queued notification cache loading after extension startup.

## 0.1.3

- Added explicit Chrome and Firefox build targets with disjoint package,
  candidate-attestation, and release-record names.
- Store packaging now renders the target-specific manifest in one place,
  preserving the private overlay permissions and web-accessible feedback host
  for both browser targets.
- Store ZIP validation now checks the target-specific background configuration,
  while build provenance and reproducibility checks include the browser target
  so artifacts cannot be crossed or misidentified.

## 0.1.2

- Fixed Store packaging so the feedback and remote-configuration overlay is
  embedded in the MITx content script, not only extension pages. Store
  boundary checks now fail if that content bundle is not feedback-enabled.
- Fixed the Store feedback host so the hosted form is shown immediately and
  the loading status hides reliably instead of waiting indefinitely on a
  cross-origin iframe load event.
- Routed Store feedback popup creation through the extension background API so
  MITx pages do not attempt cross-origin popup navigation.
- Hardened Store feedback acknowledgments and close routing across service
  worker suspension, and added an explicit hosted-form readiness handshake.
- Refined the editor footer with a light-weight version label and a single,
  right-aligned Feedback action.

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
