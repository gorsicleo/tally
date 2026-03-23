import { isSystemCategory } from '../domain/categories'
import type { Budget, FinanceState } from '../domain/models'
import type { FinanceAction } from './finance-reducer-types'
import {
  handleSetBudget,
  handleRemoveBudget,
} from './reducer-cases/budgets'
import {
  handleHydrate,
  handleReplaceState,
  handleSyncAttempt,
  handleUpdateSettings,
} from './reducer-cases/meta-settings'
import {
  handleAddTransaction,
  handleDeleteTransaction,
  handleUpdateTransaction,
} from './reducer-cases/transactions'
import {
  categoryKindSupportsRecurringTemplates,
  categoryKindSupportsTransactions,
  isCategoryCompatible,
} from './reducer-utils/category-compat'
import { recordMeaningfulChange } from './reducer-utils/change-tracking'
import {
  entityKey,
  queueBudgetUpserts,
  queueOperation,
  queueTransactionUpserts,
} from './reducer-utils/queue'
import { markEntityStatus } from './reducer-utils/sync-status'

export function financeReducer(
  state: FinanceState,
  action: FinanceAction,
): FinanceState {
  switch (action.type) {
    case 'hydrate':
      return handleHydrate(state, action)

    case 'replace-state':
      return handleReplaceState(state, action)

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
      return handleAddTransaction(state, action)
    }

    case 'update-transaction': {
      return handleUpdateTransaction(state, action)
    }

    case 'delete-transaction': {
      return handleDeleteTransaction(state, action)
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
      return handleSetBudget(state, action)
    }

    case 'remove-budget': {
      return handleRemoveBudget(state, action)
    }

    case 'update-settings':
      return handleUpdateSettings(state, action)

    case 'sync-attempt':
      return handleSyncAttempt(state, action)

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
