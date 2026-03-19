import { describe, expect, it } from 'vitest'
import { parsePersistedFinanceState } from './validation'

describe('parsePersistedFinanceState', () => {
  it('migrates legacy persisted settings that predate backup metadata', () => {
    const legacyState = {
      categories: [
        {
          id: 'cat-food',
          name: 'Food',
          color: '#ff8b5f',
          kind: 'expense',
          isDefault: true,
          createdAt: '2026-03-01T10:00:00.000Z',
          updatedAt: '2026-03-01T10:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
      transactions: [],
      budgets: [],
      syncQueue: [],
      settings: {
        theme: 'dark',
        currency: 'USD',
        syncEndpoint: 'demo://local',
        conflictPolicy: 'client-wins',
      },
      lastSyncedAt: null,
      lastSyncAttemptAt: null,
      lastSyncError: null,
    }

    const parsedState = parsePersistedFinanceState(legacyState)

    expect(parsedState).not.toBeNull()
    expect(parsedState?.settings.hasSeenPrivacyModal).toBe(true)
    expect(parsedState?.settings.backupRemindersEnabled).toBe(true)
    expect(parsedState?.settings.lastBackupAt).toBeNull()
    expect(parsedState?.settings.changesSinceBackup).toBe(0)
    expect(parsedState?.settings.lastReminderAt).toBeNull()
  })
})