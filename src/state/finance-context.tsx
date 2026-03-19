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
import type { BackupPreferences, ThemeMode } from '../domain/models'
import { loadFinanceState, saveFinanceState } from '../persistence/finance-storage'
import { pushSyncQueue } from '../sync/client'
import { createId } from '../utils/id'
import { financeReducer } from './finance-reducer'
import {
  FinanceContext,
  type AddCategoryInput,
  type AddTransactionInput,
  type SetBudgetInput,
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
  const hasAttemptedInitialSync = useRef(false)
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
    document.documentElement.dataset.theme = state.settings.theme
    document.documentElement.style.colorScheme = state.settings.theme
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
        isDefault: false,
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

  const deleteCategory = useCallback((categoryId: string) => {
    dispatch({ type: 'delete-category', payload: { id: categoryId } })
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
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      },
    })
  }, [])

  const deleteTransaction = useCallback((transactionId: string) => {
    dispatch({ type: 'delete-transaction', payload: { id: transactionId } })
  }, [])

  const setBudget = useCallback((input: SetBudgetInput) => {
    const budgetId = `budget-${input.categoryId}-${input.monthKey}`
    const existingBudget = stateRef.current.budgets.find(
      (budget) => budget.id === budgetId,
    )

    if (input.limit <= 0) {
      if (!existingBudget) {
        return
      }

      dispatch({ type: 'remove-budget', payload: { id: budgetId } })
      return
    }

    const timestamp = new Date().toISOString()

    dispatch({
      type: 'set-budget',
      payload: {
        id: budgetId,
        categoryId: input.categoryId,
        monthKey: input.monthKey,
        limit: input.limit,
        createdAt: existingBudget?.createdAt ?? timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
      },
    })
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
    if (isSyncing || !isOnline) {
      return false
    }

    const currentState = stateRef.current
    const syncAttemptAt = new Date().toISOString()

    dispatch({ type: 'sync-attempt', payload: { at: syncAttemptAt } })

    if (currentState.syncQueue.length === 0) {
      dispatch({ type: 'sync-success', payload: { at: syncAttemptAt, operationIds: [] } })
      return true
    }

    setIsSyncing(true)

    try {
      const response = await pushSyncQueue(
        currentState.settings.syncEndpoint,
        currentState.syncQueue,
        currentState.settings.conflictPolicy,
      )

      dispatch({
        type: 'sync-success',
        payload: {
          at: response.serverTimestamp,
          operationIds: response.appliedOperationIds,
        },
      })

      return true
    } catch (error) {
      dispatch({
        type: 'sync-failure',
        payload: {
          at: syncAttemptAt,
          operationIds: currentState.syncQueue.map((operation) => operation.id),
          error:
            error instanceof Error ? error.message : 'Sync failed unexpectedly.',
        },
      })

      return false
    } finally {
      setIsSyncing(false)
    }
  }, [isOnline, isSyncing])

  useEffect(() => {
    if (!isLoaded || !isOnline || hasAttemptedInitialSync.current) {
      return
    }

    hasAttemptedInitialSync.current = true
    void syncNow()
  }, [isLoaded, isOnline, syncNow])

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    const handleOnlineSync = () => {
      void syncNow()
    }

    window.addEventListener('online', handleOnlineSync)

    return () => {
      window.removeEventListener('online', handleOnlineSync)
    }
  }, [isLoaded, syncNow])

  const value = useMemo(
    () => ({
      state,
      isLoaded,
      isOnline,
      isSyncing,
      addCategory,
      updateCategory,
      deleteCategory,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      setBudget,
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
      deleteCategory,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      setBudget,
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
