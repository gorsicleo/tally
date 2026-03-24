---
description: "Use when reviewing changes in src/state, reducer actions, finance context orchestration, or high-impact UI flows that dispatch state mutations. Focus on invariants, cross-entity updates, and regression tests."
applyTo: "src/state/**,src/App.tsx,src/features/settings/settings-screen.tsx,src/features/transactions/transaction-editor-sheet.tsx,src/features/recurring/recurring-due-section.tsx"
---
# State Review Focus

Prioritize correctness of reducer/context behavior over code style.

## Must Check

- Every action preserves invariants for category compatibility, budget validity, recurring validity, and settings shape.
- Reducer changes do not silently bypass validation done in domain/context layers.
- `changesSinceBackup` semantics stay correct for meaningful mutations.
- Actions that touch multiple entities keep transactions, recurring templates, and budgets in sync.
- Date-sensitive state transitions (recurring due processing, skips, next due updates) remain deterministic and idempotent.

## Test Expectations

Request targeted tests for any changes to:

- `src/state/finance-reducer.ts`
- `src/state/finance-context.tsx`
- `src/state/finance-reducer-types.ts`
- `src/state/reducer-cases/**`
- `src/state/reducer-utils/**`

Prefer concrete missing-case tests over broad "more tests" comments.
