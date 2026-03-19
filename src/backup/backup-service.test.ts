import { describe, expect, it } from 'vitest'
import { initialFinanceState } from '../domain/default-data'
import type { FinanceState } from '../domain/models'
import {
  buildBackupPayload,
  createBackupFileName,
} from './backup-service'

function createSampleState(): FinanceState {
  return {
    ...initialFinanceState,
    categories: [
      ...initialFinanceState.categories,
      {
        id: 'cat-health',
        name: 'Health',
        color: '#7bc4ff',
        kind: 'expense',
        isDefault: false,
        createdAt: '2026-03-10T10:00:00.000Z',
        updatedAt: '2026-03-10T10:00:00.000Z',
        syncStatus: 'synced',
      },
    ],
    transactions: [
      {
        id: 'txn-1',
        type: 'expense',
        amount: 42.5,
        categoryId: 'cat-health',
        note: 'Pharmacy',
        occurredAt: '2026-03-11',
        createdAt: '2026-03-11T08:00:00.000Z',
        updatedAt: '2026-03-11T08:00:00.000Z',
        syncStatus: 'synced',
      },
    ],
    budgets: [
      {
        id: 'budget-cat-health-2026-03',
        categoryId: 'cat-health',
        monthKey: '2026-03',
        limit: 120,
        createdAt: '2026-03-01T09:00:00.000Z',
        updatedAt: '2026-03-01T09:00:00.000Z',
        syncStatus: 'synced',
      },
    ],
    settings: {
      ...initialFinanceState.settings,
      currency: 'EUR',
      hasSeenPrivacyModal: true,
      backupRemindersEnabled: false,
      lastBackupAt: null,
      changesSinceBackup: 5,
      lastReminderAt: '2026-03-12T10:00:00.000Z',
    },
  }
}

describe('buildBackupPayload', () => {
  it('creates a versioned JSON-ready payload with backup metadata', () => {
    const exportedAt = '2026-03-19T09:30:00.000Z'
    const payload = buildBackupPayload(createSampleState(), exportedAt)

    expect(payload.schemaVersion).toBe(1)
    expect(payload.app).toBe('Tally')
    expect(payload.exportedAt).toBe(exportedAt)
    expect(payload.data.transactions).toHaveLength(1)
    expect(payload.data.categories).toHaveLength(initialFinanceState.categories.length + 1)
    expect(payload.data.budgets).toHaveLength(1)
    expect(payload.data.preferences.currency).toBe('EUR')
    expect(payload.data.preferences.backupRemindersEnabled).toBe(false)
    expect(payload.data.preferences.lastBackupAt).toBe(exportedAt)
    expect(payload.data.preferences.changesSinceBackup).toBe(0)
    expect(payload.data.preferences.lastReminderAt).toBeNull()
  })

  it('creates the expected backup file name', () => {
    expect(createBackupFileName('2026-03-19T09:30:00.000Z')).toBe(
      'tally-backup-2026-03-19.json',
    )
  })
})