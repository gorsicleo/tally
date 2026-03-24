# Tally Data Model

This document describes the persisted application model and the guardrails that keep it consistent.

For architecture context, see [docs/architecture.md](./architecture.md).

## Canonical State Shape

The canonical model is `FinanceState` in [src/domain/models.ts](../src/domain/models.ts):

- `categories: Category[]`
- `transactions: Transaction[]`
- `budgets: Budget[]`
- `recurringTemplates: RecurringTemplate[]`
- `settings: AppSettings`

All persistence and backup restore paths are normalized through `parsePersistedFinanceState` in [src/domain/validation.ts](../src/domain/validation.ts).

## Core Entities

### Category

Defined in [src/domain/models.ts](../src/domain/models.ts) as:

- Identity and timestamps: `id`, `createdAt`, `updatedAt`
- Display/model fields: `name`, `color`, `kind`, `system`

Important semantics:

- `kind` is one of `income`, `expense`, `both`.
- `system` is either `uncategorized` or `null`.
- The uncategorized category is reserved and treated as non-deletable.

References:

- [src/domain/categories.ts](../src/domain/categories.ts)
- [src/domain/category-service.ts](../src/domain/category-service.ts)
- [src/state/finance-reducer.ts](../src/state/finance-reducer.ts)

### Transaction

Defined in [src/domain/models.ts](../src/domain/models.ts) as:

- Identity and timestamps: `id`, `createdAt`, `updatedAt`
- Financial fields: `type`, `amount`, `categoryId`, `occurredAt`
- Metadata: `note`
- Recurring linkage: `recurringTemplateId`, `recurringOccurrenceDate`

Important semantics:

- `amount` is expected to be positive in stored state.
- `type` drives category compatibility checks.
- Recurring linkage fields are nullable and can be absent in legacy data, then migrated to `null`.

References:

- [src/state/reducer-cases/transactions.ts](../src/state/reducer-cases/transactions.ts)
- [src/domain/validation.ts](../src/domain/validation.ts)

### Budget

Defined in [src/domain/models.ts](../src/domain/models.ts) as:

- Identity and timestamps: `id`, `createdAt`, `updatedAt`
- Budget fields: `name`, `categoryIds`, `monthKey`, `limit`

Important semantics:

- Budgets are multi-category (`categoryIds[]`), not single-category.
- Categories are normalized to valid expense categories.
- `limit` must be finite and greater than zero.

References:

- [src/domain/budget-service.ts](../src/domain/budget-service.ts)
- [src/state/reducer-cases/budgets.ts](../src/state/reducer-cases/budgets.ts)
- [src/domain/validation.ts](../src/domain/validation.ts)

### RecurringTemplate

Defined in [src/domain/models.ts](../src/domain/models.ts) as:

- Identity and timestamps: `id`, `createdAt`, `updatedAt`
- Financial fields: `type`, `amount`, `categoryId`, `note`
- Schedule fields: `frequency`, `intervalDays`, `startDate`, `nextDueDate`
- Lifecycle field: `active`

Important semantics:

- `frequency` is `monthly` or `custom`.
- `intervalDays` is `null` for `monthly` and numeric for `custom`.
- `nextDueDate` advances only through recurring processing actions.

References:

- [src/domain/recurring.ts](../src/domain/recurring.ts)
- [src/state/finance-context.tsx](../src/state/finance-context.tsx)
- [src/state/finance-reducer.ts](../src/state/finance-reducer.ts)

### AppSettings and BackupPreferences

Defined in [src/domain/models.ts](../src/domain/models.ts).

`AppSettings` extends backup metadata with UI settings:

- UI settings: `theme`, `currency`
- Backup metadata: `hasSeenPrivacyModal`, `backupRemindersEnabled`, `lastBackupAt`, `changesSinceBackup`, `lastReminderAt`

Important semantics:

- `currency` is validated as 3-letter string during parsing.
- `changesSinceBackup` increments on meaningful reducer mutations.

References:

- [src/state/reducer-utils/change-tracking.ts](../src/state/reducer-utils/change-tracking.ts)
- [src/state/reducer-cases/meta-settings.ts](../src/state/reducer-cases/meta-settings.ts)

