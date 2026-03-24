# Tally Architecture

## High-Level Overview

Tally is a local-first React + TypeScript finance app. The browser is the runtime, local storage is the system of record, and all main features operate without a backend.

Related docs:

- [Data model](./data-model.md)
- [Testing guide](./testing.md)
- [Contributing guide](./contributing.md)

At startup:

1. The app registers a service worker for offline caching.
2. The app mounts a single finance provider.
3. The provider hydrates state from persisted storage.
4. After hydration, state changes are persisted back to storage.

Primary references:

- [src/main.tsx](../src/main.tsx)
- [src/App.tsx](../src/App.tsx)
- [src/state/finance-context.tsx](../src/state/finance-context.tsx)
- [src/persistence/finance-storage.ts](../src/persistence/finance-storage.ts)

## Module Boundaries

### UI and Screen Composition

Feature UI lives in [src/features](../src/features). The app shell selects one active tab and resolves the active screen.

- Screen routing and shell orchestration: [src/features/shell/app-screen-resolver.tsx](../src/features/shell/app-screen-resolver.tsx)
- Home: [src/features/home/home-screen.tsx](../src/features/home/home-screen.tsx)
- Transactions: [src/features/transactions/transactions-screen.tsx](../src/features/transactions/transactions-screen.tsx)
- Insights: [src/features/insights/insights-screen.tsx](../src/features/insights/insights-screen.tsx)
- Budgets: [src/features/budgets/budgets-screen.tsx](../src/features/budgets/budgets-screen.tsx)
- Settings: [src/features/settings/settings-screen.tsx](../src/features/settings/settings-screen.tsx)

UI components should stay focused on rendering, user interactions, and invoking context actions.

### State and Action Orchestration

State is centralized behind a React context + reducer pair:

- Provider and action methods: [src/state/finance-context.tsx](../src/state/finance-context.tsx)
- Reducer root: [src/state/finance-reducer.ts](../src/state/finance-reducer.ts)
- Action types: [src/state/finance-reducer-types.ts](../src/state/finance-reducer-types.ts)
- Consumer hook: [src/state/use-finance.ts](../src/state/use-finance.ts)

The provider performs input shaping and guards before dispatch. The reducer enforces compatibility and no-op behavior for invalid transitions.

### Domain Logic

Pure business rules and derived computations are in [src/domain](../src/domain):

- State model types: [src/domain/models.ts](../src/domain/models.ts)
- Default bootstrap state: [src/domain/default-data.ts](../src/domain/default-data.ts)
- Validation and migration parser: [src/domain/validation.ts](../src/domain/validation.ts)
- Category deletion planning: [src/domain/category-service.ts](../src/domain/category-service.ts)
- Recurring scheduling and due detection: [src/domain/recurring.ts](../src/domain/recurring.ts)
- Summaries and analytics selectors: [src/domain/selectors.ts](../src/domain/selectors.ts)
- Budget category normalization and spend math: [src/domain/budget-service.ts](../src/domain/budget-service.ts)

### Persistence and Offline Runtime

Persistence and offline shell behavior are separated from business rules:

- Persistence orchestration with fallback strategy: [src/persistence/finance-storage.ts](../src/persistence/finance-storage.ts)
- IndexedDB adapter: [src/persistence/indexeddb.ts](../src/persistence/indexeddb.ts)
- Service worker registration hook: [src/pwa/register-service-worker.ts](../src/pwa/register-service-worker.ts)
- Service worker runtime caching rules: [src/sw.ts](../src/sw.ts)

### Backup and Restore

Backup and restore are versioned and validated:

- Backup schema and result types: [src/backup/backup-models.ts](../src/backup/backup-models.ts)
- Backup export and download: [src/backup/backup-service.ts](../src/backup/backup-service.ts)
- Restore preparation and payload validation: [src/backup/restore-service.ts](../src/backup/restore-service.ts)
- Restore UX path: [src/features/settings/settings-screen.tsx](../src/features/settings/settings-screen.tsx)

## State Management Approach

Tally uses a single FinanceState object that contains categories, transactions, budgets, recurring templates, and settings.

Load/save lifecycle:

1. Provider initializes reducer with default state.
2. Provider loads persisted state and dispatches hydrate when available.
3. Provider sets isLoaded once hydration attempt completes.
4. Persist effect writes each post-load state update.

References:

- [src/state/finance-context.tsx](../src/state/finance-context.tsx)
- [src/domain/models.ts](../src/domain/models.ts)
- [src/persistence/finance-storage.ts](../src/persistence/finance-storage.ts)

Change tracking behavior:

- Reducer helper increments settings.changesSinceBackup for meaningful data mutations.
- Settings-only updates do not use that helper.
- Hydrate and replace-state do not increment change counter.

References:

- [src/state/reducer-utils/change-tracking.ts](../src/state/reducer-utils/change-tracking.ts)
- [src/state/reducer-cases/meta-settings.ts](../src/state/reducer-cases/meta-settings.ts)

## Domain vs UI Responsibilities

Domain layer responsibilities:

- Parse and normalize persisted state.
- Keep category and transaction type compatibility valid.
- Plan multi-entity category deletion impact.
- Compute recurring due dates and processible sequences.
- Produce totals and chart inputs for screens.

UI layer responsibilities:

- Collect user input and trigger context actions.
- Display derived values and warnings/messages.
- Present confirm flows for destructive actions and restore.

Representative boundary examples:

