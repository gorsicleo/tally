import { describe, expect, it } from 'vitest'
import { initialFinanceState } from '../domain/default-data'
import type { FinanceState } from '../domain/models'
import {
  evaluateBackupReminder,
  getBackupReminderBody,
} from './backup-reminder-service'

function createReminderState(): FinanceState {
  return {
    ...initialFinanceState,
    categories: [
      ...initialFinanceState.categories,
      {
        id: 'cat-side-hustle',
        name: 'Side hustle',
        color: '#54d9a6',
        kind: 'income',
        isDefault: false,
        createdAt: '2026-03-01T08:00:00.000Z',
        updatedAt: '2026-03-01T08:00:00.000Z',
        syncStatus: 'synced',
      },
    ],
    transactions: [
      {
        id: 'txn-1',
        type: 'expense',
        amount: 18,
        categoryId: 'cat-food',
        note: 'Groceries',
        occurredAt: '2026-03-15',
        createdAt: '2026-03-15T12:00:00.000Z',
        updatedAt: '2026-03-15T12:00:00.000Z',
        syncStatus: 'synced',
      },
    ],
    settings: {
      ...initialFinanceState.settings,
      hasSeenPrivacyModal: true,
      backupRemindersEnabled: true,
    },
  }
}

describe('evaluateBackupReminder', () => {
  it('shows a reminder when no backup exists and meaningful data has been added', () => {
    const result = evaluateBackupReminder(
      createReminderState(),
      new Date('2026-03-19T10:00:00.000Z'),
    )

    expect(result).toEqual({ shouldShow: true, reason: 'missing-backup' })
  })

  it('shows a reminder when the last backup is stale', () => {
    const result = evaluateBackupReminder(
      {
        ...createReminderState(),
        settings: {
          ...createReminderState().settings,
          lastBackupAt: '2026-03-10T10:00:00.000Z',
          changesSinceBackup: 1,
        },
      },
      new Date('2026-03-19T10:00:00.000Z'),
    )

    expect(result).toEqual({ shouldShow: true, reason: 'stale-backup' })
  })

  it('shows a reminder when enough changes have accumulated since the last backup', () => {
    const result = evaluateBackupReminder(
      {
        ...createReminderState(),
        settings: {
          ...createReminderState().settings,
          lastBackupAt: '2026-03-18T10:00:00.000Z',
          changesSinceBackup: 8,
        },
      },
      new Date('2026-03-19T10:00:00.000Z'),
    )

    expect(result).toEqual({ shouldShow: true, reason: 'recent-changes' })
  })

  it('suppresses reminders during the cooldown window', () => {
    const result = evaluateBackupReminder(
      {
        ...createReminderState(),
        settings: {
          ...createReminderState().settings,
          lastBackupAt: '2026-03-10T10:00:00.000Z',
          lastReminderAt: '2026-03-19T00:00:00.000Z',
          changesSinceBackup: 12,
        },
      },
      new Date('2026-03-19T10:00:00.000Z'),
    )

    expect(result).toEqual({ shouldShow: false, reason: null })
  })

  it('builds calm reminder copy', () => {
    expect(getBackupReminderBody(null)).toContain('You have not created a backup yet.')
    expect(
      getBackupReminderBody(
        '2026-03-17T10:00:00.000Z',
        new Date('2026-03-19T10:00:00.000Z'),
      ),
    ).toBe('Your last backup was 2 days ago.')
  })
})