## Relationships Between Entities

### Category References

- `Transaction.categoryId -> Category.id`
- `RecurringTemplate.categoryId -> Category.id`
- `Budget.categoryIds[] -> Category.id[]`

Compatibility rules:

- Transaction and recurring template type must be compatible with category `kind`.
- Budget category lists are normalized and filtered to valid expense categories.

References:

- [src/state/reducer-utils/category-compat.ts](../src/state/reducer-utils/category-compat.ts)
- [src/domain/budget-service.ts](../src/domain/budget-service.ts)
- [src/domain/validation.ts](../src/domain/validation.ts)

### Recurring to Transactions Link

- `Transaction.recurringTemplateId` may reference a template.
- `Transaction.recurringOccurrenceDate` records which due date was applied.
- Recurring processing creates transactions and advances template `nextDueDate`.

References:

- [src/domain/recurring.ts](../src/domain/recurring.ts)
- [src/state/finance-context.tsx](../src/state/finance-context.tsx)

## Constraints and Invariants

### Parse-Time and Migration Invariants

Enforced in [src/domain/validation.ts](../src/domain/validation.ts):

- Non-object or structurally invalid persisted payloads return `null`.
- Uncategorized category is ensured in parsed output.
- Legacy transaction recurring fields are defaulted to `null`.
- Legacy budget shape (`categoryId`) is migrated to `categoryIds[]`.
- Invalid transaction and recurring category references are rewritten to Uncategorized.
- Invalid budget entries are dropped rather than retained in partial-invalid form.

### Reducer/Action Invariants

Enforced in [src/state/finance-reducer.ts](../src/state/finance-reducer.ts) and reducer cases:

- Invalid transaction amount/category compatibility produces no-op state transitions.
- System categories cannot be deleted or updated as normal categories.
- Category updates are blocked when they would break linked transactions, recurring templates, or budgets.
- Category deletion executes a precomputed plan that updates transactions, recurring templates, and budgets in one transition.
- Recurring occurrence additions/skips require a valid template and valid occurrence set.

### Backup/Restore Invariants

Enforced in [src/backup/restore-service.ts](../src/backup/restore-service.ts):

- Only supported schema versions are accepted.
- Parsed backup data is normalized via `parsePersistedFinanceState` before restore.
- Schema v1 backups are accepted; recurring templates default to empty during normalization.
- Restored settings force `changesSinceBackup = 0` and clear `lastReminderAt`.

## Migration and Persistence-Sensitive Fields

The following areas are high-risk when changing the model:

- `Category.system` and uncategorized handling.
- `Transaction.categoryId` and `RecurringTemplate.categoryId` normalization behavior.
- `Transaction.recurringTemplateId` and `Transaction.recurringOccurrenceDate` migration defaults.
- `Budget.categoryIds` and legacy budget migration behavior.
- `AppSettings` backup metadata fields, especially `changesSinceBackup` and `lastBackupAt`.
- Storage key/version assumptions in [src/persistence/finance-storage.ts](../src/persistence/finance-storage.ts).
- Backup schema and payload contract in [src/backup/backup-models.ts](../src/backup/backup-models.ts).

## Practical Change Checklist

When changing data model fields or relationships:

1. Update model types in [src/domain/models.ts](../src/domain/models.ts).
2. Update parse/migration rules in [src/domain/validation.ts](../src/domain/validation.ts).
3. Update reducer compatibility and invariants in [src/state/finance-reducer.ts](../src/state/finance-reducer.ts) and reducer cases.
4. Update backup schema/types/services in [src/backup/backup-models.ts](../src/backup/backup-models.ts), [src/backup/backup-service.ts](../src/backup/backup-service.ts), and [src/backup/restore-service.ts](../src/backup/restore-service.ts).
5. Add or update focused tests in:
   - [src/domain/validation.test.ts](../src/domain/validation.test.ts)
   - [src/domain/category-service.test.ts](../src/domain/category-service.test.ts)
   - [src/domain/recurring.test.ts](../src/domain/recurring.test.ts)
   - [src/backup/restore-service.test.ts](../src/backup/restore-service.test.ts)
   - [src/state/finance-reducer.test.ts](../src/state/finance-reducer.test.ts)
