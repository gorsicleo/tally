<div align="center">
  <img width="217" src="./public/icon-512.png" alt="Tally Icon" />
</div>

<div align="center">
  <h1><b>Tally</b></h1>
  <p><i>A fast, mobile-first personal finance tracker built for simplicity and control.</i></p>
  <p>
    <a href="https://tallyfor.me">
      <img src="https://img.shields.io/badge/Open%20Live%20App-tallyfor.me-0f766e?style=for-the-badge" alt="Open Live App at tallyfor.me" />
    </a>
  </p>
  <p>
    <a href="./docs/architecture.md"><strong>Read the docs</strong></a>
    ·
    <a href="./docs/contributing.md"><strong>Contribute</strong></a>
  </p>
</div>

## Overview

**Tally** is a local-first personal finance tracker for quick daily use.

Track income and expenses, organize categories, review trends and budgets, and keep control of your data with on-device storage and manual backups. It is built to stay fast, readable, and useful without requiring an account or a backend.

## Features

### Core Functionality

- Track income and expenses
- Edit and delete transactions
- Categorize transactions (default and custom)
- Grouped history with search, date presets, and filters
- Running totals and monthly summaries
- Export transactions to CSV

### Home

- Monthly summary
- Recent activity
- Category breakdown
- Quick-add transactions

### Insights

- Monthly trend view
- Category totals
- Month-over-month comparison

### Budgets

- Optional monthly budgets per category
- Overspend and at-risk indicators
- Quick budget editing from the Budgets screen

### Backup and Restore

- JSON backup export and restore
- Backup reminders and last-backup tracking
- Strict backup import validation with clear error messages

### Settings

- Theme selection (light, dark, or auto)
- Currency selection
- Category management
- Optional install prompt (PWA)

## Offline-First

- Data is stored locally in the browser with IndexedDB and localStorage fallback
- Core tracking works without a network connection
- Backup export and restore provide a manual way to keep or move your data

## Additional Options

- Backup reminders
- Privacy-first onboarding modal

## PWA Support

- Installable on mobile and desktop
- Offline shell support
- Custom app icons
- Add to Home Screen support

## Run Locally

```bash
npm install
npm run dev
```

### Test

```bash
npm run test
```

### Lint

```bash
npm run lint
```

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Documentation

- [Architecture](./docs/architecture.md)
- [Data model](./docs/data-model.md)
- [Testing guide](./docs/testing.md)
- [Contributing guide](./docs/contributing.md)

## Project Structure

```text
src/
  backup/        Backup, restore, and reminder logic
  domain/        Models, selectors, validation, formatting, and business logic
  features/      Screen-level UI modules (home, transactions, insights, budgets, settings)
  persistence/   IndexedDB and local state persistence
  pwa/           Service worker registration and install prompt handling
  state/         Finance context, reducer, and store interfaces
  utils/         Shared utilities (date, id, download, etc.)
```

## Architecture

Tally follows a React + TypeScript architecture with clear boundaries:

- UI Layer (`src/features/`): renders screens/components and dispatches actions
- State Layer (`src/state/`): central state with context + reducer updates
- Domain Layer (`src/domain/`): pure, reusable business logic and selectors
- Persistence Layer (`src/persistence/`): local durable storage for offline-first use
- Backup Layer (`src/backup/`): backup export, restore validation, and reminders
- PWA Layer (`src/pwa/`, `src/sw.ts`): install prompt handling and offline shell caching

This split keeps business logic testable and the UI focused on interaction.

## Limitations

- Single-user local app; no built-in accounts or multi-device identity
- Clearing browser/app storage can remove local data
- Backup files are plain JSON and should be handled securely
- No built-in advanced accounting or tax/reporting workflows beyond current insights and CSV export

## Contributing

Contributions are welcome.

If you want to help, start with [docs/contributing.md](./docs/contributing.md). It covers local setup, common scripts, issue and PR expectations, and when targeted tests or doc updates are expected.

## License

MIT
