# Versioning and Release Automation

Tally uses **Changesets** for human-authored changelog entries and automated version bumps.

## Goals

- Keep release notes authored by humans in PRs.
- Automate version bumping and changelog aggregation.
- Keep update dialog metadata consistent with each release.

## Contributor workflow

1. Implement your change in a feature branch.
2. Add a changeset:

```bash
npm run changeset
```

3. Select package `tally` and choose semver impact:

- `patch` for fixes/small changes
- `minor` for backward-compatible features
- `major` for breaking changes

4. Start your summary with a severity marker:

- `[severity:minor]`
- `[severity:recommended-backup]`
- `[severity:backup-required]`

Example:

```md
[severity:recommended-backup] Improves backup compatibility for older exported files.
```

5. Commit the generated `.changeset/*.md` file in your PR.

## CI enforcement

PRs to `main` run a changeset gate in [/.github/workflows/ci.yml](../.github/workflows/ci.yml).

- If a PR changes app code and has no `.changeset/*.md` entry, CI fails.
- Docs-only and repo-meta-only changes can pass without a changeset.

## Automated release PRs

[/.github/workflows/release.yml](../.github/workflows/release.yml) runs on pushes to `main`.

It uses `changesets/action` to:

- create or update a release PR (`chore: release`)
- bump `package.json` version
- update `CHANGELOG.md`

When you merge that release PR:

- the repo version is updated
- changelog is updated
- your deployment pipeline can publish the new build

## How update dialog metadata is derived

Build-time metadata in [vite.config.ts](../vite.config.ts) is resolved in this order:

1. `VITE_APP_VERSION` / `VITE_APP_CHANGELOG` / `VITE_APP_UPDATE_SEVERITY` env overrides
2. Otherwise, latest `CHANGELOG.md` release entries (first 3 bullet items)
3. Otherwise, default fallback changelog text

Severity is determined from markers in release notes and defaults to `recommended-backup` when missing/invalid.

## Manual override (optional)

You can still override release metadata in CI for emergency releases:

```bash
VITE_APP_VERSION="1.4.2" \
VITE_APP_CHANGELOG="Fix A|Fix B|Fix C" \
VITE_APP_UPDATE_SEVERITY="backup-required" \
npm run build
```

## Maintainer steps in GitHub

1. Ensure branch protection requires these checks:
   - `CI / Changeset Required`
   - `CI / Lint`
   - `CI / Unit and Component Tests`
   - `CI / E2E Tests (Playwright)`
   - `CI / Visual Regression (Playwright)`
2. Ensure workflow permissions allow `contents: write` and `pull-requests: write` for release automation.
3. Merge feature PRs with changesets.
4. Merge the generated `chore: release` PR when ready to ship.
