# Psetter™

Psetter is a Chrome extension for MITx that adds a visual math editor directly
to compatible answer fields. Instead of translating mathematical expressions
into MITx syntax by hand, you can build them visually and let Psetter convert
them into the input format MITx expects.

Fractions, roots, exponents, functions, symbols, and complex expressions can be
entered as they look, making math input faster and more intuitive. Parsing and
conversion happen locally in your browser.

This repository contains the complete source code for the Psetter browser
extension, including its build scripts and tests. Original Psetter code is licensed under
the MIT License. Bundled third-party components remain under their respective
licenses; see
[`psetter-extension/THIRD_PARTY_NOTICES.txt`](psetter-extension/THIRD_PARTY_NOTICES.txt).
The Psetter name, logos, icons, and other brand identifiers are not licensed
under the MIT License; see
[`TRADEMARKS.md`](TRADEMARKS.md).

Psetter is not affiliated with or endorsed by MIT or MITx.

The hosted feedback page and its supporting infrastructure are maintained
separately and are not required to build, test, or inspect the extension.

The public tree also includes the workspace manifests and dependency lockfile,
extension package metadata, build scripts, authored source, and tests needed
to reproduce and inspect the extension.

## Privacy and architecture

- Parsing and math conversion run locally. Answer content is never sent to a
  Psetter server.
- Settings and aggregate usage counts are stored locally with Chrome storage.
- An optional, size-limited JSON configuration provides only predefined
  feature flags, compatibility and maintenance messages, minimum-version
  warnings, and emergency disable flags.
- Remote parser rules, regular expressions, commands, JavaScript, WebAssembly,
  templates, and other interpreted logic are rejected and unsupported.
- Feedback infrastructure is intentionally absent from the community build.
  The separate store distribution may enable its hosted feedback flow; the
  editor remains fully local when that infrastructure is unavailable.

See [`docs/REMOTE_CONFIG.md`](docs/REMOTE_CONFIG.md) for the exact remote-data
boundary.

## Development

Requirements: Node.js 22 or later and pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm extension:check
pnpm extension:package:dev
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**,
and select `dist/psetter-dev`. This build is named **Psetter Dev** and uses a
purple development treatment so it is easy to distinguish from production.

To test the complete local editor without an MITx account, open the toolbar
popup, expand Settings, and select **Try Psetter locally**. The packaged demo
uses the same editor, parser, and conversion runtime as the MITx integration.
It does not broaden automatic page access beyond the MITx hosts declared in the
manifest.

Edit `psetter-extension/src/content-runtime.js`, not the generated
`psetter-extension/content.js`. Re-run the development packaging command and
reload the unpacked extension after changes.

## Production build

```sh
pnpm install --frozen-lockfile
pnpm extension:check
pnpm extension:reproducible:community
```

The community archive is written to `dist/psetter-v<version>-community.zip`.
The ZIP is created from an explicit allowlist with stable file ordering,
timestamps, and permissions. The reproducibility check builds it twice and
compares SHA-256 digests. Store packaging is a separate channel and currently
fails closed until its reviewed Store overlay is supplied.

Final community release preparation additionally requires a clean Git worktree,
an explicit channel, and an exact `v<manifest-version>` tag on `HEAD`:

```sh
pnpm release:candidate:community
pnpm release:prepare:community
```

The candidate command writes an ignored, generated attestation under `dist/`.
The final command reproduces the tagged artifact and fails unless its build
identity and SHA-256 match that candidate. It writes a release record but does
not publish or upload anything. Bare `release:prepare` is intentionally invalid;
choose `:community` or `:store` explicitly. See [`docs/RELEASE.md`](docs/RELEASE.md)
for the public build and release provenance procedure.

## Repository layout

- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`: workspace and
  dependency metadata
- `psetter-extension/src/`: authored source used to generate `content.js`
- `psetter-extension/test/`: local tests
- `psetter-extension/scripts/`: build, package, and release checks
- `psetter-extension/vendor/`: bundled third-party dependencies and licenses
- `docs/`: public architecture and release documentation

Contributions to original Psetter code are accepted under the MIT License.
Forks that are distributed to others must use their own branding as described in
[`TRADEMARKS.md`](TRADEMARKS.md).
