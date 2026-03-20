import { createId } from '../utils/id'
import { isSystemCategory } from '../domain/categories'
import { validateBudgetCategoryIds } from '../domain/budget-service'
import type { CategoryDeletionPlan } from '../domain/category-service'
import type {
  AppSettings,
  Budget,
  Category,
  CategoryKind,
  FinanceState,
  RecurringTemplate,
  SyncQueueItem,
  Transaction,
} from '../domain/models'

type FinanceAction =
  | { type: 'hydrate'; payload: FinanceState }
  | { type: 'replace-state'; payload: FinanceState }
  | { type: 'add-category'; payload: Category }
  | { type: 'update-category'; payload: Category }
  | {
      type: 'delete-category'
      payload: { plan: CategoryDeletionPlan; updatedAt: string }
    }
  | { type: 'add-transaction'; payload: Transaction }
  | { type: 'update-transaction'; payload: Transaction }
  | { type: 'delete-transaction'; payload: { id: string } }
  | { type: 'add-recurring-template'; payload: RecurringTemplate }
  | { type: 'update-recurring-template'; payload: RecurringTemplate }
  | { type: 'stop-recurring-template'; payload: { id: string; updatedAt: string } }
  | {
      type: 'add-recurring-occurrences'
      payload: {
        templateId: string
        transactions: Transaction[]
        nextDueDate: string
        updatedAt: string
      }
    }
  | {
      type: 'skip-recurring-occurrences'
      payload: {
        templateId: string
        nextDueDate: string
        updatedAt: string
      }
    }
  | { type: 'set-budget'; payload: Budget }
  | { type: 'remove-budget'; payload: { id: string } }
  | { type: 'update-settings'; payload: Partial<AppSettings> }
  | { type: 'sync-attempt'; payload: { at: string } }
  | { type: 'sync-success'; payload: { at: string; operationIds: string[] } }
  | {
      type: 'sync-failure'
      payload: { at: string; operationIds: string[]; error: string }
    }

function isCategoryCompatible(
  category: Category,
  entry: Pick<Transaction, 'type'>,
): boolean {
  return category.kind === 'both' || category.kind === entry.type
}

function categoryKindSupportsTransactions(
  kind: CategoryKind,
  transactions: Transaction[],
): boolean {
  return transactions.every(
    (transaction) => kind === 'both' || transaction.type === kind,
  )
}

