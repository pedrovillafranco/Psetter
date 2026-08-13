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
        psetter-v<version>.zip
                  |
                  v
        Chrome Web Store submission
```

The Git tag and commit identify the source state. GitHub-generated source
archives are source snapshots created by GitHub and are not build inputs or
Chrome extension packages. The production ZIP is built directly from the
tagged source and is the artifact submitted to the Chrome Web Store.

## Reproduce the production build

Requirements: Node.js 22 or later and pnpm 11.

From a clean tagged checkout, run:

```sh
pnpm install --frozen-lockfile
pnpm extension:check
pnpm extension:reproducible
```

The reproducibility check builds the production package twice and compares
the SHA-256 digests. The resulting file is:

```text
dist/psetter-v<version>.zip
```

The public source includes the workspace manifests, dependency lockfile,
extension package metadata, build scripts, authored source, tests, and
bundled third-party notices required to inspect and reproduce this build.

## Record a final release

After the release candidate has been reviewed and the unchanged artifact is
approved, create the final version tag on the same commit:

```sh
git tag -a v<version> -m "Psetter <version>"
pnpm release:prepare
```

The command runs syntax and manifest checks, the complete test suite, and the
reproducibility check. It then verifies that the worktree remains clean and
writes:

```text
dist/psetter-v<version>.release.json
```

The release record identifies the version, Git tag, Git commit, production
ZIP filename, and SHA-256 digest of the production ZIP. Attach the production
ZIP and this release record to the GitHub release for the final tag.

GitHub source archives are not expected to have the same bytes or hash as the
production ZIP.

An initial public repository is created from an exported source snapshot in
a new Git repository. Earlier private development commits are not part of
the public history.
