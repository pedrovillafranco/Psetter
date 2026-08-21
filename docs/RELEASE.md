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
        psetter-v<version>-community.zip
                  |
                  v
        community distribution artifact
```

The Git tag and commit identify the source state. GitHub-generated source
archives are source snapshots created by GitHub and are not build inputs or
Chrome extension packages. The community ZIP is built directly from the
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
```

The reproducibility check builds the community package twice and compares the
SHA-256 digests. The resulting file is:

```text
dist/psetter-v<version>-community.zip
```

The public source includes the workspace manifests, dependency lockfile,
extension package metadata, build scripts, authored source, tests, and
bundled third-party notices required to inspect and reproduce this build.

## Record a final release

After the release candidate has been reviewed and the unchanged artifact is
approved, create the final version tag on the same commit. The versioned
candidate attestation is generated under `dist/`, which is ignored and must not
dirty the public worktree:

```sh
pnpm release:candidate:community
git tag -a v<version> -m "Psetter <version>"
pnpm release:prepare:community
```

The final command requires an explicit channel, the exact version tag on
`HEAD`, and a clean worktree. It runs syntax and manifest checks, the complete
test suite, and the reproducibility check. It then independently recomputes
the build identity and fails if the final artifact differs from the
smoke-tested candidate. The release record is written to:

```text
dist/psetter-v<version>-community.release.json
```

The record separates build identity (version, channel, public commit, artifact,
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
