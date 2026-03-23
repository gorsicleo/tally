import { validateBudgetCategoryIds } from '../../domain/budget-service'
import type { Budget, FinanceState } from '../../domain/models'
import type { FinanceAction } from '../finance-reducer-types'
import { recordMeaningfulChange } from '../reducer-utils/change-tracking'

type SetBudgetAction = Extract<FinanceAction, { type: 'set-budget' }>
type RemoveBudgetAction = Extract<FinanceAction, { type: 'remove-budget' }>

export function handleSetBudget(
  state: FinanceState,
  action: SetBudgetAction,
): FinanceState {
  const normalizedName = action.payload.name.trim()
  const categoryIds = validateBudgetCategoryIds(
    action.payload.categoryIds,
    state.categories,
  )

  if (
    !normalizedName ||
    categoryIds.length === 0 ||
    !Number.isFinite(action.payload.limit) ||
    action.payload.limit <= 0
  ) {
    return state
  }

  const normalizedBudget: Budget = {
    ...action.payload,
    name: normalizedName,
    categoryIds,
  }

  const nextBudgets = state.budgets.some(
    (budget) => budget.id === normalizedBudget.id,
  )
    ? state.budgets.map((budget) =>
        budget.id === normalizedBudget.id ? normalizedBudget : budget,
      )
    : [...state.budgets, normalizedBudget]

  return recordMeaningfulChange({
    ...state,
    budgets: nextBudgets,
  })
}

export function handleRemoveBudget(
  state: FinanceState,
  action: RemoveBudgetAction,
): FinanceState {
  const existingBudget = state.budgets.find(
    (budget) => budget.id === action.payload.id,
  )

  if (!existingBudget) {
    return state
  }

  return recordMeaningfulChange({
    ...state,
    budgets: state.budgets.filter((budget) => budget.id !== action.payload.id),
  })
}
