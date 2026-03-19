# Tally

Tally is a mobile-first personal finance tracker built with React, TypeScript, and Vite.

## Current Scope

- Home, Records, Insights, Budgets, and Settings screens.
- Global quick-add income and expense entry, with Home as the primary overview screen.
- Edit and delete transaction history.
- Default and custom categories, including income/expense/both category kinds.
- Grouped record history with search, lightweight filters, and running totals.
- Monthly summary, recent activity, category totals, and simplified trend views.
- Optional monthly category budgets.
- IndexedDB-first offline persistence with runtime validation.
- Sync queue metadata, manual sync action, and sync-on-open when online.
- Theme, currency, sync status, category management, CSV/JSON export, and JSON backup import in Settings.
- PWA install prompt handling and offline shell support.

## Run Locally

```bash
npm install
npm run dev
```

Build production output:

```bash
npm run build
```

## Project Structure

```
src/
  domain/        # Core models, validation, formatters, selectors, exporters
  features/      # UI modules for home, transactions, insights, budgets, settings, and shell
  persistence/   # IndexedDB + fallback persistence helpers
  pwa/           # Service worker registration + install prompt hook
  state/         # Reducer + context store
  sync/          # Sync client and endpoint contract handling
  utils/         # Shared utility helpers
```

## Architecture Notes

- `domain` stays framework-light so calculations/selectors are easy to test and reuse.
- `state/finance-context.tsx` contains reducer/provider logic, while `state/finance-store.ts` and `state/use-finance.ts` expose typed context contracts and hooks.
- `persistence/finance-storage.ts` hydrates validated state from IndexedDB and writes a localStorage fallback copy.
- PWA manifest metadata is generated from `vite.config.ts`, keeping icons and install metadata in one place.
- `sync/client.ts` supports a demo local sync target (`demo://local`) plus configurable HTTP endpoints.
- Conflict policy is currently `client-wins`, which is exposed in settings and carried through sync configuration.
- `features/*` hold presentation and interaction; global state changes stay in the store layer.

This layout is intended to support future additions like recurring transactions, richer analytics, multi-device sync, auth, and server-backed collaboration without rewriting the existing core.
