import type {
  Budget,
  Category,
  FinanceState,
  Transaction,
  TransactionType,
} from './models'

export interface OverviewTotals {
  balance: number
  income: number
  expense: number
}

export interface CategoryTotal {
  categoryId: string
  name: string
  color: string
  total: number
  count: number
}

export type BudgetTone = 'danger' | 'warning' | 'safe' | 'missing'

export interface BudgetSignal {
  budget: Budget | null
  category: Category
  spent: number
  limit: number
  remaining: number
  progress: number
  tone: BudgetTone
}

export interface MonthlyTrendPoint extends OverviewTotals {
  monthKey: string
}

export interface ComparisonOverview {
  current: OverviewTotals
  previous: OverviewTotals
  delta: OverviewTotals
}

function summarizeTransactions(transactions: Transaction[]): OverviewTotals {
  return transactions.reduce<OverviewTotals>(
    (summary, transaction) => {
      const amount = Math.abs(transaction.amount)

      if (transaction.type === 'income') {
        summary.income += amount
        summary.balance += amount
      } else {
        summary.expense += amount
        summary.balance -= amount
      }

      return summary
    },
    { balance: 0, income: 0, expense: 0 },
  )
}

function getTransactionsForMonthKeys(
  state: FinanceState,
  monthKeys: string[],
): Transaction[] {
  const monthKeySet = new Set(monthKeys)

  return state.transactions.filter((transaction) =>
    monthKeySet.has(transaction.occurredAt.slice(0, 7)),
  )
}

function buildCategoryTotals(
  transactions: Transaction[],
  categories: Category[],
  type: TransactionType,
): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>()
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  )

  transactions.forEach((transaction) => {
    if (transaction.type !== type) {
      return
    }

    const category = categoriesById.get(transaction.categoryId)

    if (!category) {
      return
    }

    const current = totals.get(category.id) ?? {
      categoryId: category.id,
      name: category.name,
      color: category.color,
      total: 0,
      count: 0,
    }

    current.total += Math.abs(transaction.amount)
    current.count += 1

    totals.set(category.id, current)
  })

  return [...totals.values()].sort((left, right) => right.total - left.total)
}

function getBudgetTone(limit: number, spent: number): BudgetTone {
  if (limit <= 0) {
    return 'missing'
  }

  const progress = spent / limit
  const remaining = limit - spent

  if (remaining < 0 || progress >= 1) {
    return 'danger'
  }

  if (progress >= 0.8) {
    return 'warning'
  }

  return 'safe'
}

export function getOverviewForTransactions(
  transactions: Transaction[],
): OverviewTotals {
  return summarizeTransactions(transactions)
}

export function getMonthKey(value: Date | string = new Date()): string {
  const date =
    typeof value === 'string' ? new Date(`${value}T12:00:00`) : value

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonthKey(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const shiftedDate = new Date(year, month - 1 + offset, 1)

  return getMonthKey(shiftedDate)
}

export function getPreviousMonthKey(monthKey: string): string {
  return shiftMonthKey(monthKey, -1)
}

export function getOverviewForMonthKeys(
  state: FinanceState,
  monthKeys: string[],
): OverviewTotals {
  return summarizeTransactions(getTransactionsForMonthKeys(state, monthKeys))
}

export function getMonthlyOverview(
  state: FinanceState,
  monthKey: string,
): OverviewTotals {
  return getOverviewForMonthKeys(state, [monthKey])
}

export function getSortedTransactions(
  transactions: Transaction[],
): Transaction[] {
  return [...transactions].sort((a, b) => {
    if (a.occurredAt === b.occurredAt) {
      return b.createdAt.localeCompare(a.createdAt)
    }

    return b.occurredAt.localeCompare(a.occurredAt)
  })
}

export function getRecentTransactions(
  state: FinanceState,
  limit = 5,
): Transaction[] {
  return getSortedTransactions(state.transactions).slice(0, limit)
}

export function getCategoryTotals(
  state: FinanceState,
  monthKey: string,
  type: TransactionType = 'expense',
): CategoryTotal[] {
  return getCategoryTotalsForMonthKeys(state, [monthKey], type)
}

export function getCategoryTotalsForMonthKeys(
  state: FinanceState,
  monthKeys: string[],
  type: TransactionType = 'expense',
): CategoryTotal[] {
  return buildCategoryTotals(
    getTransactionsForMonthKeys(state, monthKeys),
    state.categories,
    type,
  )
}

export function getMonthlyTrend(
  state: FinanceState,
  monthCount = 6,
): MonthlyTrendPoint[] {
  const currentMonthKey = getMonthKey()

  return Array.from({ length: monthCount }, (_, index) => {
    const monthKey = shiftMonthKey(currentMonthKey, index - (monthCount - 1))

    return {
      monthKey,
      ...getOverviewForMonthKeys(state, [monthKey]),
    }
  })
}

export function getBudgetSignals(
  state: FinanceState,
  monthKey: string,
) : BudgetSignal[] {
  const budgetsByCategoryId = new Map(
    state.budgets
      .filter((budget) => budget.monthKey === monthKey)
      .map((budget) => [budget.categoryId, budget]),
  )
  const spentByCategoryId = new Map(
    getCategoryTotals(state, monthKey, 'expense').map((entry) => [
      entry.categoryId,
      entry.total,
    ]),
  )

  return state.categories
    .filter((category) => category.kind !== 'income')
    .map((category) => {
      const budget = budgetsByCategoryId.get(category.id) ?? null
      const spent = spentByCategoryId.get(category.id) ?? 0
      const limit = budget?.limit ?? 0
      const remaining = limit - spent
      const progress = limit > 0 ? Math.min(spent / limit, 1.25) : 0

      return {
        budget,
        category,
        spent,
        limit,
        remaining,
        progress,
        tone: getBudgetTone(limit, spent),
      }
    })
    .sort((left, right) => {
      const toneOrder = { danger: 0, warning: 1, safe: 2, missing: 3 }
      const toneDifference = toneOrder[left.tone] - toneOrder[right.tone]

      if (toneDifference !== 0) {
        return toneDifference
      }

      if (left.tone === 'missing' && right.tone === 'missing') {
        if (right.spent !== left.spent) {
          return right.spent - left.spent
        }

        return left.category.name.localeCompare(right.category.name)
      }

      if (right.progress !== left.progress) {
        return right.progress - left.progress
      }

      if (right.spent !== left.spent) {
        return right.spent - left.spent
      }

      return left.category.name.localeCompare(right.category.name)
    })
}

export function getComparisonOverview(
  state: FinanceState,
  monthKey: string,
): ComparisonOverview {
  const current = getMonthlyOverview(state, monthKey)
  const previous = getMonthlyOverview(state, getPreviousMonthKey(monthKey))

  return {
    current,
    previous,
    delta: {
      balance: current.balance - previous.balance,
      income: current.income - previous.income,
      expense: current.expense - previous.expense,
    },
  }
}

export function getSyncSummary(state: FinanceState) {
  return {
    queued: state.syncQueue.length,
    pending: state.syncQueue.length,
    failed:
      state.transactions.filter((transaction) => transaction.syncStatus === 'failed')
        .length +
      state.categories.filter((category) => category.syncStatus === 'failed').length +
      state.budgets.filter((budget) => budget.syncStatus === 'failed').length,
  }
}
