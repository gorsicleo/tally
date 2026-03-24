---
description: "Use when reviewing domain, backup/restore, or persistence changes. Focus on migration safety, date logic, financial calculations, and storage fallback durability."
applyTo: "src/domain/**,src/backup/**,src/persistence/**,src/pwa/**,src/sw.ts,src/features/insights/insights-charts.tsx,src/features/shell/use-editor-orchestration.ts"
---
# Domain and Persistence Review Focus

Optimize for data integrity and recovery safety.

## Must Check

- Persisted and backup payload parsing rejects invalid shapes without corrupting valid user data.
- Legacy migration behavior remains compatible and preserves expected defaults.
- Category deletion plans correctly propagate to transactions, recurring templates, and budgets.
- Recurring processing enforces ordered processible dates and correct `nextDueDate` advancement.
- Selector or budgeting math changes do not alter financial totals unexpectedly across screens.
- Persistence writes remain durable with safe IndexedDB/localStorage fallback behavior.

## Test Expectations

Request targeted tests for changes to:

- `src/domain/validation.ts`
- `src/domain/recurring.ts`
- `src/domain/category-service.ts`
- `src/domain/selectors.ts`
- `src/backup/restore-service.ts`
- `src/persistence/finance-storage.ts`

Strongly prefer adding focused tests when touching currently under-tested infra paths:

- `src/persistence/indexeddb.ts`
- `src/pwa/register-service-worker.ts`
- `src/sw.ts`
- `src/features/insights/insights-charts.tsx`
- `src/features/shell/use-editor-orchestration.ts`
