import { describe, expect, it } from 'vitest'
import { initialFinanceState } from './default-data'
import { UNCATEGORIZED_CATEGORY_ID } from './categories'
import { computeCategoryDeletionPlan } from './category-service'
import type { Budget, FinanceState, RecurringTemplate, Transaction } from './models'

function createState(overrides: {
  transactions?: Transaction[]
  recurringTemplates?: RecurringTemplate[]
  budgets?: Budget[]
} = {}): FinanceState {
  return {
    ...initialFinanceState,
    categories: [...initialFinanceState.categories],
    transactions: overrides.transactions ?? [],
    recurringTemplates: overrides.recurringTemplates ?? [],
    budgets: overrides.budgets ?? [],
  }
}

function categoryId(name: string): string {
  const category = initialFinanceState.categories.find((entry) => entry.name === name)

  if (!category) {
    throw new Error(`Missing category fixture: ${name}`)
  }

  return category.id
}

describe('computeCategoryDeletionPlan', () => {
  it('rejects deletion of system categories', () => {
    const result = computeCategoryDeletionPlan(createState(), {
      categoryId: UNCATEGORIZED_CATEGORY_ID,
      strategy: 'uncategorized',
    })

    expect(result).toEqual({
      ok: false,
      message: 'This category cannot be deleted.',
    })
  })

  it('requires replacement category when using reassign strategy', () => {
    const result = computeCategoryDeletionPlan(createState(), {
      categoryId: categoryId('Food'),
      strategy: 'reassign',
    })

    expect(result).toEqual({
      ok: false,
      message: 'Choose a replacement category before deleting.',
    })
  })

  it('rejects incompatible replacement categories for linked entries', () => {
    const foodId = categoryId('Food')
    const salaryId = categoryId('Salary')
    const state = createState({
      transactions: [
        {
          id: 'txn-food',
          type: 'expense',
          amount: 18,
          categoryId: foodId,
          note: 'Coffee',
          occurredAt: '2026-03-21',
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-03-21T08:00:00.000Z',
          updatedAt: '2026-03-21T08:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
    })

    const result = computeCategoryDeletionPlan(state, {
      categoryId: foodId,
      strategy: 'reassign',
      replacementCategoryId: salaryId,
    })

    expect(result).toEqual({
      ok: false,
      message: 'Replacement category is not compatible with linked entries.',
    })
  })

  it('builds uncategorized strategy plan and flags budgets that would be deleted', () => {
    const foodId = categoryId('Food')
    const state = createState({
      budgets: [
        {
          id: 'budget-food-only',
          name: 'Food',
          categoryIds: [foodId],
          monthKey: '2026-03',
          limit: 200,
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
    })

    const result = computeCategoryDeletionPlan(state, {
      categoryId: foodId,
      strategy: 'uncategorized',
    })

    expect(result.ok).toBe(true)

    if (!result.ok) {
      return
    }

    expect(result.plan.replacementCategoryId).toBe(UNCATEGORIZED_CATEGORY_ID)
    expect(result.plan.budgetOutcomes).toEqual([
      {
        budgetId: 'budget-food-only',
        nextCategoryIds: null,
        replacementAdded: false,
      },
    ])
    expect(result.plan.impact).toMatchObject({
      affectedBudgetCount: 1,
      budgetsDeletedCount: 1,
      budgetsKeepingCategoriesCount: 0,
      budgetsReassignedCount: 0,
    })
  })

  it('builds reassign plan without duplicating replacement category in budgets', () => {
    const foodId = categoryId('Food')
    const transportId = categoryId('Transport')
    const state = createState({
      budgets: [
        {
          id: 'budget-combined',
          name: 'Essentials',
          categoryIds: [foodId, transportId],
          monthKey: '2026-03',
          limit: 300,
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
      recurringTemplates: [
        {
          id: 'rec-food',
          type: 'expense',
          amount: 25,
          categoryId: foodId,
          note: 'Meal plan',
          frequency: 'monthly',
          intervalDays: null,
          startDate: '2026-03-01',
          nextDueDate: '2026-04-01',
          active: true,
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
    })

    const result = computeCategoryDeletionPlan(state, {
      categoryId: foodId,
      strategy: 'reassign',
      replacementCategoryId: transportId,
    })

    expect(result.ok).toBe(true)

    if (!result.ok) {
      return
    }

    expect(result.plan.recurringTemplateIds).toEqual(['rec-food'])
    expect(result.plan.budgetOutcomes).toEqual([
      {
        budgetId: 'budget-combined',
        nextCategoryIds: [transportId],
        replacementAdded: false,
      },
    ])
    expect(result.plan.impact).toMatchObject({
      affectedBudgetCount: 1,
      budgetsDeletedCount: 0,
      budgetsKeepingCategoriesCount: 1,
      budgetsReassignedCount: 0,
    })
  })
})