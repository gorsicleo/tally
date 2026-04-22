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
import {
  doBudgetSchedulesOverlap,
  validateBudgetCategoryIds,
} from '../domain/budget-service'
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
import {
  APP_LOCK_COOLDOWN_AFTER_FAILURES_MS,
  APP_LOCK_FAILURES_BEFORE_COOLDOWN,
  APP_LOCK_RELOCK_TIMEOUT_MS,
  createAppLockPinVerifier,
  shouldRequireAppLock,
  validateNumericPin,
  verifyAppLockPin,
} from '../features/privacy/app-lock'
import {
  authenticateWithDeviceCredential,
  isDeviceAuthenticationConfigured,
  isDeviceAuthenticationSupported,
  registerDeviceAuthenticationCredential,
} from '../features/privacy/device-auth'
import {
  createRecoveryCodeSet,
  getRecoveryCodeSummary,
  verifyAndConsumeRecoveryCode,
} from '../features/privacy/recovery-codes'
import { shouldHideSensitiveValues } from '../features/privacy/sensitive-data'
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
  const [hasSessionUnlock, setHasSessionUnlock] = useState(false)
  const [appLockCooldownUntil, setAppLockCooldownUntil] = useState<number | null>(null)
  const isDeviceAuthSupported = isDeviceAuthenticationSupported()
  const [sensitiveDataRevealedForSession, setSensitiveDataRevealedForSession] =
    useState(false)
  const stateRef = useRef(state)
  const appLockFailedAttemptsRef = useRef(0)
  const backgroundedAtRef = useRef<number | null>(null)

  const isAppUnlocked = !shouldRequireAppLock(state.settings) || hasSessionUnlock

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
    if (typeof window === 'undefined' || !isLoaded) {
      return
    }

    const markBackgrounded = () => {
      backgroundedAtRef.current = Date.now()
    }

    const evaluateRelock = () => {
      if (!shouldRequireAppLock(stateRef.current.settings)) {
        backgroundedAtRef.current = null
        return
      }

      const backgroundedAt = backgroundedAtRef.current

      if (backgroundedAt === null) {
        return
      }

      const wasBackgroundedLongEnough =
        Date.now() - backgroundedAt >= APP_LOCK_RELOCK_TIMEOUT_MS

      backgroundedAtRef.current = null

      if (wasBackgroundedLongEnough) {
        setSensitiveDataRevealedForSession(false)
        setHasSessionUnlock(false)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        markBackgrounded()
        return
      }

      if (document.visibilityState === 'visible') {
        evaluateRelock()
      }
    }

    const handlePageHide = () => {
      markBackgrounded()
    }

    const handlePageShow = () => {
      evaluateRelock()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [isLoaded])

  const verifyStoredPin = useCallback(async (pin: string) => {
    const verifier = stateRef.current.settings.appLockPinVerifier

    if (!verifier) {
      return 'App lock is not configured.'
    }

    if (appLockCooldownUntil !== null && Date.now() < appLockCooldownUntil) {
      return 'Too many incorrect attempts. Try again in a moment.'
    }

    const isValid = await verifyAppLockPin(pin, verifier)

    if (isValid) {
      appLockFailedAttemptsRef.current = 0
      setAppLockCooldownUntil(null)
      return null
    }

    appLockFailedAttemptsRef.current += 1

    if (appLockFailedAttemptsRef.current >= APP_LOCK_FAILURES_BEFORE_COOLDOWN) {
      appLockFailedAttemptsRef.current = 0
      setAppLockCooldownUntil(Date.now() + APP_LOCK_COOLDOWN_AFTER_FAILURES_MS)
      return 'Too many incorrect attempts. Try again in a moment.'
    }

    return 'Incorrect PIN.'
  }, [appLockCooldownUntil])

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
    const recurring = input.recurring ?? existingBudget?.recurring ?? true
    const candidateSchedule = {
      monthKey: input.monthKey,
      recurring,
    }
    const normalizedName = trimmedName.toLowerCase()
    const duplicateName = stateRef.current.budgets.some(
      (budget) =>
        budget.id !== existingBudget?.id &&
        doBudgetSchedulesOverlap(budget, candidateSchedule) &&
        budget.name.trim().toLowerCase() === normalizedName,
    )

    if (duplicateName) {
      return recurring
        ? 'A budget with this name already exists for this schedule.'
        : 'A budget with this name already exists for this month.'
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
        recurring,
        createdAt: existingBudget?.createdAt ?? timestamp,
        updatedAt: timestamp,
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

  const setHideSensitiveData = useCallback((hidden: boolean) => {
    setSensitiveDataRevealedForSession(false)
    dispatch({
      type: 'update-settings',
      payload: { hideSensitiveData: hidden },
    })
  }, [])

  const setLockAppOnLaunchEnabled = useCallback((enabled: boolean) => {
    if (enabled && !stateRef.current.settings.appLockPinVerifier) {
      return
    }

    dispatch({
      type: 'update-settings',
      payload: { lockAppOnLaunch: enabled },
    })

    if (!enabled) {
      setAppLockCooldownUntil(null)
      appLockFailedAttemptsRef.current = 0
      setHasSessionUnlock(false)
    }
  }, [])

  const setupAppLock = useCallback(async (pin: string) => {
    const validationMessage = validateNumericPin(pin)

    if (validationMessage) {
      return validationMessage
    }

    const verifier = await createAppLockPinVerifier(pin)
    setAppLockCooldownUntil(null)
    appLockFailedAttemptsRef.current = 0
    setHasSessionUnlock(true)
    dispatch({
      type: 'update-settings',
      payload: {
        lockAppOnLaunch: true,
        appLockPinVerifier: verifier,
      },
    })

    return null
  }, [])

  const changeAppLockPin = useCallback(async (currentPin: string, nextPin: string) => {
    const validationMessage = validateNumericPin(nextPin)

    if (validationMessage) {
      return validationMessage
    }

    const verificationMessage = await verifyStoredPin(currentPin)

    if (verificationMessage) {
      return verificationMessage === 'Incorrect PIN.'
        ? 'Current PIN is incorrect.'
        : verificationMessage
    }

    const verifier = await createAppLockPinVerifier(nextPin)
    dispatch({
      type: 'update-settings',
      payload: {
        lockAppOnLaunch: true,
        appLockPinVerifier: verifier,
      },
    })

    return null
  }, [verifyStoredPin])

  const removeAppLock = useCallback(async (pin: string) => {
    const verificationMessage = await verifyStoredPin(pin)

    if (verificationMessage) {
      return verificationMessage === 'Incorrect PIN.'
        ? 'Current PIN is incorrect.'
        : verificationMessage
    }

    setAppLockCooldownUntil(null)
    appLockFailedAttemptsRef.current = 0
    backgroundedAtRef.current = null
    setSensitiveDataRevealedForSession(false)
    setHasSessionUnlock(false)
    dispatch({
      type: 'update-settings',
      payload: {
        lockAppOnLaunch: false,
        appLockPinVerifier: null,
        deviceAuthCredential: null,
        recoveryCodeSet: null,
      },
    })

    return null
  }, [verifyStoredPin])

  const unlockApp = useCallback(async (pin: string) => {
    if (!shouldRequireAppLock(stateRef.current.settings)) {
      setHasSessionUnlock(false)
      return null
    }

    const verificationMessage = await verifyStoredPin(pin)

    if (verificationMessage) {
      return verificationMessage
    }

    backgroundedAtRef.current = null
    setHasSessionUnlock(true)
    return null
  }, [verifyStoredPin])

  const setupDeviceAuthentication = useCallback(async () => {
    if (!stateRef.current.settings.appLockPinVerifier) {
      return 'Set up a PIN before enabling device authentication.'
    }

    if (!isDeviceAuthenticationSupported()) {
      return 'Device authentication is not available on this device.'
    }

    try {
      const credential = await registerDeviceAuthenticationCredential()

      dispatch({
        type: 'update-settings',
        payload: {
          deviceAuthCredential: credential,
        },
      })

      return null
    } catch (error) {
      if (error instanceof Error && error.message.trim().length > 0) {
        return error.message
      }

      return 'Could not enable device authentication.'
    }
  }, [])

  const removeDeviceAuthentication = useCallback(() => {
    dispatch({
      type: 'update-settings',
      payload: {
        deviceAuthCredential: null,
      },
    })
  }, [])

  const unlockAppWithDeviceAuthentication = useCallback(async () => {
    if (!shouldRequireAppLock(stateRef.current.settings)) {
      setHasSessionUnlock(false)
      return null
    }

    const result = await authenticateWithDeviceCredential(
      stateRef.current.settings.deviceAuthCredential,
    )

    if (!result.ok) {
      return result.message ?? 'Device authentication failed. Use PIN instead.'
    }

    appLockFailedAttemptsRef.current = 0
    setAppLockCooldownUntil(null)
    backgroundedAtRef.current = null
    setHasSessionUnlock(true)

    return null
  }, [])

  const generateRecoveryCodes = useCallback(async (currentPin: string | null) => {
    if (!stateRef.current.settings.appLockPinVerifier) {
      return 'Set up app lock with a PIN first.'
    }

    const hasExistingCodes = stateRef.current.settings.recoveryCodeSet !== null

    if (hasExistingCodes) {
      if (!currentPin || currentPin.length === 0) {
        return 'Enter your current PIN to regenerate recovery codes.'
      }

      const verificationMessage = await verifyStoredPin(currentPin)

      if (verificationMessage) {
        return verificationMessage === 'Incorrect PIN.'
          ? 'Current PIN is incorrect.'
          : verificationMessage
      }
    }

    try {
      const { plaintextCodes, codeSet } = await createRecoveryCodeSet()

      dispatch({
        type: 'update-settings',
        payload: {
          recoveryCodeSet: codeSet,
        },
      })

      return plaintextCodes
    } catch {
      return 'Could not generate recovery codes.'
    }
  }, [verifyStoredPin])

  const unlockAppWithRecoveryCode = useCallback(async (code: string) => {
    if (!shouldRequireAppLock(stateRef.current.settings)) {
      setHasSessionUnlock(false)
      return null
    }

    const result = await verifyAndConsumeRecoveryCode(code, stateRef.current.settings.recoveryCodeSet)

    if (!result.ok || !result.nextSet) {
      return result.message ?? 'Recovery code is invalid or already used.'
    }

    appLockFailedAttemptsRef.current = 0
    setAppLockCooldownUntil(null)
    backgroundedAtRef.current = null
    setHasSessionUnlock(true)
    dispatch({
      type: 'update-settings',
      payload: {
        recoveryCodeSet: result.nextSet,
      },
    })

    return null
  }, [])

  const setHideOverspendingBudgetsInHome = useCallback((hidden: boolean) => {
    dispatch({
      type: 'update-settings',
      payload: { hideOverspendingBudgetsInHome: hidden },
    })
  }, [])

  const updateBackupSettings = useCallback(
    (settings: Partial<BackupPreferences>) => {
      dispatch({ type: 'update-settings', payload: settings })
    },
    [],
  )

  const revealSensitiveDataForSession = useCallback(async () => {
    if (sensitiveDataRevealedForSession) {
      return null
    }

    if (isDeviceAuthenticationConfigured(stateRef.current.settings.deviceAuthCredential)) {
      const result = await authenticateWithDeviceCredential(
        stateRef.current.settings.deviceAuthCredential,
      )

      if (!result.ok) {
        return result.message ?? 'Device authentication failed. Sensitive values remain hidden.'
      }
    }

    setSensitiveDataRevealedForSession(true)
    return null
  }, [sensitiveDataRevealedForSession])

  const shouldHideSensitiveValuesNow = useMemo(
    () =>
      shouldHideSensitiveValues(
        state.settings.hideSensitiveData,
        sensitiveDataRevealedForSession,
      ),
    [sensitiveDataRevealedForSession, state.settings.hideSensitiveData],
  )

  const replaceState = useCallback(async (nextState: typeof state) => {
    await saveFinanceState(nextState)
    stateRef.current = nextState
    setSensitiveDataRevealedForSession(false)
    setAppLockCooldownUntil(null)
    appLockFailedAttemptsRef.current = 0
    backgroundedAtRef.current = null
    setHasSessionUnlock(false)
    dispatch({ type: 'replace-state', payload: nextState })
  }, [])

  const recoverySummary = useMemo(
    () => getRecoveryCodeSummary(state.settings.recoveryCodeSet),
    [state.settings.recoveryCodeSet],
  )

  const value = useMemo(
    () => ({
      state,
      isLoaded,
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
      setHideSensitiveData,
      setLockAppOnLaunchEnabled,
      setupAppLock,
      changeAppLockPin,
      removeAppLock,
      unlockApp,
      setupDeviceAuthentication,
      removeDeviceAuthentication,
      unlockAppWithDeviceAuthentication,
      generateRecoveryCodes,
      unlockAppWithRecoveryCode,
      setHideOverspendingBudgetsInHome,
      isAppUnlocked,
      appLockCooldownUntil,
      isDeviceAuthSupported,
      isDeviceAuthConfigured: isDeviceAuthenticationConfigured(state.settings.deviceAuthCredential),
      isRecoveryCodesConfigured: recoverySummary.total > 0,
      recoveryCodesRemaining: recoverySummary.remaining,
      sensitiveDataRevealedForSession,
      shouldHideSensitiveValues: shouldHideSensitiveValuesNow,
      revealSensitiveDataForSession,
      updateBackupSettings,
      replaceState,
    }),
    [
      state,
      isLoaded,
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
      setHideSensitiveData,
      setLockAppOnLaunchEnabled,
      setupAppLock,
      changeAppLockPin,
      removeAppLock,
      unlockApp,
      setupDeviceAuthentication,
      removeDeviceAuthentication,
      unlockAppWithDeviceAuthentication,
      generateRecoveryCodes,
      unlockAppWithRecoveryCode,
      setHideOverspendingBudgetsInHome,
      isAppUnlocked,
      appLockCooldownUntil,
      isDeviceAuthSupported,
      recoverySummary.remaining,
      recoverySummary.total,
      sensitiveDataRevealedForSession,
      shouldHideSensitiveValuesNow,
      revealSensitiveDataForSession,
      updateBackupSettings,
      replaceState,
    ],
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}
