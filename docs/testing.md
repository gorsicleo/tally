# Testing Guide

This document explains the current automated test setup and how to use it when making changes.

For architecture and module boundaries, see [docs/architecture.md](./architecture.md).
For contributor workflow expectations, see [docs/contributing.md](./contributing.md).

## Test Stack

### Unit and Integration (Vitest + RTL)

- Runner and config: [vite.config.ts](../vite.config.ts)
- Environment: `jsdom`
- Setup file: [src/test/setup-tests.ts](../src/test/setup-tests.ts)
- Includes: `src/**/*.{test,spec}.{ts,tsx}`
- Excludes: `e2e/**`

`setup-tests.ts` also installs compatibility shims used by app code (for example `matchMedia`, animation frame APIs, and pointer capture APIs).

### End-to-End and Visual (Playwright)

- Runner config: [playwright.config.ts](../playwright.config.ts)
- Non-visual e2e suite: [e2e/app.e2e.spec.ts](../e2e/app.e2e.spec.ts)
- Visual snapshot suite: [e2e/visual.spec.ts](../e2e/visual.spec.ts)
- Visual baselines: [e2e/visual.spec.ts-snapshots](../e2e/visual.spec.ts-snapshots)

Playwright uses a dev server started from `npm run dev` and targets Chromium by default.

## Running Tests Locally

From repository root:

```bash
npm run test
npm run test:watch
npm run test:coverage
npm run test:e2e
npm run test:visual
```

To update visual snapshots intentionally:

```bash
npm run test:visual:update
```

Scripts are defined in [package.json](../package.json).

## CI Workflow Alignment

CI is defined in [/.github/workflows/ci.yml](../.github/workflows/ci.yml) and currently runs:

1. Lint
2. Unit and component tests (`npm test`)
3. Playwright e2e (`npm run test:e2e`)
4. Playwright visual regression (`npm run test:visual`)

When a change affects runtime behavior or UI output, run the corresponding local command before opening or updating a PR.

## Where Tests Live

### Domain and Persistence Safety

- Validation and migration: [src/domain/validation.test.ts](../src/domain/validation.test.ts)
- Recurring date logic: [src/domain/recurring.test.ts](../src/domain/recurring.test.ts)
- Category deletion planning: [src/domain/category-service.test.ts](../src/domain/category-service.test.ts)
- Financial selectors/totals: [src/domain/selectors.test.ts](../src/domain/selectors.test.ts)
- Backup export/restore: [src/backup/backup-service.test.ts](../src/backup/backup-service.test.ts), [src/backup/restore-service.test.ts](../src/backup/restore-service.test.ts)

### State and Provider Behavior

- Reducer transitions/invariants: [src/state/finance-reducer.test.ts](../src/state/finance-reducer.test.ts)
- Provider hydration/persistence/theme behavior: [src/state/finance-context.test.tsx](../src/state/finance-context.test.tsx)
- Hook usage constraints: [src/state/use-finance.test.tsx](../src/state/use-finance.test.tsx)

### Feature and App Flows (RTL)

- App-level user flows: [src/App.ui.test.tsx](../src/App.ui.test.tsx)
- Transactions UI behavior: [src/features/transactions/transactions-screen.test.tsx](../src/features/transactions/transactions-screen.test.tsx)
- Editor and settings surfaces: [src/features/transactions/transaction-editor-sheet.test.tsx](../src/features/transactions/transaction-editor-sheet.test.tsx), [src/features/recurring/recurring-editor-sheet.test.tsx](../src/features/recurring/recurring-editor-sheet.test.tsx), [src/features/settings/settings-screen.test.tsx](../src/features/settings/settings-screen.test.tsx)

### Browser-Level Flows (Playwright)

- Cross-screen happy paths and high-level interactions: [e2e/app.e2e.spec.ts](../e2e/app.e2e.spec.ts)
- Visual regressions across screens/layouts/themes: [e2e/visual.spec.ts](../e2e/visual.spec.ts)
- Deterministic browser setup utilities: [e2e/test-helpers.ts](../e2e/test-helpers.ts), [e2e/test-data.ts](../e2e/test-data.ts)

## Choosing the Right Test Type

### Add Unit/Integration Tests When

- Changing model parsing, migration, or normalization behavior.
- Changing reducer invariants or action semantics.
- Changing financial computations used by Home, Insights, or Budgets.
- Changing backup export/restore acceptance rules.

These changes are usually fastest and most precisely covered in `src/**/*.test.ts` and targeted UI tests in `src/**/*.test.tsx`.

### Add E2E Tests When

- A user flow crosses multiple screens/components and local storage state.
- Behavior depends on browser integration that jsdom tests do not fully represent.
- You need confidence in navigation and interaction wiring at the app-shell level.

### Add Visual Tests When

- UI changes alter layout, composition, or responsive behavior.
- Changes affect theme rendering or presentation of major screens.

Visual tests are for rendered appearance regression detection, not business-rule correctness.

## Risk-Sensitive Areas That Should Usually Have Targeted Tests

This repo prioritizes regression prevention and data correctness. When changing these modules, add focused tests in the same PR:

- [src/domain/validation.ts](../src/domain/validation.ts)
- [src/domain/recurring.ts](../src/domain/recurring.ts)
- [src/domain/category-service.ts](../src/domain/category-service.ts)
- [src/domain/selectors.ts](../src/domain/selectors.ts)
- [src/backup/restore-service.ts](../src/backup/restore-service.ts)
- [src/persistence/finance-storage.ts](../src/persistence/finance-storage.ts)
- [src/state/finance-reducer.ts](../src/state/finance-reducer.ts)
- [src/state/finance-context.tsx](../src/state/finance-context.tsx)
- [src/state/reducer-cases](../src/state/reducer-cases)
- [src/state/reducer-utils](../src/state/reducer-utils)

There is currently stronger direct test coverage for most domain/state/backup paths than for [src/persistence/indexeddb.ts](../src/persistence/indexeddb.ts), [src/pwa/register-service-worker.ts](../src/pwa/register-service-worker.ts), and [src/sw.ts](../src/sw.ts). Changes there should include focused tests where practical.

## Practical PR Testing Guidance

For safe, reviewable changes:

1. Run `npm run test` for unit/integration coverage.
2. Run `npm run test:e2e` when changing cross-screen behavior or orchestration.
3. Run `npm run test:visual` for meaningful UI changes; update snapshots only for intentional visual diffs.
4. Add narrowly scoped tests for bug-prone logic instead of broad refactors.

This matches the repository review focus in [./.github/copilot-instructions.md](../.github/copilot-instructions.md): protect invariants, migration/restore safety, and financial correctness.
