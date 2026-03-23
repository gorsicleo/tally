import {
  UNCATEGORIZED_CATEGORY_ID,
  isSystemCategory,
} from './categories'
import { normalizeBudgetCategoryIds } from './budget-service'
import type {
  Budget,
  Category,
  RecurringTemplate,
  Transaction,
} from './models'

export type CategoryDeletionStrategy = 'reassign' | 'uncategorized'

export interface CategoryDeletionPlanInput {
  categoryId: string
  strategy: CategoryDeletionStrategy
  replacementCategoryId?: string | null
}

export interface CategoryDeletionImpact {
  categoryId: string
  categoryName: string
  strategy: CategoryDeletionStrategy
  replacementCategoryId: string
  replacementCategoryName: string
  transactionCount: number
  recurringTemplateCount: number
  affectedBudgetCount: number
  budgetsKeepingCategoriesCount: number
  budgetsDeletedCount: number
  budgetsReassignedCount: number
}

interface BudgetDeletionOutcome {
  budgetId: string
  nextCategoryIds: string[] | null
  replacementAdded: boolean
}

export interface CategoryDeletionPlan {
  categoryId: string
  replacementCategoryId: string
  strategy: CategoryDeletionStrategy
  transactionIds: string[]
  recurringTemplateIds: string[]
  budgetOutcomes: BudgetDeletionOutcome[]
  impact: CategoryDeletionImpact
}

export type CategoryDeletionPlanResult =
  | { ok: true; plan: CategoryDeletionPlan }
  | { ok: false; message: string }

interface CategoryDeletionStateLike {
  categories: Category[]
  transactions: Transaction[]
  recurringTemplates: RecurringTemplate[]
  budgets: Budget[]
}

function categorySupportsType(
  category: Pick<Category, 'kind'>,
  type: 'income' | 'expense',
): boolean {
  return category.kind === 'both' || category.kind === type
}

function resolveReplacementCategory(
  state: CategoryDeletionStateLike,
  input: CategoryDeletionPlanInput,
): { category: Category; message: null } | { category: null; message: string } {
  if (input.strategy === 'uncategorized') {
    const uncategorized =
      state.categories.find((category) => category.id === UNCATEGORIZED_CATEGORY_ID) ??
      null

    if (!uncategorized) {
      return {
        category: null,
        message: 'Uncategorized category is missing.',
      }
    }

    return { category: uncategorized, message: null }
  }

  if (!input.replacementCategoryId) {
    return {
      category: null,
      message: 'Choose a replacement category before deleting.',
    }
  }

  if (input.replacementCategoryId === input.categoryId) {
    return {
      category: null,
      message: 'Replacement category must be different.',
    }
  }

  const replacementCategory =
    state.categories.find((category) => category.id === input.replacementCategoryId) ??
    null

  if (!replacementCategory || isSystemCategory(replacementCategory)) {
    return {
      category: null,
      message: 'Replacement category no longer exists.',
    }
  }

  const hasIncompatibleLinkedEntries =
    state.transactions.some(
      (transaction) =>
        transaction.categoryId === input.categoryId &&
        !categorySupportsType(replacementCategory, transaction.type),
    ) ||
    state.recurringTemplates.some(
      (template) =>
        template.categoryId === input.categoryId &&
        !categorySupportsType(replacementCategory, template.type),
    )

  if (hasIncompatibleLinkedEntries) {
    return {
      category: null,
      message: 'Replacement category is not compatible with linked entries.',
    }
  }

  return { category: replacementCategory, message: null }
}

function getBudgetOutcomes(
  budgets: Budget[],
  input: CategoryDeletionPlanInput,
  replacementCategoryId: string,
): BudgetDeletionOutcome[] {
  return budgets
    .filter((budget) => budget.categoryIds.includes(input.categoryId))
    .map((budget) => {
      let nextCategoryIds = budget.categoryIds.filter(
        (categoryId) => categoryId !== input.categoryId,
      )
      let replacementAdded = false

      if (input.strategy === 'reassign') {
        if (!nextCategoryIds.includes(replacementCategoryId)) {
          nextCategoryIds = [...nextCategoryIds, replacementCategoryId]
          replacementAdded = true
        }
      }

      const normalizedCategoryIds = normalizeBudgetCategoryIds(nextCategoryIds)

      return {
        budgetId: budget.id,
        nextCategoryIds: normalizedCategoryIds.length > 0 ? normalizedCategoryIds : null,
        replacementAdded,
      }
    })
}

export function computeCategoryDeletionPlan(
  state: CategoryDeletionStateLike,
  input: CategoryDeletionPlanInput,
): CategoryDeletionPlanResult {
  const category =
    state.categories.find((entry) => entry.id === input.categoryId) ?? null

  if (!category) {
    return { ok: false, message: 'Category was not found.' }
  }

  if (isSystemCategory(category)) {
    return { ok: false, message: 'This category cannot be deleted.' }
  }

  const replacementResolution = resolveReplacementCategory(state, input)

  if (!replacementResolution.category) {
    return { ok: false, message: replacementResolution.message }
  }

  const replacementCategory = replacementResolution.category
  const transactionIds = state.transactions
    .filter((transaction) => transaction.categoryId === input.categoryId)
    .map((transaction) => transaction.id)
  const recurringTemplateIds = state.recurringTemplates
    .filter((template) => template.categoryId === input.categoryId)
    .map((template) => template.id)
  const budgetOutcomes = getBudgetOutcomes(
    state.budgets,
    input,
    replacementCategory.id,
  )

  const budgetsDeletedCount = budgetOutcomes.filter(
    (entry) => entry.nextCategoryIds === null,
  ).length
  const budgetsKeepingCategoriesCount =
    budgetOutcomes.length - budgetsDeletedCount
  const budgetsReassignedCount = budgetOutcomes.filter(
    (entry) => entry.replacementAdded,
  ).length

  return {
    ok: true,
    plan: {
      categoryId: category.id,
      replacementCategoryId: replacementCategory.id,
      strategy: input.strategy,
      transactionIds,
      recurringTemplateIds,
      budgetOutcomes,
      impact: {
        categoryId: category.id,
        categoryName: category.name,
        strategy: input.strategy,
        replacementCategoryId: replacementCategory.id,
        replacementCategoryName: replacementCategory.name,
        transactionCount: transactionIds.length,
        recurringTemplateCount: recurringTemplateIds.length,
        affectedBudgetCount: budgetOutcomes.length,
        budgetsKeepingCategoriesCount,
        budgetsDeletedCount,
        budgetsReassignedCount,
      },
    },
  }
}
