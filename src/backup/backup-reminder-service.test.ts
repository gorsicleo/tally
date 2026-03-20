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
        system: null,
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
        recurringTemplateId: null,
        recurringOccurrenceDate: null,
        createdAt: '2026-03-15T12:00:00.000Z',
        updatedAt: '2026-03-15T12:00:00.000Z',
        syncStatus: 'synced',
      },
    ],
    recurringTemplates: [],
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

  it('treats recurring templates as meaningful local data', () => {
    const result = evaluateBackupReminder(
      {
        ...initialFinanceState,
        recurringTemplates: [
          {
            id: 'rec-gym',
            type: 'expense',
            amount: 35,
            categoryId: 'cat-fun',
            note: 'Gym',
            frequency: 'monthly',
            intervalDays: null,
            startDate: '2026-03-01',
            nextDueDate: '2026-04-01',
            active: true,
            createdAt: '2026-03-01T08:00:00.000Z',
            updatedAt: '2026-03-01T08:00:00.000Z',
            syncStatus: 'synced',
          },
        ],
        settings: {
          ...initialFinanceState.settings,
          backupRemindersEnabled: true,
        },
      },
      new Date('2026-03-19T10:00:00.000Z'),
    )

    expect(result).toEqual({ shouldShow: true, reason: 'missing-backup' })
  })
})