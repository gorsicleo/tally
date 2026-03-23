import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { initialFinanceState } from '../domain/default-data'
import { validateBudgetCategoryIds } from '../domain/budget-service'
import {
  computeCategoryDeletionPlan,
  type CategoryDeletionPlanInput,
} from '../domain/category-service'
import {
  advanceRecurringNextDueDate,
  getProcessibleRecurringDates,
  isRecurringIntervalValid,
} from '../domain/recurring'
import type { BackupPreferences, ThemeMode } from '../domain/models'
import { loadFinanceState, saveFinanceState } from '../persistence/finance-storage'
import { createId } from '../utils/id'
import { financeReducer } from './finance-reducer'
import {
  FinanceContext,
  type AddCategoryInput,
  type AddRecurringTemplateInput,
  type AddTransactionInput,
  type ApplyRecurringOccurrencesInput,
  type UpsertBudgetInput,
  type UpdateRecurringTemplateInput,
  type UpdateCategoryInput,
  type UpdateTransactionInput,
} from './finance-store'

export function FinanceProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(financeReducer, initialFinanceState)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') {
      return false
    }

    return navigator.onLine
  })
  const [isSyncing, setIsSyncing] = useState(false)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    let isCancelled = false

    void loadFinanceState().then((storedState) => {
      if (isCancelled) {
        return
      }

      if (storedState) {
        dispatch({ type: 'hydrate', payload: storedState })
      }

      setIsLoaded(true)
    })

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    void saveFinanceState(state).catch(() => {
      // Routine persistence failures are surfaced on explicit restore actions.
    })
  }, [isLoaded, state])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const resolveTheme = () =>
      state.settings.theme === 'auto'
        ? media.matches
          ? 'dark'
          : 'light'
        : state.settings.theme
    const applyTheme = () => {
      const resolvedTheme = resolveTheme()
      root.dataset.theme = resolvedTheme
      root.style.colorScheme = resolvedTheme
    }

    applyTheme()

    if (state.settings.theme !== 'auto') {
      return
    }

    const handleChange = () => {
      applyTheme()
    }

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange)
      return () => {
        media.removeEventListener('change', handleChange)
      }
    }

    media.addListener(handleChange)
    return () => {
      media.removeListener(handleChange)
    }
  }, [state.settings.theme])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const addCategory = useCallback((input: AddCategoryInput) => {
    const timestamp = new Date().toISOString()

    dispatch({
      type: 'add-category',
      payload: {
        id: createId('cat'),
        name: input.name.trim(),
        color: input.color,
        kind: input.kind,
        system: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
      },
    })
  }, [])

  const updateCategory = useCallback((input: UpdateCategoryInput) => {
    const existingCategory = stateRef.current.categories.find(
      (category) => category.id === input.id,
    )

    if (!existingCategory) {
      return
    }

    dispatch({
      type: 'update-category',
      payload: {
        ...existingCategory,
        name: input.name.trim(),
        color: input.color,
        kind: input.kind,
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      },
    })
  }, [])

  const previewCategoryDeletion = useCallback(
    (input: CategoryDeletionPlanInput) =>
      computeCategoryDeletionPlan(stateRef.current, input),
    [],
  )

  const deleteCategory = useCallback((input: CategoryDeletionPlanInput) => {
    const planResult = computeCategoryDeletionPlan(stateRef.current, input)

    if (!planResult.ok) {
      return planResult.message
    }

    dispatch({
      type: 'delete-category',
      payload: {
        plan: planResult.plan,
        updatedAt: new Date().toISOString(),
      },
    })

    return null
  }, [])

  const addTransaction = useCallback((input: AddTransactionInput) => {
    const timestamp = new Date().toISOString()

    dispatch({
      type: 'add-transaction',
      payload: {
        id: createId('txn'),
        type: input.type,
        amount: Math.abs(input.amount),
        categoryId: input.categoryId,
        note: input.note.trim(),
        occurredAt: input.occurredAt,
        recurringTemplateId: input.recurringTemplateId ?? null,
        recurringOccurrenceDate: input.recurringOccurrenceDate ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
      },
    })
  }, [])

  const updateTransaction = useCallback((input: UpdateTransactionInput) => {
    const existingTransaction = stateRef.current.transactions.find(
      (transaction) => transaction.id === input.id,
    )

    if (!existingTransaction) {
      return
    }

    dispatch({
      type: 'update-transaction',
      payload: {
        ...existingTransaction,
        type: input.type,
        amount: Math.abs(input.amount),
        categoryId: input.categoryId,
        note: input.note.trim(),
        occurredAt: input.occurredAt,
        recurringTemplateId:
          input.recurringTemplateId ?? existingTransaction.recurringTemplateId ?? null,
        recurringOccurrenceDate:
          input.recurringOccurrenceDate ??
          existingTransaction.recurringOccurrenceDate ??
          null,
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      },
    })
  }, [])

  const deleteTransaction = useCallback((transactionId: string) => {
    dispatch({ type: 'delete-transaction', payload: { id: transactionId } })
  }, [])

  const addRecurringTemplate = useCallback(
    (input: AddRecurringTemplateInput) => {
      const category = stateRef.current.categories.find(
        (entry) => entry.id === input.categoryId,
      )

      if (
        !category ||
        (category.kind !== 'both' && category.kind !== input.type) ||
        input.amount <= 0 ||
        !isRecurringIntervalValid(input.frequency, input.intervalDays)
      ) {
        return null
      }

      const timestamp = new Date().toISOString()
      const recurringTemplateId = createId('rec')

      dispatch({
        type: 'add-recurring-template',
        payload: {
          id: recurringTemplateId,
          type: input.type,
          amount: Math.abs(input.amount),
          categoryId: input.categoryId,
          note: input.note.trim(),
          frequency: input.frequency,
          intervalDays:
            input.frequency === 'custom'
              ? Math.floor(input.intervalDays ?? 1)
              : null,
          startDate: input.startDate,
          nextDueDate: input.nextDueDate,
          active: true,
          createdAt: timestamp,
          updatedAt: timestamp,
          syncStatus: 'synced',
        },
      })

      return recurringTemplateId
    },
    [],
  )

  const updateRecurringTemplate = useCallback((input: UpdateRecurringTemplateInput) => {
    const existingTemplate = stateRef.current.recurringTemplates.find(
      (template) => template.id === input.id,
    )

    if (!existingTemplate || !isRecurringIntervalValid(input.frequency, input.intervalDays)) {
      return
    }

    dispatch({
      type: 'update-recurring-template',
      payload: {
        ...existingTemplate,
        type: input.type,
        amount: Math.abs(input.amount),
        categoryId: input.categoryId,
        note: input.note.trim(),
        frequency: input.frequency,
        intervalDays:
          input.frequency === 'custom'
            ? Math.floor(input.intervalDays ?? 1)
            : null,
        startDate: input.startDate,
        nextDueDate: input.nextDueDate,
        active: true,
        updatedAt: new Date().toISOString(),
      },
    })
  }, [])

  const stopRecurringTemplate = useCallback((templateId: string) => {
    dispatch({
      type: 'stop-recurring-template',
      payload: {
        id: templateId,
        updatedAt: new Date().toISOString(),
      },
    })
  }, [])

  const addRecurringOccurrences = useCallback(
    (input: ApplyRecurringOccurrencesInput) => {
      const template = stateRef.current.recurringTemplates.find(
        (entry) => entry.id === input.templateId,
      )

      if (!template) {
        return
      }

      const processibleDates = getProcessibleRecurringDates(
        template,
        input.occurrenceDates,
      )

      if (processibleDates.length === 0) {
        return
      }

      const timestamp = new Date().toISOString()

      dispatch({
        type: 'add-recurring-occurrences',
        payload: {
          templateId: template.id,
          transactions: processibleDates.map((occurrenceDate) => ({
            id: createId('txn'),
            type: template.type,
            amount: template.amount,
            categoryId: template.categoryId,
            note: template.note,
            occurredAt: occurrenceDate,
            recurringTemplateId: template.id,
            recurringOccurrenceDate: occurrenceDate,
            createdAt: timestamp,
            updatedAt: timestamp,
            syncStatus: 'pending',
          })),
          nextDueDate: advanceRecurringNextDueDate(
            template,
            processibleDates.length,
          ),
          updatedAt: timestamp,
        },
      })
    },
    [],
  )

  const skipRecurringOccurrences = useCallback(
    (input: ApplyRecurringOccurrencesInput) => {
      const template = stateRef.current.recurringTemplates.find(
        (entry) => entry.id === input.templateId,
      )

      if (!template) {
        return
      }

      const processibleDates = getProcessibleRecurringDates(
        template,
        input.occurrenceDates,
      )

      if (processibleDates.length === 0) {
        return
      }

      dispatch({
        type: 'skip-recurring-occurrences',
        payload: {
          templateId: template.id,
          nextDueDate: advanceRecurringNextDueDate(
            template,
            processibleDates.length,
          ),
          updatedAt: new Date().toISOString(),
        },
      })
    },
    [],
  )

  const upsertBudget = useCallback((input: UpsertBudgetInput) => {
    const trimmedName = input.name.trim()

    if (!trimmedName) {
      return 'Budget name is required.'
    }

    if (!Number.isFinite(input.limit) || input.limit <= 0) {
      return 'Budget limit must be greater than zero.'
    }

    const categoryIds = validateBudgetCategoryIds(
      input.categoryIds,
      stateRef.current.categories,
    )

    if (categoryIds.length === 0) {
      return 'Select at least one expense category.'
    }

    const existingBudget = input.id
      ? stateRef.current.budgets.find((budget) => budget.id === input.id) ?? null
      : null
    const normalizedName = trimmedName.toLowerCase()
    const duplicateName = stateRef.current.budgets.some(
      (budget) =>
        budget.id !== existingBudget?.id &&
        budget.monthKey === input.monthKey &&
        budget.name.trim().toLowerCase() === normalizedName,
    )

    if (duplicateName) {
      return 'A budget with this name already exists for this month.'
    }

    const timestamp = new Date().toISOString()

    dispatch({
      type: 'set-budget',
      payload: {
        id: existingBudget?.id ?? createId('budget'),
        name: trimmedName,
        categoryIds,
        monthKey: input.monthKey,
        limit: input.limit,
        createdAt: existingBudget?.createdAt ?? timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
      },
    })

    return null
  }, [])

  const removeBudget = useCallback((budgetId: string) => {
    dispatch({ type: 'remove-budget', payload: { id: budgetId } })
  }, [])

  const setTheme = useCallback((theme: ThemeMode) => {
    dispatch({ type: 'update-settings', payload: { theme } })
  }, [])

  const setCurrency = useCallback((currency: string) => {
    dispatch({
      type: 'update-settings',
      payload: { currency: currency.toUpperCase() },
    })
  }, [])

  const setSyncEndpoint = useCallback((endpoint: string) => {
    dispatch({
      type: 'update-settings',
      payload: { syncEndpoint: endpoint.trim() },
    })
  }, [])

  const updateBackupSettings = useCallback(
    (settings: Partial<BackupPreferences>) => {
      dispatch({ type: 'update-settings', payload: settings })
    },
    [],
  )

  const replaceState = useCallback(async (nextState: typeof state) => {
    await saveFinanceState(nextState)
    stateRef.current = nextState
    dispatch({ type: 'replace-state', payload: nextState })
  }, [])

  const syncNow = useCallback(async () => {
    if (isSyncing) {
      return false
    }

    const currentState = stateRef.current
    const synchronizedAt = new Date().toISOString()

    dispatch({ type: 'sync-attempt', payload: { at: synchronizedAt } })

    if (currentState.syncQueue.length === 0) {
      dispatch({ type: 'sync-success', payload: { at: synchronizedAt, operationIds: [] } })
      return true
    }

    setIsSyncing(true)

    try {
      dispatch({
        type: 'sync-success',
        payload: {
          at: synchronizedAt,
          operationIds: currentState.syncQueue.map((operation) => operation.id),
        },
      })

      return true
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing])

  useEffect(() => {
    if (!isLoaded || state.syncQueue.length === 0) {
      return
    }

    void syncNow()
  }, [isLoaded, state.syncQueue.length, syncNow])

  const value = useMemo(
    () => ({
      state,
      isLoaded,
      isOnline,
      isSyncing,
      addCategory,
      updateCategory,
      previewCategoryDeletion,
      deleteCategory,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addRecurringTemplate,
      updateRecurringTemplate,
      stopRecurringTemplate,
      addRecurringOccurrences,
      skipRecurringOccurrences,
      upsertBudget,
      removeBudget,
      setTheme,
      setCurrency,
      setSyncEndpoint,
      updateBackupSettings,
      replaceState,
      syncNow,
    }),
    [
      state,
      isLoaded,
      isOnline,
      isSyncing,
      addCategory,
      updateCategory,
      previewCategoryDeletion,
      deleteCategory,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addRecurringTemplate,
      updateRecurringTemplate,
      stopRecurringTemplate,
      addRecurringOccurrences,
      skipRecurringOccurrences,
      upsertBudget,
      removeBudget,
      setTheme,
      setCurrency,
      setSyncEndpoint,
      updateBackupSettings,
      replaceState,
      syncNow,
    ],
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}
