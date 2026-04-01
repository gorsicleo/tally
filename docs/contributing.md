# Contributing to Tally

Thanks for contributing.

This guide covers practical contributor workflow for this repository.

For codebase context, see [docs/architecture.md](./architecture.md), [docs/data-model.md](./data-model.md), and [docs/testing.md](./testing.md).

## Local setup

1. Fork and clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Start the dev server:

```bash
npm run dev
```

4. Open the app in the URL shown by Vite.

## Common scripts

Defined in [package.json](../package.json):

- npm run dev: Start local development server.
- npm run build: Type-check and build production assets.
- npm run lint: Run ESLint.
- npm run changeset: Create a release note + semver change entry.
- npm run changeset:status: Inspect release status from current branch.
- npm run changeset:version: Apply version/changelog updates from pending changesets.
- npm run test: Run unit and component tests (Vitest).
- npm run test:watch: Run Vitest in watch mode.
- npm run test:coverage: Run Vitest with coverage.
- npm run test:e2e: Run Playwright e2e tests (non-visual).
- npm run test:visual: Run Playwright visual regression tests.
- npm run test:visual:update: Update visual snapshots intentionally.

## Issues

Use the issue templates in [/.github/ISSUE_TEMPLATE](../.github/ISSUE_TEMPLATE):

- Bug report
- Feature request
- Refactor / tech debt

Issue templates request clear goals, scope, tasks, and acceptance criteria. Blank issues are disabled in [/.github/ISSUE_TEMPLATE/config.yml](../.github/ISSUE_TEMPLATE/config.yml).

## Pull requests

Use [/.github/pull_request_template.md](../.github/pull_request_template.md) and fill all relevant sections:

- Summary and related issue
- Type of change
- What changed
- Testing performed
- Checklist items

Keep PRs scoped. Avoid bundling unrelated refactors with behavior changes.

### Release notes and versioning

For user-visible or behavior-changing work, include a `.changeset/*.md` entry in the PR.

Create one with:

```bash
npm run changeset
```

Start each summary with a severity marker used by update UX automation:

- `[severity:minor]`
- `[severity:recommended-backup]`
- `[severity:backup-required]`

See [docs/versioning.md](./versioning.md) for full workflow.

## Testing expectations

CI in [/.github/workflows/ci.yml](../.github/workflows/ci.yml) runs:

0. Changeset Required (pull requests)
1. Lint
2. Unit/component tests
3. Playwright e2e
4. Playwright visual regression

Before opening or updating a PR, run the tests that match your changes.

When targeted tests are expected:

- State invariants or reducer logic changes.
- Data model, parsing, migration, or restore changes.
- Recurring scheduling/processing changes.
- Persistence behavior changes.
- Financial totals/selector changes used by Home, Insights, or Budgets.
- Cross-screen UI flow changes.

See [docs/testing.md](./testing.md) for module-level testing guidance.

## Review focus for this repo

PR review guidance in [/.github/copilot-instructions.md](../.github/copilot-instructions.md) prioritizes:

- Regression prevention and data correctness.
- State invariants and cross-entity consistency.
- Migration/restore and persistence safety.
- Financial totals correctness.
- Targeted tests for high-risk changes.

## Documentation updates

Update docs in the same PR when behavior or contributor workflow changes.

Typical triggers:

- New or changed scripts, CI checks, or test workflow.
- Changes to state invariants or model relationships.
- Changes to backup/restore or persistence behavior.
- New contributor-facing conventions.

## Scope and quality expectations

- Keep changes focused and easy to review.
- Preserve existing behavior unless the issue or PR scope explicitly changes it.
- Prefer small, targeted tests over broad rewrites.
- Call out uncertainties directly in PR notes when behavior is ambiguous.
