const now = new Date('2026-03-20T12:00:00.000Z')

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const todayKey = toLocalDateKey(now)

export const STORAGE_KEY = 'tally.finance.v2'

export function createSeedState(options: {
  withTransactions?: boolean
  includeFoodTransaction?: boolean
  withRecurringDue?: boolean
} = {}) {
  const withTransactions = options.withTransactions ?? true
  const includeFoodTransaction = options.includeFoodTransaction ?? true
  const withRecurringDue = options.withRecurringDue ?? false

  const transactions = withTransactions
    ? [
        ...(includeFoodTransaction
          ? [
              {
                id: 'txn-food-seed',
                type: 'expense',
                amount: 45.2,
                categoryId: 'cat-food',
                note: 'Seed food',
                occurredAt: todayKey,
                recurringTemplateId: null,
                recurringOccurrenceDate: null,
                createdAt: '2026-03-20T08:00:00.000Z',
                updatedAt: '2026-03-20T08:00:00.000Z',
                syncStatus: 'synced',
              },
            ]
          : []),
        {
          id: 'txn-income-seed',
          type: 'income',
          amount: 2100,
          categoryId: 'cat-salary',
          note: 'Seed salary',
          occurredAt: todayKey,
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-03-20T09:00:00.000Z',
          updatedAt: '2026-03-20T09:00:00.000Z',
          syncStatus: 'synced',
        },
      ]
    : []

  return {
    categories: [
      {
        id: 'cat-uncategorized',
        name: 'Uncategorized',
        color: '#7e8798',
        kind: 'both',
        system: 'uncategorized',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        syncStatus: 'synced',
      },
      {
        id: 'cat-salary',
        name: 'Salary',
        color: '#49d17d',
        kind: 'income',
        system: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        syncStatus: 'synced',
      },
      {
        id: 'cat-food',
        name: 'Food',
        color: '#ff8b5f',
        kind: 'expense',
        system: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        syncStatus: 'synced',
      },
      {
        id: 'cat-transport',
        name: 'Transport',
        color: '#4f8bff',
        kind: 'expense',
        system: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        syncStatus: 'synced',
      },
      {
        id: 'cat-housing',
        name: 'Housing',
        color: '#a97cff',
        kind: 'expense',
        system: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        syncStatus: 'synced',
      },
    ],
    transactions,
    budgets: [],
    recurringTemplates: withRecurringDue
      ? [
          {
            id: 'rec-food-due',
            type: 'expense',
            amount: 22,
            categoryId: 'cat-food',
            note: 'Seed recurring meal',
            frequency: 'monthly',
            intervalDays: null,
            startDate: '2026-02-20',
            nextDueDate: todayKey,
            active: true,
            createdAt: '2026-02-20T08:00:00.000Z',
            updatedAt: '2026-02-20T08:00:00.000Z',
            syncStatus: 'synced',
          },
        ]
      : [],
    syncQueue: [],
    settings: {
      theme: 'light',
      currency: 'USD',
      syncEndpoint: 'demo://local',
      conflictPolicy: 'client-wins',
      hasSeenPrivacyModal: true,
      backupRemindersEnabled: false,
      lastBackupAt: null,
      changesSinceBackup: 0,
      lastReminderAt: null,
    },
    lastSyncedAt: null,
    lastSyncAttemptAt: null,
    lastSyncError: null,
  }
}
