import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialFinanceState } from './default-data'
import type { Budget, FinanceState, Transaction, TransactionType } from './models'
import {
  getAvailableToBudgetForPeriod,
  getBudgetAllocationSummary,
  getRecentTransactions,
  getOverAllocatedAmountForPeriod,
  getTotalAllocatedBudgetLimitsForPeriod,
  getTotalIncomeForPeriod,
  previewAvailableToBudgetAfterBudgetChange,
} from './selectors'

function createTransaction(
  type: TransactionType,
  amount: number,
  occurredAt: string,
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id: overrides.id ?? `txn-${type}-${occurredAt}-${amount}`,
    type,
    amount,
    categoryId:
      overrides.categoryId ?? (type === 'income' ? 'cat-salary' : 'cat-food'),
    note: overrides.note ?? '',
    occurredAt,
    recurringTemplateId: overrides.recurringTemplateId ?? null,
    recurringOccurrenceDate: overrides.recurringOccurrenceDate ?? null,
    createdAt: overrides.createdAt ?? `${occurredAt}T09:00:00.000Z`,
    updatedAt: overrides.updatedAt ?? `${occurredAt}T09:00:00.000Z`,
  }
}

function createBudget(
  overrides: Partial<Budget & { active?: boolean }> = {},
): Budget {
  return {
    id: overrides.id ?? 'budget-food-2026-03',
    name: overrides.name ?? 'Food budget',
    categoryIds: overrides.categoryIds ?? ['cat-food'],
    monthKey: overrides.monthKey ?? '2026-03',
    limit: overrides.limit ?? 500,
    createdAt: overrides.createdAt ?? '2026-03-01T09:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-01T09:00:00.000Z',
    ...overrides,
  } as Budget
}

function createState(overrides: {
  transactions?: Transaction[]
  budgets?: Budget[]
} = {}): FinanceState {
  return {
    ...initialFinanceState,
    transactions: overrides.transactions ?? [],
    budgets: overrides.budgets ?? [],
  }
}

