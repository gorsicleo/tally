import { createId } from '../utils/id'
import type {
  AppSettings,
  Budget,
  Category,
  CategoryKind,
  FinanceState,
  SyncQueueItem,
  Transaction,
} from '../domain/models'

type FinanceAction =
  | { type: 'hydrate'; payload: FinanceState }
  | { type: 'replace-state'; payload: FinanceState }
  | { type: 'add-category'; payload: Category }
  | { type: 'update-category'; payload: Category }
  | { type: 'delete-category'; payload: { id: string } }
  | { type: 'add-transaction'; payload: Transaction }
  | { type: 'update-transaction'; payload: Transaction }
  | { type: 'delete-transaction'; payload: { id: string } }
  | { type: 'set-budget'; payload: Budget }
  | { type: 'remove-budget'; payload: { id: string } }
  | { type: 'update-settings'; payload: Partial<AppSettings> }
  | { type: 'sync-attempt'; payload: { at: string } }
  | { type: 'sync-success'; payload: { at: string; operationIds: string[] } }
  | {
      type: 'sync-failure'
      payload: { at: string; operationIds: string[]; error: string }
    }

function isCategoryCompatible(category: Category, transaction: Transaction): boolean {
  return category.kind === 'both' || category.kind === transaction.type
}

function categoryKindSupportsTransactions(
  kind: CategoryKind,
  transactions: Transaction[],
): boolean {
  return transactions.every(
    (transaction) => kind === 'both' || transaction.type === kind,
  )
}

function entityKey(entityType: SyncQueueItem['entityType'], entityId: string): string {
  return `${entityType}:${entityId}`
}

function queueOperation(
  queue: SyncQueueItem[],
  entityType: SyncQueueItem['entityType'],
  action: SyncQueueItem['action'],
  entityId: string,
  payload: SyncQueueItem['payload'],
): SyncQueueItem[] {
  const nextOperation: SyncQueueItem = {
    id: createId('sync'),
    entityType,
    action,
    entityId,
    payload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  }

  return [
    ...queue.filter(
      (item) => !(item.entityType === entityType && item.entityId === entityId),
    ),
    nextOperation,
  ]
}

function queueBudgetDeletes(
  queue: SyncQueueItem[],
  budgets: Budget[],
): SyncQueueItem[] {
  return budgets.reduce(
    (nextQueue, budget) =>
      queueOperation(nextQueue, 'budget', 'delete', budget.id, null),
    queue,
  )
}

function markEntityStatus<T extends { id: string; syncStatus: string }>(
  items: T[],
  entityIds: Set<string>,
  syncStatus: 'synced' | 'pending' | 'failed',
): T[] {
  return items.map((item) =>
    entityIds.has(item.id) ? { ...item, syncStatus } : item,
  )
}

function recordMeaningfulChange(nextState: FinanceState): FinanceState {
  return {
    ...nextState,
    settings: {
      ...nextState.settings,
      changesSinceBackup: nextState.settings.changesSinceBackup + 1,
    },
  }
}