function categoryKindSupportsRecurringTemplates(
  kind: CategoryKind,
  recurringTemplates: RecurringTemplate[],
): boolean {
  return recurringTemplates.every(
    (template) => kind === 'both' || template.type === kind,
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

function queueTransactionUpserts(
  queue: SyncQueueItem[],
  transactions: Transaction[],
): SyncQueueItem[] {
  return transactions.reduce(
    (nextQueue, transaction) =>
      queueOperation(
        nextQueue,
        'transaction',
        'upsert',
        transaction.id,
        transaction,
      ),
    queue,
  )
}

function queueBudgetUpserts(
  queue: SyncQueueItem[],
  budgets: Budget[],
): SyncQueueItem[] {
  return budgets.reduce(
    (nextQueue, budget) =>
      queueOperation(nextQueue, 'budget', 'upsert', budget.id, budget),
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

      if (!existingCategory || isSystemCategory(existingCategory)) {
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
      const linkedRecurringTemplates = state.recurringTemplates.filter(
        (template) =>
          template.categoryId === action.payload.id && template.active,
      )
      const linkedBudgets = state.budgets.filter((budget) =>
        budget.categoryIds.includes(action.payload.id),
      )

      if (
        !normalizedName ||
        alreadyExists ||
        (action.payload.kind === 'income' && linkedBudgets.length > 0) ||
        !categoryKindSupportsTransactions(action.payload.kind, linkedTransactions) ||
        !categoryKindSupportsRecurringTemplates(
          action.payload.kind,
          linkedRecurringTemplates,
        )
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
      const { plan, updatedAt } = action.payload
      const existingCategory = state.categories.find(
        (category) => category.id === plan.categoryId,
      )
      const replacementCategory = state.categories.find(
        (category) => category.id === plan.replacementCategoryId,
      )

      if (
        !existingCategory ||
        isSystemCategory(existingCategory) ||
        !replacementCategory
      ) {
        return state
      }

      const transactionIdSet = new Set(plan.transactionIds)
      const recurringTemplateIdSet = new Set(plan.recurringTemplateIds)
      const budgetOutcomeById = new Map(
        plan.budgetOutcomes.map((outcome) => [outcome.budgetId, outcome]),
      )

      const nextTransactions = state.transactions.map((transaction) =>
        transactionIdSet.has(transaction.id)
          ? {
              ...transaction,
              categoryId: replacementCategory.id,
              updatedAt,
              syncStatus: 'pending' as const,
            }
          : transaction,
      )
      const reassignedTransactions = nextTransactions.filter((transaction) =>
        transactionIdSet.has(transaction.id),
      )

      const nextRecurringTemplates = state.recurringTemplates.map((template) =>
        recurringTemplateIdSet.has(template.id)
          ? {
              ...template,
              categoryId: replacementCategory.id,
              updatedAt,
            }
          : template,
      )

      const reassignedBudgets: Budget[] = []
      const deletedBudgetIds: string[] = []
      const nextBudgets = state.budgets.flatMap((budget) => {
        const outcome = budgetOutcomeById.get(budget.id)

        if (!outcome) {
          return budget
        }

        if (outcome.nextCategoryIds === null) {
          deletedBudgetIds.push(budget.id)
          return []
        }

        const nextBudget: Budget = {
          ...budget,
          categoryIds: outcome.nextCategoryIds,
          updatedAt,
          syncStatus: 'pending',
        }

        reassignedBudgets.push(nextBudget)
        return nextBudget
      })

      let nextSyncQueue = queueOperation(
        state.syncQueue,
        'category',
        'delete',
        existingCategory.id,
        null,
      )

      nextSyncQueue = queueTransactionUpserts(nextSyncQueue, reassignedTransactions)
      nextSyncQueue = queueBudgetUpserts(nextSyncQueue, reassignedBudgets)
      nextSyncQueue = deletedBudgetIds.reduce(
        (queue, budgetId) =>
          queueOperation(queue, 'budget', 'delete', budgetId, null),
        nextSyncQueue,
      )

      return recordMeaningfulChange({
        ...state,
        transactions: nextTransactions,
        recurringTemplates: nextRecurringTemplates,
        categories: state.categories.filter(
          (category) => category.id !== existingCategory.id,
        ),
        budgets: nextBudgets,
        syncQueue: nextSyncQueue,
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

    case 'add-recurring-template': {
      const category = state.categories.find(
        (entry) => entry.id === action.payload.categoryId,
      )

      if (
        !category ||
        !isCategoryCompatible(category, action.payload) ||
        action.payload.amount <= 0
      ) {
        return state
      }

      return recordMeaningfulChange({
        ...state,
        recurringTemplates: [action.payload, ...state.recurringTemplates],
      })
    }

    case 'update-recurring-template': {
      const existingTemplate = state.recurringTemplates.find(
        (template) => template.id === action.payload.id,
      )
      const category = state.categories.find(
        (entry) => entry.id === action.payload.categoryId,
      )

      if (
        !existingTemplate ||
        !category ||
        !isCategoryCompatible(category, action.payload) ||
        action.payload.amount <= 0
      ) {
        return state
      }

      return recordMeaningfulChange({
        ...state,
        recurringTemplates: state.recurringTemplates.map((template) =>
          template.id === action.payload.id ? action.payload : template,
        ),
      })
    }

    case 'stop-recurring-template': {
      const existingTemplate = state.recurringTemplates.find(
        (template) => template.id === action.payload.id,
      )

      if (!existingTemplate || !existingTemplate.active) {
        return state
      }

      return recordMeaningfulChange({
        ...state,
        recurringTemplates: state.recurringTemplates.map((template) =>
          template.id === action.payload.id
            ? {
                ...template,
                active: false,
                updatedAt: action.payload.updatedAt,
              }
            : template,
        ),
      })
    }

    case 'add-recurring-occurrences': {
      const existingTemplate = state.recurringTemplates.find(
        (template) => template.id === action.payload.templateId,
      )

      if (!existingTemplate || !existingTemplate.active || action.payload.transactions.length === 0) {
        return state
      }

      return recordMeaningfulChange({
        ...state,
        transactions: [...action.payload.transactions, ...state.transactions],
        recurringTemplates: state.recurringTemplates.map((template) =>
          template.id === action.payload.templateId
            ? {
                ...template,
                nextDueDate: action.payload.nextDueDate,
                updatedAt: action.payload.updatedAt,
              }
            : template,
        ),
        syncQueue: queueTransactionUpserts(state.syncQueue, action.payload.transactions),
      })
    }

    case 'skip-recurring-occurrences': {
      const existingTemplate = state.recurringTemplates.find(
        (template) => template.id === action.payload.templateId,
      )

      if (!existingTemplate || !existingTemplate.active) {
        return state
      }

      return recordMeaningfulChange({
        ...state,
        recurringTemplates: state.recurringTemplates.map((template) =>
          template.id === action.payload.templateId
            ? {
                ...template,
                nextDueDate: action.payload.nextDueDate,
                updatedAt: action.payload.updatedAt,
              }
            : template,
        ),
      })
    }

    case 'set-budget': {
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
        syncQueue: queueOperation(
          state.syncQueue,
          'budget',
          'upsert',
          normalizedBudget.id,
          normalizedBudget,
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
