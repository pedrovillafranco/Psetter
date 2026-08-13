# Contributing

Issues and pull requests are welcome. No Contributor License Agreement is
required. Contributions to original Psetter code are provided under the MIT License.

Before opening a pull request:

1. Install dependencies with `pnpm install --frozen-lockfile`.
2. For content-script changes, edit the authored files under
   `psetter-extension/src/`; do not hand-edit the generated
   `psetter-extension/content.js` bundle.
3. Run `pnpm extension:check`.
4. Run `pnpm extension:reproducible` for build or packaging changes.
5. Do not add analytics, remote code, answer-content transmission, secrets, or
   additional permissions without an explicit architecture and privacy review.

Distributed forks must be rebranded according to [`TRADEMARKS.md`](TRADEMARKS.md).

Please keep comments and documentation focused on the code, its behavior, and
publicly reviewable design decisions. Do not include private correspondence,
credentials, real coursework answers, or personal information.
