# Release and build provenance

This document explains how a public source tag relates to a production Psetter
browser extension artifact.

## Distinct source and build artifacts

A release has two branches from the same tagged source state:

```text
Git tag and commit
        |
        +--> GitHub-generated source archive
        |
        +--> reproducible build
                  |
                  v
        dist/staging/psetter-v<version>-community.zip       (Chrome)
        dist/staging/psetter-v<version>-firefox-community.zip (Firefox)
                  |
                  v
        community distribution artifact (Chrome or Firefox)
```

The Git tag and commit identify the source state. GitHub-generated source
archives are source snapshots created by GitHub and are not build inputs or
browser extension packages. The community ZIP is built directly from the
tagged source and contains no store-hosted feedback or remote-configuration
infrastructure. The separate store build consumes the existing private
infrastructure independently.

## Reproduce the production build

Requirements: Node.js 22 or later and pnpm 11.

From a clean tagged checkout, run:

```sh
pnpm install --frozen-lockfile
pnpm extension:check
pnpm extension:reproducible:community
pnpm extension:reproducible:firefox
```

Each reproducibility check builds its browser-specific community package twice
and compares the SHA-256 digests. It writes replaceable ZIPs under
`dist/staging/`:

```text
dist/staging/psetter-v<version>-community.zip
dist/staging/psetter-v<version>-firefox-community.zip
```

Store builds use the same browser target commands with a reviewed private
overlay supplied through `--store-overlay`; the overlay is never committed to
this repository.

The public source includes the workspace manifests, dependency lockfile,
extension package metadata, build scripts, authored source, tests, and
bundled third-party notices required to inspect and reproduce this build.

## Local Store builds and staging

Normal Store build commands update stable unpacked directories:

```text
dist/psetter-store/          # Chrome and Edge
dist/psetter-firefox-store/  # Firefox
```

These commands do not create a ZIP. Store content compilation uses a temporary
directory that is removed after success or failure.

Reproducibility checks build twice in a temporary directory. They copy the
verified ZIP to `dist/staging/` after the hashes match. They do not replace the
unpacked Store directories. Tests use fixture overlays and temporary output
directories, so they cannot replace a local build with a test configuration.

The packaging script accepts `--output-dir <directory>` for isolated builds.
When this option is present, it writes both the unpacked package and ZIP inside
that directory. Store packaging still requires the reviewed overlay.

## Record a final release

After the release candidate has been reviewed and the unchanged artifact is
approved, create the final version tag on the same commit. The versioned
candidate and release files are grouped by version under `dist/releases/`, which
is ignored and must not dirty the public worktree:

```sh
pnpm release:candidate:community
git tag -a v<version> -m "Psetter <version>"
pnpm release:prepare:community
```

Use the `:firefox` command variants to validate and record the Firefox artifact.

The final command requires an explicit channel, the exact version tag on
`HEAD`, and a clean worktree. It runs syntax and manifest checks, the complete
test suite, and the reproducibility check. It then independently recomputes
the build identity and fails if the final artifact differs from the
smoke-tested candidate. The artifacts and provenance records are kept together
at:

```text
dist/releases/v<version>/psetter-v<version>-community.zip
dist/releases/v<version>/psetter-v<version>-community.candidate.json
dist/releases/v<version>/psetter-v<version>-community.release.json
dist/releases/v<version>/psetter-v<version>-firefox-community.zip
dist/releases/v<version>/psetter-v<version>-firefox-community.candidate.json
dist/releases/v<version>/psetter-v<version>-firefox-community.release.json
```

The record separates build identity (version, channel, browser, public commit, artifact,
SHA-256, and deterministic packaging inputs) from runtime attestation. Store
records additionally require the private overlay commit and runtime fields for
the Worker deployment and remote configuration observed during smoke testing.
The current public repository does not contain the reviewed Store overlay, so
`pnpm release:candidate:store`, `pnpm extension:package:store`, and
`pnpm release:prepare:store` fail closed until those private inputs are
provided through the approved Store build process.

Bare `pnpm release:prepare` is intentionally invalid; always select the
release channel explicitly. No release command publishes or uploads anything.

GitHub source archives are not expected to have the same bytes or hash as the
production ZIP.

An initial public repository is created from an exported source snapshot in
a new Git repository. Earlier private development commits are not part of
the public history.
