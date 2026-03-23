import type { FinanceState } from '../../domain/models'
import type { FinanceAction } from '../finance-reducer-types'
import { isCategoryCompatible } from '../reducer-utils/category-compat'
import { recordMeaningfulChange } from '../reducer-utils/change-tracking'
import { queueOperation } from '../reducer-utils/queue'

type AddTransactionAction = Extract<FinanceAction, { type: 'add-transaction' }>
type UpdateTransactionAction = Extract<FinanceAction, { type: 'update-transaction' }>
type DeleteTransactionAction = Extract<FinanceAction, { type: 'delete-transaction' }>

export function handleAddTransaction(
  state: FinanceState,
  action: AddTransactionAction,
): FinanceState {
  if (action.payload.amount <= 0 || Number.isNaN(action.payload.amount)) {
    return state
  }

  const category = state.categories.find(
    (entry) => entry.id === action.payload.categoryId,
  )

  if (!category || !isCategoryCompatible(category, action.payload)) {
    return state
  }

  return recordMeaningfulChange({
    ...state,
    transactions: [action.payload, ...state.transactions],
    syncQueue: queueOperation(
      state.syncQueue,
      'transaction',
      'upsert',
      action.payload.id,
      action.payload,
    ),
  })
}

export function handleUpdateTransaction(
  state: FinanceState,
  action: UpdateTransactionAction,
): FinanceState {
  const existingTransaction = state.transactions.find(
    (transaction) => transaction.id === action.payload.id,
  )

  if (!existingTransaction) {
    return state
  }

  const category = state.categories.find(
    (entry) => entry.id === action.payload.categoryId,
  )

  if (!category || !isCategoryCompatible(category, action.payload)) {
    return state
  }

  return recordMeaningfulChange({
    ...state,
    transactions: state.transactions.map((transaction) =>
      transaction.id === action.payload.id ? action.payload : transaction,
    ),
    syncQueue: queueOperation(
      state.syncQueue,
      'transaction',
      'upsert',
      action.payload.id,
      action.payload,
    ),
  })
}

export function handleDeleteTransaction(
  state: FinanceState,
  action: DeleteTransactionAction,
): FinanceState {
  const existingTransaction = state.transactions.find(
    (transaction) => transaction.id === action.payload.id,
  )

  if (!existingTransaction) {
    return state
  }

  return recordMeaningfulChange({
    ...state,
    transactions: state.transactions.filter(
      (transaction) => transaction.id !== action.payload.id,
    ),
    syncQueue: queueOperation(
      state.syncQueue,
      'transaction',
      'delete',
      action.payload.id,
      null,
    ),
  })
}