export function financeReducer(
  state: FinanceState,
  action: FinanceAction,
): FinanceState {
  switch (action.type) {
    case 'hydrate':
    case 'replace-state':
      return action.payload

    case 'add-category': {
      const normalizedName = action.payload.name.trim().toLowerCase()
      const alreadyExists = state.categories.some(
        (category) => category.name.trim().toLowerCase() === normalizedName,
      )

      if (!normalizedName || alreadyExists) {
        return state
      }

      return recordMeaningfulChange({
        ...state,
        categories: [...state.categories, action.payload],
        syncQueue: queueOperation(
          state.syncQueue,
          'category',
          'upsert',
          action.payload.id,
          action.payload,
        ),
      })
    }

    case 'update-category': {
      const existingCategory = state.categories.find(
        (category) => category.id === action.payload.id,
      )

      if (!existingCategory) {
        return state
      }

      const normalizedName = action.payload.name.trim().toLowerCase()
      const alreadyExists = state.categories.some(
        (category) =>
          category.id !== action.payload.id &&
          category.name.trim().toLowerCase() === normalizedName,
      )
      const linkedTransactions = state.transactions.filter(
        (transaction) => transaction.categoryId === action.payload.id,
      )

      if (
        !normalizedName ||
        alreadyExists ||
        !categoryKindSupportsTransactions(action.payload.kind, linkedTransactions)
      ) {
        return state
      }

      return recordMeaningfulChange({
        ...state,
        categories: state.categories.map((category) =>
          category.id === action.payload.id ? action.payload : category,
        ),
        syncQueue: queueOperation(
          state.syncQueue,
          'category',
          'upsert',
          action.payload.id,
          action.payload,
        ),
      })
    }

    case 'delete-category': {
      const existingCategory = state.categories.find(
        (category) => category.id === action.payload.id,
      )

      if (!existingCategory || existingCategory.isDefault) {
        return state
      }

      const hasTransactions = state.transactions.some(
        (transaction) => transaction.categoryId === action.payload.id,
      )

      if (hasTransactions) {
        return state
      }

      const relatedBudgets = state.budgets.filter(
        (budget) => budget.categoryId === action.payload.id,
      )

      return recordMeaningfulChange({
        ...state,
        categories: state.categories.filter(
          (category) => category.id !== action.payload.id,
        ),
        budgets: state.budgets.filter(
          (budget) => budget.categoryId !== action.payload.id,
        ),
        syncQueue: queueBudgetDeletes(
          queueOperation(
            state.syncQueue,
            'category',
            'delete',
            action.payload.id,
            null,
          ),
          relatedBudgets,
        ),
      })
    }

    case 'add-transaction': {
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

    case 'update-transaction': {
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

    case 'delete-transaction': {
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

    case 'set-budget': {
      const categoryExists = state.categories.some(
        (category) => category.id === action.payload.categoryId,
      )

      if (!categoryExists || action.payload.limit <= 0) {
        return state
      }

      const nextBudgets = state.budgets.some(
        (budget) => budget.id === action.payload.id,
      )
        ? state.budgets.map((budget) =>
            budget.id === action.payload.id ? action.payload : budget,
          )
        : [...state.budgets, action.payload]

      return recordMeaningfulChange({
        ...state,
        budgets: nextBudgets,
        syncQueue: queueOperation(
          state.syncQueue,
          'budget',
          'upsert',
          action.payload.id,
          action.payload,
        ),
      })
    }

    case 'remove-budget': {
      const existingBudget = state.budgets.find(
        (budget) => budget.id === action.payload.id,
      )

      if (!existingBudget) {
        return state
      }

      return recordMeaningfulChange({
        ...state,
        budgets: state.budgets.filter((budget) => budget.id !== action.payload.id),
        syncQueue: queueOperation(
          state.syncQueue,
          'budget',
          'delete',
          action.payload.id,
          null,
        ),
      })
    }

    case 'update-settings':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
      }

    case 'sync-attempt':
      return {
        ...state,
        lastSyncAttemptAt: action.payload.at,
      }

    case 'sync-success': {
      const appliedIds = new Set(action.payload.operationIds)
      const appliedOperations = state.syncQueue.filter((operation) =>
        appliedIds.has(operation.id),
      )
      const remainingQueue = state.syncQueue.filter(
        (operation) => !appliedIds.has(operation.id),
      )
      const appliedTransactions = new Set(
        appliedOperations
          .filter((operation) => operation.entityType === 'transaction')
          .map((operation) => operation.entityId),
      )
      const appliedCategories = new Set(
        appliedOperations
          .filter((operation) => operation.entityType === 'category')
          .map((operation) => operation.entityId),
      )
      const appliedBudgets = new Set(
        appliedOperations
          .filter((operation) => operation.entityType === 'budget')
          .map((operation) => operation.entityId),
      )
      const stillQueued = new Set(
        remainingQueue.map((operation) => entityKey(operation.entityType, operation.entityId)),
      )

      return {
        ...state,
        transactions: markEntityStatus(
          state.transactions,
          new Set(
            [...appliedTransactions].filter(
              (id) => !stillQueued.has(entityKey('transaction', id)),
            ),
          ),
          'synced',
        ),
        categories: markEntityStatus(
          state.categories,
          new Set(
            [...appliedCategories].filter(
              (id) => !stillQueued.has(entityKey('category', id)),
            ),
          ),
          'synced',
        ),
        budgets: markEntityStatus(
          state.budgets,
          new Set(
            [...appliedBudgets].filter(
              (id) => !stillQueued.has(entityKey('budget', id)),
            ),
          ),
          'synced',
        ),
        syncQueue: remainingQueue,
        lastSyncedAt: action.payload.at,
        lastSyncError: null,
      }
    }

    case 'sync-failure': {
      const failedIds = new Set(action.payload.operationIds)
      const failedOperations = state.syncQueue.filter((operation) =>
        failedIds.has(operation.id),
      )
      const failedTransactions = new Set(
        failedOperations
          .filter((operation) => operation.entityType === 'transaction')
          .map((operation) => operation.entityId),
      )
      const failedCategories = new Set(
        failedOperations
          .filter((operation) => operation.entityType === 'category')
          .map((operation) => operation.entityId),
      )
      const failedBudgets = new Set(
        failedOperations
          .filter((operation) => operation.entityType === 'budget')
          .map((operation) => operation.entityId),
      )

      return {
        ...state,
        transactions: markEntityStatus(state.transactions, failedTransactions, 'failed'),
        categories: markEntityStatus(state.categories, failedCategories, 'failed'),
        budgets: markEntityStatus(state.budgets, failedBudgets, 'failed'),
        syncQueue: state.syncQueue.map((operation) =>
          failedIds.has(operation.id)
            ? { ...operation, attempts: operation.attempts + 1 }
            : operation,
        ),
        lastSyncAttemptAt: action.payload.at,
        lastSyncError: action.payload.error,
      }
    }

    default:
      return state
  }
}