- Category deletion planning in domain, execution via state reducer:
  - [src/domain/category-service.ts](../src/domain/category-service.ts)
  - [src/state/finance-reducer.ts](../src/state/finance-reducer.ts)
- Recurring due computation in domain, user confirmation in UI:
  - [src/domain/recurring.ts](../src/domain/recurring.ts)
  - [src/features/recurring/recurring-due-section.tsx](../src/features/recurring/recurring-due-section.tsx)

## Persistence and Storage Flow

Read flow:

1. Attempt IndexedDB read.
2. Parse with parsePersistedFinanceState.
3. If IndexedDB path fails or parses as null, fall back to localStorage.
4. Return null if both paths fail.

Write flow:

1. Attempt IndexedDB write.
2. Attempt localStorage write.
3. Succeed if at least one write path succeeded.
4. Throw only when both writes fail.

This design prioritizes durability through dual-path writes and tolerant reads.

References:

- [src/persistence/finance-storage.ts](../src/persistence/finance-storage.ts)
- [src/persistence/indexeddb.ts](../src/persistence/indexeddb.ts)
- [src/domain/validation.ts](../src/domain/validation.ts)

## Backup and Restore Flow

Backup export:

1. Build a versioned payload from current state.
2. Reset backup-related preference fields in exported preferences.
3. Serialize and trigger JSON download.

Restore import:

1. Parse JSON file.
2. Validate version/app marker and structural fields.
3. Re-parse through parsePersistedFinanceState to normalize/migrate.
4. Build nextState and require user confirmation.
5. On confirm, write nextState through replaceState (save first, then dispatch).

References:

- [src/backup/backup-service.ts](../src/backup/backup-service.ts)
- [src/backup/restore-service.ts](../src/backup/restore-service.ts)
- [src/features/settings/settings-screen.tsx](../src/features/settings/settings-screen.tsx)
- [src/state/finance-context.tsx](../src/state/finance-context.tsx)

## Recurring Transaction Handling

Recurring templates are first-class state entities, not inferred from transaction history.

Processing model:

1. Domain computes due occurrences up to today for each active template.
2. UI presents due groups on Home for explicit user action.
3. User can add occurrences, skip occurrences, edit the template, or stop recurrence.
4. Reducer updates transactions and nextDueDate based on processed count.

Safety behavior:

- Requested recurring occurrence dates must match an ordered prefix of currently due dates.
- Invalid or out-of-order date sets are rejected.

References:

- [src/domain/recurring.ts](../src/domain/recurring.ts)
- [src/features/recurring/recurring-due-section.tsx](../src/features/recurring/recurring-due-section.tsx)
- [src/state/finance-context.tsx](../src/state/finance-context.tsx)
- [src/state/finance-reducer.ts](../src/state/finance-reducer.ts)

## Key Invariants and Risk-Sensitive Areas

Category invariants:

- Uncategorized system category must exist.
- System categories cannot be deleted.
- Category kind must remain compatible with linked transactions and recurring templates.
- Category deletion must propagate safely to transactions, recurring templates, and budgets.

References:

- [src/domain/categories.ts](../src/domain/categories.ts)
- [src/domain/validation.ts](../src/domain/validation.ts)
- [src/domain/category-service.ts](../src/domain/category-service.ts)
- [src/state/finance-reducer.ts](../src/state/finance-reducer.ts)

Budget invariants:

- Budget limit must be finite and greater than zero.
- Budget categories are normalized and restricted to valid expense categories.
- Duplicate budget names in the same month are blocked in provider-level checks.

References:

- [src/domain/budget-service.ts](../src/domain/budget-service.ts)
- [src/state/reducer-cases/budgets.ts](../src/state/reducer-cases/budgets.ts)
- [src/state/finance-context.tsx](../src/state/finance-context.tsx)

Persistence and migration invariants:

- Persisted payloads are accepted only through parsePersistedFinanceState.
- Legacy shapes are migrated where supported.
- Invalid category references in transactions and recurring templates are normalized to Uncategorized.

References:

- [src/domain/validation.ts](../src/domain/validation.ts)
- [src/persistence/finance-storage.ts](../src/persistence/finance-storage.ts)

Backup/restore invariants:

- Unsupported backup schema versions are rejected.
- Restore path validates and normalizes data before applying.
- Restore writes to persistence before reducer replacement to avoid in-memory-only restore state.

References:

- [src/backup/restore-service.ts](../src/backup/restore-service.ts)
- [src/state/finance-context.tsx](../src/state/finance-context.tsx)

## Where To Start (Contributors)

Suggested reading order for architecture onboarding:

1. [src/domain/models.ts](../src/domain/models.ts) for core entities.
2. [src/state/finance-context.tsx](../src/state/finance-context.tsx) for app-level action orchestration.
3. [src/state/finance-reducer.ts](../src/state/finance-reducer.ts) and reducer cases for mutation rules.
4. [src/domain/validation.ts](../src/domain/validation.ts) for migration and parse guarantees.
5. [src/features/home/home-screen.tsx](../src/features/home/home-screen.tsx) and [src/features/settings/settings-screen.tsx](../src/features/settings/settings-screen.tsx) for high-impact UX flows.

Suggested first test files to understand behavior constraints:

- [src/state/finance-reducer.test.ts](../src/state/finance-reducer.test.ts)
- [src/domain/category-service.test.ts](../src/domain/category-service.test.ts)
- [src/domain/recurring.test.ts](../src/domain/recurring.test.ts)
- [src/backup/restore-service.test.ts](../src/backup/restore-service.test.ts)