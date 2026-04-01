import { describe, expect, it } from 'vitest'
import { parsePersistedFinanceState } from './validation'
import { UNCATEGORIZED_CATEGORY_ID } from './categories'

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
        },
      ],
      transactions: [
        {
          id: 'txn-legacy',
          type: 'expense',
          amount: 12,
          categoryId: 'cat-food',
          note: 'Tea',
          occurredAt: '2026-03-01',
          createdAt: '2026-03-01T11:00:00.000Z',
          updatedAt: '2026-03-01T11:00:00.000Z',
        },
      ],
      budgets: [],
      settings: {
        theme: 'dark',
        currency: 'USD',
      },
    }

    const parsedState = parsePersistedFinanceState(legacyState)

    expect(parsedState).not.toBeNull()
    expect(parsedState?.settings.hasSeenPrivacyModal).toBe(true)
    expect(parsedState?.settings.backupRemindersEnabled).toBe(true)
    expect(parsedState?.settings.lastBackupAt).toBeNull()
    expect(parsedState?.settings.backupReminderBaselineAt).toBeNull()
    expect(parsedState?.settings.changesSinceBackup).toBe(0)
    expect(parsedState?.settings.lastReminderAt).toBeNull()
    expect(parsedState?.recurringTemplates).toEqual([])
    expect(parsedState?.transactions[0].recurringTemplateId).toBeNull()
    expect(parsedState?.transactions[0].recurringOccurrenceDate).toBeNull()
  })

  it('migrates legacy single-category budgets to categoryIds and infers names', () => {
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
        },
      ],
      transactions: [],
      budgets: [
        {
          id: 'budget-food-2026-03',
          categoryId: 'cat-food',
          monthKey: '2026-03',
          limit: 200,
          createdAt: '2026-03-01T10:00:00.000Z',
          updatedAt: '2026-03-01T10:00:00.000Z',
        },
      ],
      recurringTemplates: [],
      settings: {
        theme: 'dark',
        currency: 'USD',
      },
    }

    const parsedState = parsePersistedFinanceState(legacyState)

    expect(parsedState).not.toBeNull()
    expect(parsedState?.budgets).toHaveLength(1)
    expect(parsedState?.budgets[0].categoryIds).toEqual(['cat-food'])
    expect(parsedState?.budgets[0].name).toBe('Food')
    expect(parsedState?.categories.some((category) => category.id === UNCATEGORIZED_CATEGORY_ID)).toBe(true)
  })

  it('reassigns orphaned transaction and recurring category references to Uncategorized', () => {
    const legacyState = {
      categories: [
        {
          id: 'cat-food',
          name: 'Food',
          color: '#ff8b5f',
          kind: 'expense',
          system: null,
          createdAt: '2026-03-01T10:00:00.000Z',
          updatedAt: '2026-03-01T10:00:00.000Z',
        },
      ],
      transactions: [
        {
          id: 'txn-legacy',
          type: 'expense',
          amount: 12,
          categoryId: 'cat-missing',
          note: 'Tea',
          occurredAt: '2026-03-01',
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-03-01T11:00:00.000Z',
          updatedAt: '2026-03-01T11:00:00.000Z',
        },
      ],
      budgets: [],
      recurringTemplates: [
        {
          id: 'rec-legacy',
          type: 'expense',
          amount: 20,
          categoryId: 'cat-missing',
          note: 'Lunch plan',
          frequency: 'monthly',
          intervalDays: null,
          startDate: '2026-03-01',
          nextDueDate: '2026-04-01',
          active: true,
          createdAt: '2026-03-01T11:00:00.000Z',
          updatedAt: '2026-03-01T11:00:00.000Z',
        },
      ],
      settings: {
        theme: 'dark',
        currency: 'USD',
      },
    }

    const parsedState = parsePersistedFinanceState(legacyState)

    expect(parsedState).not.toBeNull()
    expect(parsedState?.transactions[0].categoryId).toBe(UNCATEGORIZED_CATEGORY_ID)
    expect(parsedState?.recurringTemplates[0].categoryId).toBe(UNCATEGORIZED_CATEGORY_ID)
  })
})