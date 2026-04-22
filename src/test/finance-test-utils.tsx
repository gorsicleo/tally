import { render, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, PropsWithChildren } from 'react'
import { FinanceContext, type FinanceContextValue } from '../state/finance-store'
import { initialFinanceState } from '../domain/default-data'

export function createFinanceContextValue(
  overrides: Partial<FinanceContextValue> = {},
): FinanceContextValue {
  return {
    state: initialFinanceState,
    isLoaded: true,
    addCategory: () => {},
    updateCategory: () => {},
    previewCategoryDeletion: () => ({ ok: false, message: 'noop' }),
    deleteCategory: () => null,
    addTransaction: () => {},
    updateTransaction: () => {},
    deleteTransaction: () => {},
    addRecurringTemplate: () => null,
    updateRecurringTemplate: () => {},
    stopRecurringTemplate: () => {},
    addRecurringOccurrences: () => {},
    skipRecurringOccurrences: () => {},
    upsertBudget: () => null,
    removeBudget: () => {},
    setTheme: () => {},
    setCurrency: () => {},
    setHideSensitiveData: () => {},
    setLockAppOnLaunchEnabled: () => {},
    setupAppLock: async () => null,
    changeAppLockPin: async () => null,
    removeAppLock: async () => null,
    unlockApp: async () => null,
    setupDeviceAuthentication: async () => null,
    removeDeviceAuthentication: () => {},
    unlockAppWithDeviceAuthentication: async () => null,
    generateRecoveryCodes: async () => [],
    unlockAppWithRecoveryCode: async () => null,
    setHideOverspendingBudgetsInHome: () => {},
    isAppUnlocked: true,
    appLockCooldownUntil: null,
    isDeviceAuthSupported: false,
    isDeviceAuthConfigured: false,
    isRecoveryCodesConfigured: false,
    recoveryCodesRemaining: 0,
    sensitiveDataRevealedForSession: false,
    shouldHideSensitiveValues: false,
    revealSensitiveDataForSession: async () => null,
    updateBackupSettings: () => {},
    replaceState: async () => {},
    ...overrides,
  }
}

export function renderWithFinance(
  ui: ReactElement,
  contextValue: FinanceContextValue,
  options?: Omit<RenderOptions, 'queries'>,
) {
  const wrapper = ({ children }: PropsWithChildren) => (
    <FinanceContext.Provider value={contextValue}>{children}</FinanceContext.Provider>
  )

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper, ...options }),
  }
}