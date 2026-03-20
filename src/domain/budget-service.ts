import { isSystemCategory } from './categories'
import type { Budget, Category, Transaction } from './models'

export function normalizeBudgetCategoryIds(categoryIds: string[]): string[] {
  const seen = new Set<string>()

  return categoryIds
    .map((entry) => entry.trim())
    .filter((entry) => {
      if (!entry || seen.has(entry)) {
        return false
      }

      seen.add(entry)
      return true
    })
}

export function getBudgetTargetableCategoryIds(categories: Category[]): Set<string> {
  return new Set(
    categories
      .filter((category) => !isSystemCategory(category) && category.kind !== 'income')
      .map((category) => category.id),
  )
}

export function validateBudgetCategoryIds(
  categoryIds: string[],
  categories: Category[],
): string[] {
  const targetableCategoryIds = getBudgetTargetableCategoryIds(categories)

  return normalizeBudgetCategoryIds(categoryIds).filter((categoryId) =>
    targetableCategoryIds.has(categoryId),
  )
}

export function isBudgetInputValid(
  input: {
    name: string
    limit: number
    categoryIds: string[]
  },
  categories: Category[],
): boolean {
  if (!input.name.trim()) {
    return false
  }

  if (!Number.isFinite(input.limit) || input.limit <= 0) {
    return false
  }

  return validateBudgetCategoryIds(input.categoryIds, categories).length > 0
}

export function computeBudgetSpending(
  budget: Pick<Budget, 'categoryIds' | 'monthKey'>,
  transactions: Transaction[],
): number {
  const categoryIdSet = new Set(budget.categoryIds)

  return transactions.reduce((sum, transaction) => {
    if (
      transaction.type !== 'expense' ||
      transaction.occurredAt.slice(0, 7) !== budget.monthKey ||
      !categoryIdSet.has(transaction.categoryId)
    ) {
      return sum
    }

    return sum + Math.abs(transaction.amount)
  }, 0)
}
