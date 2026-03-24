import { describe, expect, it } from 'vitest'
import type { FinanceState } from '../domain/models'
import { initialFinanceState } from '../domain/default-data'
import { computeCategoryDeletionPlan } from '../domain/category-service'
import { financeReducer } from './finance-reducer'

function cloneState(overrides: Partial<FinanceState> = {}): FinanceState {
  return {
    ...initialFinanceState,
    categories: [...initialFinanceState.categories],
    transactions: [],
    budgets: [],
    recurringTemplates: [],
    settings: {
      ...initialFinanceState.settings,
      changesSinceBackup: 0,
    },
    ...overrides,
  }
}

function findCategoryIdByName(name: string): string {
  const category = initialFinanceState.categories.find((entry) => entry.name === name)

  if (!category) {
    throw new Error(`Category ${name} is required for test fixtures.`)
  }

  return category.id
}

describe('financeReducer transaction flows', () => {
  it('rejects transactions with invalid amount or incompatible category', () => {
    const state = cloneState()
    const expenseCategoryId = findCategoryIdByName('Food')
    const incomeCategoryId = findCategoryIdByName('Salary')

    const nextStateInvalidAmount = financeReducer(state, {
      type: 'add-transaction',
      payload: {
        id: 'txn-invalid-amount',
        type: 'expense',
        amount: 0,
        categoryId: expenseCategoryId,
        note: 'Should fail',
        occurredAt: '2026-03-20',
        recurringTemplateId: null,
        recurringOccurrenceDate: null,
        createdAt: '2026-03-20T10:00:00.000Z',
        updatedAt: '2026-03-20T10:00:00.000Z',
      },
    })

    const nextStateIncompatibleCategory = financeReducer(state, {
      type: 'add-transaction',
      payload: {
        id: 'txn-invalid-category',
        type: 'expense',
        amount: 25,
        categoryId: incomeCategoryId,
        note: 'Should fail',
        occurredAt: '2026-03-20',
        recurringTemplateId: null,
        recurringOccurrenceDate: null,
        createdAt: '2026-03-20T10:00:00.000Z',
        updatedAt: '2026-03-20T10:00:00.000Z',
      },
    })

    expect(nextStateInvalidAmount).toBe(state)
    expect(nextStateIncompatibleCategory).toBe(state)
  })

  it('adds and deletes transactions', () => {
    const state = cloneState()
    const categoryId = findCategoryIdByName('Food')
    const transaction = {
      id: 'txn-1',
      type: 'expense' as const,
      amount: 42.5,
      categoryId,
      note: 'Lunch',
      occurredAt: '2026-03-20',
      recurringTemplateId: null,
      recurringOccurrenceDate: null,
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z',
    }

    const addedState = financeReducer(state, {
      type: 'add-transaction',
      payload: transaction,
    })

    expect(addedState.transactions).toHaveLength(1)
    expect(addedState.transactions[0]).toEqual(transaction)
    expect(addedState.settings.changesSinceBackup).toBe(1)

    const deletedState = financeReducer(addedState, {
      type: 'delete-transaction',
      payload: { id: transaction.id },
    })

    expect(deletedState.transactions).toEqual([])
    expect(deletedState.settings.changesSinceBackup).toBe(2)
  })

  it('updates an existing transaction', () => {
    const categoryId = findCategoryIdByName('Food')
    const baseTransaction = {
      id: 'txn-editable',
      type: 'expense' as const,
      amount: 10,
      categoryId,
      note: 'Before',
      occurredAt: '2026-03-20',
      recurringTemplateId: null,
      recurringOccurrenceDate: null,
      createdAt: '2026-03-20T08:00:00.000Z',
      updatedAt: '2026-03-20T08:00:00.000Z',
    }
    const state = cloneState({ transactions: [baseTransaction] })

    const nextState = financeReducer(state, {
      type: 'update-transaction',
      payload: {
        ...baseTransaction,
        amount: 25,
        note: 'After',
        updatedAt: '2026-03-20T09:00:00.000Z',
      },
    })

    expect(nextState.transactions).toHaveLength(1)
    expect(nextState.transactions[0]).toMatchObject({
      id: 'txn-editable',
      amount: 25,
      note: 'After',
    })
    expect(nextState.settings.changesSinceBackup).toBe(1)
  })
})

describe('financeReducer category and budget safety', () => {
  it('prevents category kind updates that break linked transactions', () => {
    const categoryId = findCategoryIdByName('Food')
    const category = initialFinanceState.categories.find(
      (entry) => entry.id === categoryId,
    )

    if (!category) {
      throw new Error('Food category fixture is required.')
    }

    const state = cloneState({
      transactions: [
        {
          id: 'txn-1',
          type: 'expense',
          amount: 35,
          categoryId,
          note: 'Groceries',
          occurredAt: '2026-03-20',
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-20T10:00:00.000Z',
        },
      ],
    })

    const nextState = financeReducer(state, {
      type: 'update-category',
      payload: {
        ...category,
        kind: 'income',
        updatedAt: '2026-03-21T10:00:00.000Z',
      },
    })

    expect(nextState).toBe(state)
  })

  it('deletes categories by applying reassignment plan to linked entities', () => {
    const foodId = findCategoryIdByName('Food')
    const transportId = findCategoryIdByName('Transport')

    const state = cloneState({
      transactions: [
        {
          id: 'txn-food',
          type: 'expense',
          amount: 22,
          categoryId: foodId,
          note: 'Dinner',
          occurredAt: '2026-03-20',
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-20T10:00:00.000Z',
        },
      ],
      recurringTemplates: [
        {
          id: 'rec-food',
          type: 'expense',
          amount: 20,
          categoryId: foodId,
          note: 'Meal plan',
          frequency: 'monthly',
          intervalDays: null,
          startDate: '2026-03-01',
          nextDueDate: '2026-04-01',
          active: true,
          createdAt: '2026-03-01T10:00:00.000Z',
          updatedAt: '2026-03-01T10:00:00.000Z',
        },
      ],
      budgets: [
        {
          id: 'budget-1',
          name: 'Food only',
          categoryIds: [foodId],
          monthKey: '2026-03',
          limit: 100,
          createdAt: '2026-03-01T10:00:00.000Z',
          updatedAt: '2026-03-01T10:00:00.000Z',
        },
      ],
    })

    const planResult = computeCategoryDeletionPlan(state, {
      categoryId: foodId,
      strategy: 'reassign',
      replacementCategoryId: transportId,
    })

    if (!planResult.ok) {
      throw new Error(planResult.message)
    }

    const nextState = financeReducer(state, {
      type: 'delete-category',
      payload: {
        plan: planResult.plan,
        updatedAt: '2026-03-21T10:00:00.000Z',
      },
    })

    expect(nextState.categories.some((entry) => entry.id === foodId)).toBe(false)
    expect(nextState.transactions[0]).toMatchObject({
      categoryId: transportId,
      updatedAt: '2026-03-21T10:00:00.000Z',
    })
    expect(nextState.recurringTemplates[0]).toMatchObject({
      categoryId: transportId,
      updatedAt: '2026-03-21T10:00:00.000Z',
    })
    expect(nextState.budgets[0]).toMatchObject({
      categoryIds: [transportId],
      updatedAt: '2026-03-21T10:00:00.000Z',
    })
    expect(nextState.settings.changesSinceBackup).toBe(1)
  })
})