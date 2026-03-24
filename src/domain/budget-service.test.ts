import { describe, expect, it } from 'vitest'
import { initialFinanceState } from './default-data'
import {
  computeBudgetSpending,
  getBudgetTargetableCategoryIds,
  isBudgetInputValid,
  normalizeBudgetCategoryIds,
  validateBudgetCategoryIds,
} from './budget-service'

describe('budget-service helpers', () => {
  it('normalizes category ids by trimming and removing duplicates', () => {
    expect(normalizeBudgetCategoryIds([' cat-food ', 'cat-food', '', 'cat-transport'])).toEqual([
      'cat-food',
      'cat-transport',
    ])
  })

  it('allows only managed non-income categories as budget targets', () => {
    const targetableIds = getBudgetTargetableCategoryIds(initialFinanceState.categories)

    expect(targetableIds.has('cat-food')).toBe(true)
    expect(targetableIds.has('cat-salary')).toBe(false)
    expect(targetableIds.has('cat-uncategorized')).toBe(false)
  })

  it('validates category ids against existing expense categories', () => {
    expect(
      validateBudgetCategoryIds(
        ['cat-food', 'cat-salary', 'cat-food', 'cat-transport'],
        initialFinanceState.categories,
      ),
    ).toEqual(['cat-food', 'cat-transport'])
  })

  it('validates budget input fields consistently', () => {
    expect(
      isBudgetInputValid(
        {
          name: 'Essentials',
          limit: 200,
          categoryIds: ['cat-food'],
        },
        initialFinanceState.categories,
      ),
    ).toBe(true)

    expect(
      isBudgetInputValid(
        {
          name: ' ',
          limit: 200,
          categoryIds: ['cat-food'],
        },
        initialFinanceState.categories,
      ),
    ).toBe(false)
  })

  it('computes budget spending from matching expense transactions only', () => {
    const spent = computeBudgetSpending(
      {
        categoryIds: ['cat-food', 'cat-transport'],
        monthKey: '2026-03',
      },
      [
        {
          id: 'txn-food',
          type: 'expense',
          amount: 20,
          categoryId: 'cat-food',
          note: '',
          occurredAt: '2026-03-02',
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-03-02T08:00:00.000Z',
          updatedAt: '2026-03-02T08:00:00.000Z',
        },
        {
          id: 'txn-income',
          type: 'income',
          amount: 100,
          categoryId: 'cat-salary',
          note: '',
          occurredAt: '2026-03-02',
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-03-02T08:00:00.000Z',
          updatedAt: '2026-03-02T08:00:00.000Z',
        },
        {
          id: 'txn-other-month',
          type: 'expense',
          amount: 40,
          categoryId: 'cat-food',
          note: '',
          occurredAt: '2026-04-01',
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-04-01T08:00:00.000Z',
          updatedAt: '2026-04-01T08:00:00.000Z',
        },
      ],
    )

    expect(spent).toBe(20)
  })
})