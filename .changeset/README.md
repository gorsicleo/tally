# Changesets Workflow

This folder stores release note fragments used by Changesets.

## Why this exists

- Contributors write release notes in PRs.
- Version bumping and changelog aggregation are automated.
- The app update dialog metadata can be derived from release notes.

## Create a changeset

Run:

```bash
npm run changeset
```

Follow the prompt:

- Select `tally`
- Choose semver impact (`patch`, `minor`, `major`)
- Write a user-facing summary

## Severity marker (required for update UX)

Start the summary with one marker:

- `[severity:minor]`
- `[severity:recommended-backup]`
- `[severity:backup-required]`

Example:

```md
[severity:recommended-backup] Improves restore compatibility for older backups.
```

The marker is parsed during build to determine update severity. It is removed from the in-app update changelog display.
