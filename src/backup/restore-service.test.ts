import { describe, expect, it, vi } from 'vitest'
import { initialFinanceState } from '../domain/default-data'
import type { FinanceState } from '../domain/models'
import { buildBackupPayload } from './backup-service'
import { prepareBackupRestore, prepareBackupRestoreFile } from './restore-service'

function createSampleState(): FinanceState {
  return {
    ...initialFinanceState,
    transactions: [
      {
        id: 'txn-restore',
        type: 'expense',
        amount: 25,
        categoryId: 'cat-food',
        note: 'Lunch',
        occurredAt: '2026-03-18',
        recurringTemplateId: null,
        recurringOccurrenceDate: null,
        createdAt: '2026-03-18T12:00:00.000Z',
        updatedAt: '2026-03-18T12:00:00.000Z',
        syncStatus: 'synced',
      },
    ],
    recurringTemplates: [
      {
        id: 'rec-food',
        type: 'expense',
        amount: 25,
        categoryId: 'cat-food',
        note: 'Lunch plan',
        frequency: 'custom',
        intervalDays: 14,
        startDate: '2026-03-18',
        nextDueDate: '2026-04-01',
        active: true,
        createdAt: '2026-03-18T12:00:00.000Z',
        updatedAt: '2026-03-18T12:00:00.000Z',
        syncStatus: 'synced',
      },
    ],
    settings: {
      ...initialFinanceState.settings,
      hasSeenPrivacyModal: true,
      lastBackupAt: null,
      changesSinceBackup: 3,
      lastReminderAt: '2026-03-18T18:00:00.000Z',
    },
  }
}

describe('prepareBackupRestore', () => {
  it('builds a replace-ready finance state from a valid backup', () => {
    const exportedAt = '2026-03-19T09:30:00.000Z'
    const payload = buildBackupPayload(createSampleState(), exportedAt)
    const result = prepareBackupRestore(JSON.stringify(payload))

    expect(result.ok).toBe(true)

    if (!result.ok) {
      return
    }

    expect(result.prepared.payload.exportedAt).toBe(exportedAt)
    expect(result.prepared.nextState.transactions).toHaveLength(1)
    expect(result.prepared.nextState.recurringTemplates).toHaveLength(1)
    expect(result.prepared.nextState.syncQueue).toHaveLength(0)
    expect(result.prepared.nextState.lastSyncedAt).toBeNull()
    expect(result.prepared.nextState.settings.lastBackupAt).toBe(exportedAt)
    expect(result.prepared.nextState.settings.changesSinceBackup).toBe(0)
    expect(result.prepared.nextState.settings.lastReminderAt).toBeNull()
  })

  it('rejects invalid JSON safely', () => {
    const result = prepareBackupRestore('{not valid json')

    expect(result).toEqual({
      ok: false,
      message: 'This backup file is not valid.',
    })
  })

  it('rejects unsupported schema versions', () => {
    const result = prepareBackupRestore(
      JSON.stringify({
        schemaVersion: 99,
        exportedAt: '2026-03-19T09:30:00.000Z',
        app: 'Tally',
        data: {},
      }),
    )

    expect(result).toEqual({
      ok: false,
      message: 'This backup file uses an unsupported version.',
    })
  })

  it('rejects incomplete backup payloads', () => {
    const result = prepareBackupRestore(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: '2026-03-19T09:30:00.000Z',
        app: 'Tally',
        data: {
          transactions: [],
          categories: [],
        },
      }),
    )

    expect(result).toEqual({
      ok: false,
      message: 'This backup file is not valid.',
    })
  })

  it('rejects schema version 2 payloads that omit recurring templates', () => {
    const result = prepareBackupRestore(
      JSON.stringify({
        schemaVersion: 2,
        exportedAt: '2026-03-19T09:30:00.000Z',
        app: 'Tally',
        data: {
          transactions: [],
          categories: initialFinanceState.categories,
          budgets: [],
          preferences: {
            theme: 'dark',
            currency: 'USD',
            syncEndpoint: 'demo://local',
            conflictPolicy: 'client-wins',
          },
        },
      }),
    )

    expect(result).toEqual({
      ok: false,
      message: 'This backup file is not valid.',
    })
  })

  it('migrates schema version 1 backups by defaulting recurring templates to empty', () => {
    const result = prepareBackupRestore(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: '2026-03-19T09:30:00.000Z',
        app: 'Tally',
        data: {
          transactions: [
            {
              id: 'txn-legacy',
              type: 'expense',
              amount: 14,
              categoryId: 'cat-food',
              note: 'Coffee',
              occurredAt: '2026-03-18',
              createdAt: '2026-03-18T08:00:00.000Z',
              updatedAt: '2026-03-18T08:00:00.000Z',
              syncStatus: 'synced',
            },
          ],
          categories: initialFinanceState.categories,
          budgets: [],
          preferences: {
            theme: 'dark',
            currency: 'USD',
            syncEndpoint: 'demo://local',
            conflictPolicy: 'client-wins',
          },
        },
      }),
    )

    expect(result.ok).toBe(true)

    if (!result.ok) {
      return
    }

    expect(result.prepared.payload.schemaVersion).toBe(2)
    expect(result.prepared.nextState.recurringTemplates).toHaveLength(0)
    expect(result.prepared.nextState.transactions[0].recurringTemplateId).toBeNull()
  })

  it('returns a safe error when reading backup file fails', async () => {
    const unreadableFile = new File(['{}'], 'backup.json', {
      type: 'application/json',
    })
    vi.spyOn(unreadableFile, 'text').mockRejectedValue(new Error('unreadable file'))

    const result = await prepareBackupRestoreFile(unreadableFile)

    expect(result).toEqual({
      ok: false,
      message: 'This backup file is not valid.',
    })
  })
})