describe('budget allocation selectors', () => {
  it('calculates positive available-to-budget totals for a month', () => {
    const state = createState({
      transactions: [
        createTransaction('income', 2000, '2026-03-02'),
        createTransaction('income', 500, '2026-03-15', { id: 'txn-income-bonus' }),
      ],
      budgets: [createBudget({ limit: 1200 })],
    })

    expect(getTotalIncomeForPeriod(state, '2026-03')).toBe(2500)
    expect(getTotalAllocatedBudgetLimitsForPeriod(state, '2026-03')).toBe(1200)
    expect(getAvailableToBudgetForPeriod(state, '2026-03')).toBe(1300)
    expect(getOverAllocatedAmountForPeriod(state, '2026-03')).toBe(0)
  })

  it('calculates zero available-to-budget when income and allocations match', () => {
    const state = createState({
      transactions: [createTransaction('income', 2500, '2026-03-02')],
      budgets: [createBudget({ limit: 2500 })],
    })

    const summary = getBudgetAllocationSummary(state, '2026-03')

    expect(summary.availableToBudgetForPeriod).toBe(0)
    expect(summary.overAllocatedAmountForPeriod).toBe(0)
  })

  it('calculates over-allocation when budgets exceed income', () => {
    const state = createState({
      transactions: [createTransaction('income', 2500, '2026-03-02')],
      budgets: [createBudget({ limit: 2700 })],
    })

    const summary = getBudgetAllocationSummary(state, '2026-03')

    expect(summary.availableToBudgetForPeriod).toBe(-200)
    expect(summary.overAllocatedAmountForPeriod).toBe(200)
  })

  it('returns a neutral no-income state when no income or budgets exist', () => {
    const summary = getBudgetAllocationSummary(createState(), '2026-03')

    expect(summary.totalIncomeForPeriod).toBe(0)
    expect(summary.totalAllocatedBudgetLimitsForPeriod).toBe(0)
    expect(summary.availableToBudgetForPeriod).toBe(0)
    expect(summary.hasIncomeRecorded).toBe(false)
    expect(summary.hasAllocatedBudgets).toBe(false)
  })

  it('sums active budget limits only', () => {
    const state = createState({
      budgets: [
        createBudget({ id: 'budget-active', limit: 450 }),
        createBudget({ id: 'budget-inactive', limit: 900, active: false }),
      ],
    })

    expect(getTotalAllocatedBudgetLimitsForPeriod(state, '2026-03')).toBe(450)
  })

  it('calculates period income from income transactions only', () => {
    const state = createState({
      transactions: [
        createTransaction('income', 1000, '2026-03-02'),
        createTransaction('expense', 600, '2026-03-09', { id: 'txn-expense' }),
      ],
    })

    expect(getTotalIncomeForPeriod(state, '2026-03')).toBe(1000)
  })

  it('previews available-to-budget totals for a new budget draft', () => {
    const preview = previewAvailableToBudgetAfterBudgetChange({
      totalIncomeForPeriod: 2500,
      totalAllocatedBudgetLimitsForPeriod: 1200,
      draftLimit: 300,
    })

    expect(preview).toEqual({
      totalIncomeForPeriod: 2500,
      totalAllocatedBudgetLimitsForPeriod: 1500,
      availableToBudgetForPeriod: 1000,
      overAllocatedAmountForPeriod: 0,
    })
  })

  it('previews available-to-budget totals for an edited budget without double counting the old limit', () => {
    const preview = previewAvailableToBudgetAfterBudgetChange({
      totalIncomeForPeriod: 2500,
      totalAllocatedBudgetLimitsForPeriod: 1200,
      previousBudgetLimit: 200,
      draftLimit: 300,
    })

    expect(preview).toEqual({
      totalIncomeForPeriod: 2500,
      totalAllocatedBudgetLimitsForPeriod: 1300,
      availableToBudgetForPeriod: 1200,
      overAllocatedAmountForPeriod: 0,
    })
  })

  it('counts a multi-category budget only once', () => {
    const state = createState({
      transactions: [createTransaction('income', 2000, '2026-03-02')],
      budgets: [
        createBudget({
          id: 'budget-essentials',
          name: 'Essentials',
          categoryIds: ['cat-food', 'cat-transport'],
          limit: 600,
        }),
        createBudget({
          id: 'budget-home',
          name: 'Home',
          categoryIds: ['cat-housing'],
          limit: 400,
        }),
      ],
    })

    const summary = getBudgetAllocationSummary(state, '2026-03')

    expect(summary.totalAllocatedBudgetLimitsForPeriod).toBe(1000)
    expect(summary.availableToBudgetForPeriod).toBe(1000)
  })

  it('filters income and budget allocations by the selected period', () => {
    const state = createState({
      transactions: [
        createTransaction('income', 1000, '2026-03-02'),
        createTransaction('income', 700, '2026-04-04', { id: 'txn-income-april' }),
      ],
      budgets: [
        createBudget({ id: 'budget-march', monthKey: '2026-03', limit: 200 }),
        createBudget({ id: 'budget-april', monthKey: '2026-04', limit: 300 }),
      ],
    })

    expect(getBudgetAllocationSummary(state, '2026-03')).toMatchObject({
      totalIncomeForPeriod: 1000,
      totalAllocatedBudgetLimitsForPeriod: 200,
      availableToBudgetForPeriod: 800,
    })
    expect(getBudgetAllocationSummary(state, '2026-04')).toMatchObject({
      totalIncomeForPeriod: 700,
      totalAllocatedBudgetLimitsForPeriod: 300,
      availableToBudgetForPeriod: 400,
    })
  })
})

describe('getRecentTransactions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-11T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('excludes future transactions and keeps past/today sorted newest-first', () => {
    const state = createState({
      transactions: [
        createTransaction('expense', 15, '2026-04-12', {
          id: 'txn-future',
          createdAt: '2026-04-12T09:00:00.000Z',
        }),
        createTransaction('expense', 25, '2026-04-11', {
          id: 'txn-today',
          createdAt: '2026-04-11T10:00:00.000Z',
        }),
        createTransaction('expense', 35, '2026-04-10', {
          id: 'txn-past-late',
          createdAt: '2026-04-10T11:00:00.000Z',
        }),
        createTransaction('expense', 45, '2026-04-10', {
          id: 'txn-past-early',
          createdAt: '2026-04-10T08:00:00.000Z',
        }),
      ],
    })

    const recent = getRecentTransactions(state, 6)

    expect(recent.map((transaction) => transaction.id)).toEqual([
      'txn-today',
      'txn-past-late',
      'txn-past-early',
    ])
    expect(recent.every((transaction) => transaction.occurredAt <= '2026-04-11')).toBe(
      true,
    )
  })

  it('includes transactions dated exactly today', () => {
    const state = createState({
      transactions: [
        createTransaction('expense', 19, '2026-04-11', { id: 'txn-today' }),
      ],
    })

    const recent = getRecentTransactions(state, 1)

    expect(recent).toHaveLength(1)
    expect(recent[0]?.id).toBe('txn-today')
  })
})
