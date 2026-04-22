import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import App from './App'
import { initialFinanceState } from './domain/default-data'
import type { FinanceState, RecurringTemplate, Transaction } from './domain/models'
import {
  APP_LOCK_RELOCK_TIMEOUT_MS,
  createAppLockPinVerifier,
} from './features/privacy/app-lock'
import { createRecoveryCodeSet } from './features/privacy/recovery-codes'
import { GITHUB_ISSUE_CHOOSER_URL } from './features/settings/report-bug-info'
import { toLocalDateKey } from './utils/date'
import { renderWithUser } from './test/render-utils'

const storageState = vi.hoisted(() => ({
  loadedState: null as FinanceState | null,
  saveSpy: vi.fn(async (state: FinanceState) => {
    void state
  }),
  downloadSpy: vi.fn(),
  restoreResult: {
    ok: false as const,
    message: 'This backup file is not valid.',
  },
}))

const reportBugState = vi.hoisted(() => ({
  copySpy: vi.fn<(value: string) => Promise<boolean>>(async () => true),
  openSpy: vi.fn<(url: string) => boolean>(() => true),
}))

const deviceAuthState = vi.hoisted(() => ({
  supported: false,
  configuredCredential: {
    version: 1 as const,
    credentialId: 'abc123_XYZ',
    createdAt: '2026-03-01T10:00:00.000Z',
    transports: ['internal'] as const,
  },
  authenticateResult: {
    ok: true,
    message: null as string | null,
  },
  registerSpy: vi.fn(async () => ({
    version: 1 as const,
    credentialId: 'abc123_XYZ',
    createdAt: '2026-03-01T10:00:00.000Z',
    transports: ['internal'] as const,
  })),
  authenticateSpy: vi.fn(async () => ({
    ok: true,
    message: null as string | null,
  })),
}))

vi.mock('./persistence/finance-storage', () => ({
  loadFinanceState: vi.fn(async () => storageState.loadedState),
  saveFinanceState: storageState.saveSpy,
}))

vi.mock('./utils/download', () => ({
  downloadTextFile: storageState.downloadSpy,
}))

vi.mock('./utils/clipboard', () => ({
  copyTextToClipboard: reportBugState.copySpy,
}))

vi.mock('./utils/external-link', () => ({
  openExternalUrl: reportBugState.openSpy,
}))

vi.mock('./backup/restore-service', () => ({
  prepareBackupRestoreFile: vi.fn(async () => storageState.restoreResult),
}))

vi.mock('./pwa/register-service-worker', () => ({
  useInstallPrompt: () => ({
    canInstall: false,
    isInstalled: true,
    install: async () => {
      // No-op in tests.
    },
  }),
  registerServiceWorker: () => {
    // No-op in tests.
  },
}))

vi.mock('./features/backup/update-manager', () => ({
  UpdateManager: () => null,
}))

vi.mock('./features/privacy/device-auth', () => ({
  isDeviceAuthenticationSupported: () => deviceAuthState.supported,
  isDeviceAuthenticationConfigured: (credential: unknown) =>
    credential !== null && credential !== undefined,
  registerDeviceAuthenticationCredential: async () => {
    const result = await deviceAuthState.registerSpy()
    return result
  },
  authenticateWithDeviceCredential: async () => {
    await deviceAuthState.authenticateSpy()
    return deviceAuthState.authenticateResult
  },
}))

function createLoadedState(overrides: Partial<FinanceState> = {}): FinanceState {
  return {
    ...initialFinanceState,
    categories: [...initialFinanceState.categories],
    transactions: [],
    budgets: [],
    recurringTemplates: [],
    settings: {
      ...initialFinanceState.settings,
      hasSeenPrivacyModal: true,
      backupRemindersEnabled: false,
      changesSinceBackup: 0,
      lastReminderAt: null,
    },
    ...overrides,
  }
}

function createFixtureDate(offsetDays = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return toLocalDateKey(date)
}

function createTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? 'txn-default',
    type: overrides.type ?? 'expense',
    amount: overrides.amount ?? 10,
    categoryId: overrides.categoryId ?? 'cat-food',
    note: overrides.note ?? '',
    occurredAt: overrides.occurredAt ?? createFixtureDate(0),
    recurringTemplateId: overrides.recurringTemplateId ?? null,
    recurringOccurrenceDate: overrides.recurringOccurrenceDate ?? null,
    createdAt: overrides.createdAt ?? '2026-03-20T08:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-20T08:00:00.000Z',
  }
}

function createRecurringTemplate(
  overrides: Partial<RecurringTemplate>,
): RecurringTemplate {
  return {
    id: overrides.id ?? 'rec-default',
    type: overrides.type ?? 'expense',
    amount: overrides.amount ?? 15,
    categoryId: overrides.categoryId ?? 'cat-food',
    note: overrides.note ?? 'Recurring item',
    frequency: overrides.frequency ?? 'monthly',
    intervalDays: overrides.intervalDays ?? null,
    startDate: overrides.startDate ?? createFixtureDate(-30),
    nextDueDate: overrides.nextDueDate ?? createFixtureDate(0),
    active: overrides.active ?? true,
    createdAt: overrides.createdAt ?? '2026-03-01T08:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-01T08:00:00.000Z',
  }
}

function setDocumentVisibilityState(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => value,
  })
}

async function createLockedSettings(pin = '1234') {
  return {
    lockAppOnLaunch: true,
    appLockPinVerifier: await createAppLockPinVerifier(pin),
  }
}

async function createLockedSettingsWithDeviceAuth(pin = '1234') {
  return {
    ...(await createLockedSettings(pin)),
    deviceAuthCredential: deviceAuthState.configuredCredential,
  }
}

async function createLockedSettingsWithRecoveryCodes(pin = '1234') {
  const recovery = await createRecoveryCodeSet()

  return {
    settings: {
      ...(await createLockedSettings(pin)),
      recoveryCodeSet: recovery.codeSet,
    },
    firstCode: recovery.plaintextCodes[0],
  }
}

describe('App UI behavior', () => {
  beforeEach(() => {
    vi.useRealTimers()
    storageState.loadedState = createLoadedState()
    storageState.saveSpy.mockClear()
    storageState.downloadSpy.mockClear()
    storageState.restoreResult = {
      ok: false,
      message: 'This backup file is not valid.',
    }
    reportBugState.copySpy.mockReset()
    reportBugState.copySpy.mockResolvedValue(true)
    reportBugState.openSpy.mockReset()
    reportBugState.openSpy.mockReturnValue(true)
    deviceAuthState.supported = false
    deviceAuthState.authenticateResult = { ok: true, message: null }
    deviceAuthState.registerSpy.mockClear()
    deviceAuthState.authenticateSpy.mockClear()
    window.localStorage.clear()
    setDocumentVisibilityState('visible')
  })

  it('opens report bug dialog from settings and copies app info', async () => {
    const { user } = renderWithUser(<App />)

    await screen.findByRole('button', { name: 'Settings' })
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Report a bug/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Report a bug' })
    await user.click(within(dialog).getByRole('button', { name: 'Copy app info' }))

    await waitFor(() => {
      expect(reportBugState.copySpy).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText('App info copied.')).toBeInTheDocument()

    const copiedText = reportBugState.copySpy.mock.calls.at(0)?.at(0)
    expect(copiedText).toBeTypeOf('string')
    expect(copiedText).toContain('App: Tally')
  })

  it('opens github issue URL from report bug dialog', async () => {
    const { user } = renderWithUser(<App />)

    await screen.findByRole('button', { name: 'Settings' })
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Report a bug/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Report a bug' })
    await user.click(within(dialog).getByRole('button', { name: 'Open GitHub issue' }))

    expect(reportBugState.openSpy).toHaveBeenCalledWith(GITHUB_ISSUE_CHOOSER_URL)
  })

  it('shows graceful feedback when clipboard is unavailable', async () => {
    reportBugState.copySpy.mockResolvedValueOnce(false)
    const { user } = renderWithUser(<App />)

    await screen.findByRole('button', { name: 'Settings' })
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Report a bug/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Report a bug' })
    await user.click(within(dialog).getByRole('button', { name: 'Copy app info' }))

    expect(await screen.findByText('Could not copy app info.')).toBeInTheDocument()
  })

  it('shows graceful feedback when external navigation fails', async () => {
    reportBugState.openSpy.mockReturnValueOnce(false)
    const { user } = renderWithUser(<App />)

    await screen.findByRole('button', { name: 'Settings' })
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /Report a bug/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Report a bug' })
    await user.click(within(dialog).getByRole('button', { name: 'Open GitHub issue' }))

    expect(await screen.findByText('Could not open GitHub. Please try again.')).toBeInTheDocument()
  })

  it('validates amount and then saves a new transaction from the modal', async () => {
    const { user } = renderWithUser(<App />)

    await screen.findByRole('button', { name: 'Add' })
    await user.click(screen.getByRole('button', { name: 'Add' }))

    const dialog = await screen.findByRole('dialog', { name: 'Add transaction' })
    const amountInput = within(dialog).getByLabelText('Amount')

    fireEvent.change(amountInput, { target: { value: '0' } })
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))

    expect(await within(dialog).findByText('Amount must be greater than zero.')).toBeInTheDocument()

    fireEvent.change(amountInput, { target: { value: '12.50' } })
    await user.click(within(dialog).getByRole('button', { name: '+ Add note' }))
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Note (optional)' }), {
      target: { value: 'Coffee beans' },
    })
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(await screen.findByText('Coffee beans')).toBeInTheDocument()
  }, 15000)

  it('filters records by search query and shows empty state for no matches', async () => {
    storageState.loadedState = createLoadedState({
      transactions: [
        {
          id: 'txn-lunch',
          type: 'expense',
          amount: 18,
          categoryId: 'cat-food',
          note: 'Lunch',
          occurredAt: createFixtureDate(0),
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-03-20T09:00:00.000Z',
          updatedAt: '2026-03-20T09:00:00.000Z',
        },
        {
          id: 'txn-pay',
          type: 'income',
          amount: 2000,
          categoryId: 'cat-salary',
          note: 'Salary payout',
          occurredAt: createFixtureDate(-1),
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-03-19T09:00:00.000Z',
          updatedAt: '2026-03-19T09:00:00.000Z',
        },
      ],
    })

    const { user } = renderWithUser(<App />)

    await screen.findByRole('button', { name: 'Records' })
    await user.click(screen.getByRole('button', { name: 'Records' }))
    await screen.findByRole('heading', { name: 'Transaction history' })

    const searchInput = screen.getByRole('searchbox', { name: 'Search transactions' })

    await user.type(searchInput, 'Lunch')
    expect(await screen.findByText('1 results')).toBeInTheDocument()
    expect(screen.queryByText('Salary payout')).not.toBeInTheDocument()

    await user.clear(searchInput)
    await user.type(searchInput, 'not-found-query')

    expect(await screen.findByText('No transactions match this filter yet.')).toBeInTheDocument()
  })

  it('renders home summary and insight card with seeded data', async () => {
    storageState.loadedState = createLoadedState({
      transactions: [
        {
          id: 'txn-income',
          type: 'income',
          amount: 2000,
          categoryId: 'cat-salary',
          note: 'Salary',
          occurredAt: createFixtureDate(0),
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-03-20T09:00:00.000Z',
          updatedAt: '2026-03-20T09:00:00.000Z',
        },
        {
          id: 'txn-expense',
          type: 'expense',
          amount: 125,
          categoryId: 'cat-food',
          note: 'Groceries',
          occurredAt: createFixtureDate(0),
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-03-20T10:00:00.000Z',
          updatedAt: '2026-03-20T10:00:00.000Z',
        },
      ],
    })

    renderWithUser(<App />)

    await screen.findByText('This month')
    expect(screen.getByText('Top category: Food')).toBeInTheDocument()
    expect(screen.getByText('$2,000.00')).toBeInTheDocument()
    expect(screen.getByText('$125.00')).toBeInTheDocument()
  })

  it('hides exact values and shows reveal chip when hide sensitive data is enabled', async () => {
    storageState.loadedState = createLoadedState({
      transactions: [
        createTransaction({
          id: 'txn-income-hidden',
          type: 'income',
          amount: 2000,
          categoryId: 'cat-salary',
          note: 'Salary',
        }),
        createTransaction({
          id: 'txn-expense-hidden',
          type: 'expense',
          amount: 125,
          categoryId: 'cat-food',
          note: 'Groceries',
        }),
      ],
      settings: {
        ...createLoadedState().settings,
        hideSensitiveData: true,
      },
    })

    renderWithUser(<App />)

    await screen.findByText('This month')
    expect(
      screen.getByRole('button', {
        name: 'Sensitive values are hidden. Tap to reveal for this session',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('$2,000.00')).not.toBeInTheDocument()
    expect(screen.queryByText('$125.00')).not.toBeInTheDocument()
    expect(screen.getAllByText('••••').length).toBeGreaterThan(0)
  })

  it('reveals hidden values for the active session only', async () => {
    storageState.loadedState = createLoadedState({
      transactions: [
        createTransaction({
          id: 'txn-income-reveal',
          type: 'income',
          amount: 2000,
          categoryId: 'cat-salary',
          note: 'Salary',
        }),
        createTransaction({
          id: 'txn-expense-reveal',
          type: 'expense',
          amount: 125,
          categoryId: 'cat-food',
          note: 'Groceries',
        }),
      ],
      settings: {
        ...createLoadedState().settings,
        hideSensitiveData: true,
      },
    })

    const firstRender = renderWithUser(<App />)

    await screen.findByRole('button', {
      name: 'Sensitive values are hidden. Tap to reveal for this session',
    })
    await firstRender.user.click(
      screen.getByRole('button', {
        name: 'Sensitive values are hidden. Tap to reveal for this session',
      }),
    )

    expect((await screen.findAllByText('$2,000.00')).length).toBeGreaterThan(0)
    expect(await screen.findByText('$125.00')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Sensitive values are visible for this session',
      }),
    ).toBeInTheDocument()

    firstRender.unmount()

    renderWithUser(<App />)

    await screen.findByRole('button', {
      name: 'Sensitive values are hidden. Tap to reveal for this session',
    })
    expect(screen.queryByText('$2,000.00')).not.toBeInTheDocument()
    expect(screen.queryByText('$125.00')).not.toBeInTheDocument()
  })

  it('uses device authentication for sensitive-data reveal when configured', async () => {
    deviceAuthState.supported = true
    deviceAuthState.authenticateResult = { ok: true, message: null }

    storageState.loadedState = createLoadedState({
      transactions: [
        createTransaction({
          id: 'txn-income-auth-reveal',
          type: 'income',
          amount: 2000,
          categoryId: 'cat-salary',
          note: 'Salary',
        }),
      ],
      settings: {
        ...createLoadedState().settings,
        hideSensitiveData: true,
        lockAppOnLaunch: false,
        appLockPinVerifier: await createAppLockPinVerifier('1234'),
        deviceAuthCredential: deviceAuthState.configuredCredential,
      },
    })

    const { user } = renderWithUser(<App />)

    await screen.findByRole('button', {
      name: 'Sensitive values are hidden. Tap to reveal for this session',
    })
    await user.click(
      screen.getByRole('button', {
        name: 'Sensitive values are hidden. Tap to reveal for this session',
      }),
    )

    await waitFor(() => {
      expect(deviceAuthState.authenticateSpy).toHaveBeenCalled()
    })
    expect((await screen.findAllByText('$2,000.00')).length).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', {
        name: 'Sensitive values are visible for this session',
      }),
    ).toBeInTheDocument()
  })

  it('masks insights numeric labels while keeping charts visible when hide mode is enabled', async () => {
    storageState.loadedState = createLoadedState({
      transactions: [
        createTransaction({
          id: 'txn-insights-a',
          type: 'expense',
          amount: 120,
          categoryId: 'cat-food',
          note: 'Meals',
          occurredAt: createFixtureDate(0),
        }),
        createTransaction({
          id: 'txn-insights-b',
          type: 'expense',
          amount: 80,
          categoryId: 'cat-transport',
          note: 'Transit',
          occurredAt: createFixtureDate(-2),
        }),
      ],
      settings: {
        ...createLoadedState().settings,
        hideSensitiveData: true,
      },
    })

    const { user } = renderWithUser(<App />)

    await screen.findByRole('button', { name: 'Insights' })
    await user.click(screen.getByRole('button', { name: 'Insights' }))

    expect(await screen.findByText('Monthly spending')).toBeInTheDocument()
    expect(screen.queryByText('$120.00')).not.toBeInTheDocument()
    expect(screen.queryByText('$80.00')).not.toBeInTheDocument()
    expect(screen.getAllByText('••••').length).toBeGreaterThan(0)
  })

  it('enabling app lock requires successful PIN setup and persists only verifier metadata', async () => {
    const { user } = renderWithUser(<App />)

    await screen.findByRole('button', { name: 'Settings' })
    await user.click(screen.getByRole('button', { name: 'Settings' }))

    storageState.saveSpy.mockClear()

    const rowElement = screen
      .getByText('Lock app on launch')
      .closest('.settings-list-row')

    if (!(rowElement instanceof HTMLElement)) {
      throw new Error('Expected app lock toggle row to be rendered.')
    }

    await user.click(within(rowElement).getByRole('button', { name: 'On' }))

    const dialog = await screen.findByRole('dialog', { name: 'Create a PIN' })
    await user.type(within(dialog).getByLabelText('New PIN'), '1234')
    await user.type(within(dialog).getByLabelText('Confirm PIN'), '1234')
    await user.click(within(dialog).getByRole('button', { name: 'Save PIN' }))

    await waitFor(() => {
      expect(storageState.saveSpy).toHaveBeenCalled()
    })

    const latestSavedState = storageState.saveSpy.mock.lastCall?.[0] as FinanceState | undefined
    expect(latestSavedState?.settings.lockAppOnLaunch).toBe(true)
    expect(latestSavedState?.settings.appLockPinVerifier).not.toBeNull()
    expect(latestSavedState?.settings.appLockPinVerifier).not.toHaveProperty('pin')
    expect(latestSavedState?.settings.appLockPinVerifier).toMatchObject({
      algorithm: 'PBKDF2',
      hash: 'SHA-256',
    })
    expect(
      Object.values(latestSavedState?.settings.appLockPinVerifier ?? {}).includes('1234'),
    ).toBe(false)
  })

  it('shows device-auth setup in settings when supported and stores credential metadata', async () => {
    deviceAuthState.supported = true

    const { user } = renderWithUser(<App />)

    await screen.findByRole('button', { name: 'Settings' })
    await user.click(screen.getByRole('button', { name: 'Settings' }))

    const lockRow = screen.getByText('Lock app on launch').closest('.settings-list-row')

    if (!(lockRow instanceof HTMLElement)) {
      throw new Error('Expected app lock toggle row to be rendered.')
    }

    await user.click(within(lockRow).getByRole('button', { name: 'On' }))

    const pinDialog = await screen.findByRole('dialog', { name: 'Create a PIN' })
    await user.type(within(pinDialog).getByLabelText('New PIN'), '1234')
    await user.type(within(pinDialog).getByLabelText('Confirm PIN'), '1234')
    await user.click(within(pinDialog).getByRole('button', { name: 'Save PIN' }))

    await user.click(await screen.findByRole('button', { name: /Set up device authentication/i }))

    await waitFor(() => {
      expect(deviceAuthState.registerSpy).toHaveBeenCalled()
      expect(storageState.saveSpy).toHaveBeenCalled()
    })

    const latestSavedState = storageState.saveSpy.mock.lastCall?.[0] as FinanceState | undefined
    expect(latestSavedState?.settings.deviceAuthCredential).toMatchObject({
      version: 1,
      credentialId: 'abc123_XYZ',
    })
  })

  it('stores only hashed recovery metadata after generating recovery codes', async () => {
    const { user } = renderWithUser(<App />)

    await screen.findByRole('button', { name: 'Settings' })
    await user.click(screen.getByRole('button', { name: 'Settings' }))

    const lockRow = screen.getByText('Lock app on launch').closest('.settings-list-row')

    if (!(lockRow instanceof HTMLElement)) {
      throw new Error('Expected app lock toggle row to be rendered.')
    }

    await user.click(within(lockRow).getByRole('button', { name: 'On' }))
    const pinDialog = await screen.findByRole('dialog', { name: 'Create a PIN' })
    await user.type(within(pinDialog).getByLabelText('New PIN'), '1234')
    await user.type(within(pinDialog).getByLabelText('Confirm PIN'), '1234')
    await user.click(within(pinDialog).getByRole('button', { name: 'Save PIN' }))

    await user.click(await screen.findByRole('button', { name: /Generate one-time recovery codes/i }))

    const codesDialog = await screen.findByRole('dialog', { name: 'Save your recovery codes' })
    const firstCode = within(codesDialog).getAllByText(/[A-Z2-9]{4}-[A-Z2-9]{4}/)[0].textContent ?? ''

    await waitFor(() => {
      expect(storageState.saveSpy).toHaveBeenCalled()
    })

    const latestSavedState = storageState.saveSpy.mock.lastCall?.[0] as FinanceState | undefined
    expect(latestSavedState?.settings.recoveryCodeSet).not.toBeNull()
    expect(JSON.stringify(latestSavedState?.settings.recoveryCodeSet)).not.toContain(firstCode)
  })

  it('keeps the app inaccessible while locked until authentication succeeds', async () => {
    storageState.loadedState = createLoadedState({
      settings: {
        ...createLoadedState().settings,
        ...(await createLockedSettings('1234')),
      },
    })

    renderWithUser(<App />)

    expect(await screen.findByRole('heading', { name: 'Unlock Tally' })).toBeInTheDocument()
    expect(screen.queryByText('This month')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument()
  })

  it('unlocks with a valid recovery code and keeps app lock enabled', async () => {
    const { settings, firstCode } = await createLockedSettingsWithRecoveryCodes('1234')
    storageState.loadedState = createLoadedState({
      settings: {
        ...createLoadedState().settings,
        ...settings,
      },
    })

    const { user } = renderWithUser(<App />)

    await screen.findByRole('heading', { name: 'Unlock Tally' })
    await user.click(screen.getByRole('button', { name: 'Use recovery code' }))
    await user.type(screen.getByLabelText('Recovery code'), firstCode)
    await user.click(screen.getByRole('button', { name: 'Unlock with recovery code' }))

    expect(await screen.findByText('This month')).toBeInTheDocument()
  })

  it('does not unlock with an invalid recovery code', async () => {
    const { settings } = await createLockedSettingsWithRecoveryCodes('1234')
    storageState.loadedState = createLoadedState({
      settings: {
        ...createLoadedState().settings,
        ...settings,
      },
    })

    const { user } = renderWithUser(<App />)

    await screen.findByRole('heading', { name: 'Unlock Tally' })
    await user.click(screen.getByRole('button', { name: 'Use recovery code' }))
    await user.type(screen.getByLabelText('Recovery code'), 'ABCD-EFGH')
    await user.click(screen.getByRole('button', { name: 'Unlock with recovery code' }))

    expect(await screen.findByText('Recovery code is invalid or already used.')).toBeInTheDocument()
    expect(screen.queryByText('This month')).not.toBeInTheDocument()
  })

  it('invalidates a used recovery code and still allows PIN fallback', async () => {
    let mockedNow = new Date('2026-04-22T12:00:00.000Z').getTime()
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => mockedNow)
    const { settings, firstCode } = await createLockedSettingsWithRecoveryCodes('1234')
    storageState.loadedState = createLoadedState({
      settings: {
        ...createLoadedState().settings,
        ...settings,
      },
    })

    const { user } = renderWithUser(<App />)

    await screen.findByRole('heading', { name: 'Unlock Tally' })
    await user.click(screen.getByRole('button', { name: 'Use recovery code' }))
    await user.type(screen.getByLabelText('Recovery code'), firstCode)
    await user.click(screen.getByRole('button', { name: 'Unlock with recovery code' }))
    await screen.findByText('This month')

    setDocumentVisibilityState('hidden')
    fireEvent(document, new Event('visibilitychange'))
    mockedNow += APP_LOCK_RELOCK_TIMEOUT_MS + 1_000
    setDocumentVisibilityState('visible')
    fireEvent(document, new Event('visibilitychange'))

    await screen.findByRole('heading', { name: 'Unlock Tally' })
    await user.click(screen.getByRole('button', { name: 'Use recovery code' }))
    await user.clear(screen.getByLabelText('Recovery code'))
    await user.type(screen.getByLabelText('Recovery code'), firstCode)
    await user.click(screen.getByRole('button', { name: 'Unlock with recovery code' }))

    expect(await screen.findByText('Recovery code is invalid or already used.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Use PIN instead' }))
    await user.type(screen.getByLabelText('PIN'), '1234')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(await screen.findByText('This month')).toBeInTheDocument()

    nowSpy.mockRestore()
  })

  it('cleans up recovery metadata when app lock is fully removed', async () => {
    const { user } = renderWithUser(<App />)

    await screen.findByRole('button', { name: 'Settings' })
    await user.click(screen.getByRole('button', { name: 'Settings' }))

    const lockRow = screen.getByText('Lock app on launch').closest('.settings-list-row')

    if (!(lockRow instanceof HTMLElement)) {
      throw new Error('Expected app lock toggle row to be rendered.')
    }

    await user.click(within(lockRow).getByRole('button', { name: 'On' }))
    const pinDialog = await screen.findByRole('dialog', { name: 'Create a PIN' })
    await user.type(within(pinDialog).getByLabelText('New PIN'), '1234')
    await user.type(within(pinDialog).getByLabelText('Confirm PIN'), '1234')
    await user.click(within(pinDialog).getByRole('button', { name: 'Save PIN' }))

    await user.click(await screen.findByRole('button', { name: /Generate one-time recovery codes/i }))
    const recoveryDialog = await screen.findByRole('dialog', { name: 'Save your recovery codes' })
    await user.click(within(recoveryDialog).getByRole('checkbox', { name: 'I saved these recovery codes.' }))
    await user.click(within(recoveryDialog).getByRole('button', { name: 'Done' }))

    await user.click(within(lockRow).getByRole('button', { name: 'Off' }))
    const removeDialog = await screen.findByRole('dialog', { name: 'Remove app lock' })
    await user.type(within(removeDialog).getByLabelText('Current PIN'), '1234')
    await user.click(within(removeDialog).getByRole('button', { name: 'Remove app lock' }))

    await waitFor(() => {
      expect(storageState.saveSpy).toHaveBeenCalled()
    })

    const savedStates = storageState.saveSpy.mock.calls
      .map((call) => call[0] as FinanceState)

    expect(
      savedStates.some(
        (savedState) =>
          savedState.settings.lockAppOnLaunch === false &&
          savedState.settings.appLockPinVerifier === null &&
          savedState.settings.recoveryCodeSet === null,
      ),
    ).toBe(true)
  })

  it('starts locked on fresh launch when app lock is enabled and unlocks with the correct PIN', async () => {
    storageState.loadedState = createLoadedState({
      settings: {
        ...createLoadedState().settings,
        ...(await createLockedSettings('1234')),
      },
    })

    const { user } = renderWithUser(<App />)

    expect(await screen.findByRole('heading', { name: 'Unlock Tally' })).toBeInTheDocument()
    expect(screen.queryByText('This month')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('PIN'), '1234')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))

    expect(await screen.findByText('This month')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Unlock Tally' })).not.toBeInTheDocument()
  })

  it('keeps hide-sensitive masking active after unlock until explicitly revealed', async () => {
    storageState.loadedState = createLoadedState({
      transactions: [
        createTransaction({
          id: 'txn-post-unlock-mask',
          type: 'income',
          amount: 2000,
          categoryId: 'cat-salary',
          note: 'Salary',
        }),
      ],
      settings: {
        ...createLoadedState().settings,
        hideSensitiveData: true,
        ...(await createLockedSettings('1234')),
      },
    })

    const { user } = renderWithUser(<App />)

    await screen.findByRole('heading', { name: 'Unlock Tally' })
    await user.type(screen.getByLabelText('PIN'), '1234')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))

    await screen.findByRole('button', {
      name: 'Sensitive values are hidden. Tap to reveal for this session',
    })
    expect(screen.queryByText('$2,000.00')).not.toBeInTheDocument()
  })

  it('prefers device authentication for unlock when configured', async () => {
    deviceAuthState.supported = true
    deviceAuthState.authenticateResult = { ok: true, message: null }

    storageState.loadedState = createLoadedState({
      settings: {
        ...createLoadedState().settings,
        ...(await createLockedSettingsWithDeviceAuth('1234')),
      },
    })

    const { user } = renderWithUser(<App />)

    expect(await screen.findByRole('button', { name: 'Unlock with device authentication' })).toBeInTheDocument()
    expect(screen.queryByLabelText('PIN')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Unlock with device authentication' }))

    await waitFor(() => {
      expect(deviceAuthState.authenticateSpy).toHaveBeenCalled()
    })
    expect(await screen.findByText('This month')).toBeInTheDocument()
  })

  it('keeps PIN fallback available when device authentication is configured', async () => {
    deviceAuthState.supported = true
    deviceAuthState.authenticateResult = {
      ok: false,
      message: 'Device authentication was cancelled. Use PIN instead.',
    }

    storageState.loadedState = createLoadedState({
      settings: {
        ...createLoadedState().settings,
        ...(await createLockedSettingsWithDeviceAuth('1234')),
      },
    })

    const { user } = renderWithUser(<App />)

    await screen.findByRole('heading', { name: 'Unlock Tally' })
    await user.click(screen.getByRole('button', { name: 'Unlock with device authentication' }))

    expect(await screen.findByText('Device authentication was cancelled. Use PIN instead.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Use PIN instead' }))
    await user.type(screen.getByLabelText('PIN'), '1234')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))

    expect(await screen.findByText('This month')).toBeInTheDocument()
  })

  it('does not unlock when the PIN is incorrect', async () => {
    storageState.loadedState = createLoadedState({
      settings: {
        ...createLoadedState().settings,
        ...(await createLockedSettings('1234')),
      },
    })

    const { user } = renderWithUser(<App />)

    expect(await screen.findByRole('heading', { name: 'Unlock Tally' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('PIN'), '9999')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))

    expect(await screen.findByText('Incorrect PIN.')).toBeInTheDocument()
    expect(screen.queryByText('This month')).not.toBeInTheDocument()
  })

  it('does not relock after a short background switch under the timeout', async () => {
    let mockedNow = new Date('2026-04-22T12:00:00.000Z').getTime()
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => mockedNow)

    storageState.loadedState = createLoadedState({
      settings: {
        ...createLoadedState().settings,
        ...(await createLockedSettings('1234')),
      },
    })

    renderWithUser(<App />)
    await screen.findByRole('heading', { name: 'Unlock Tally' })

    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await screen.findByText('This month')

    setDocumentVisibilityState('hidden')
    fireEvent(document, new Event('visibilitychange'))
    mockedNow += APP_LOCK_RELOCK_TIMEOUT_MS - 1_000
    setDocumentVisibilityState('visible')
    fireEvent(document, new Event('visibilitychange'))

    expect(screen.queryByRole('heading', { name: 'Unlock Tally' })).not.toBeInTheDocument()
    expect(screen.getByText('This month')).toBeInTheDocument()

    nowSpy.mockRestore()
  }, 15000)

  it('relocks after being backgrounded longer than the timeout', async () => {
    let mockedNow = new Date('2026-04-22T12:00:00.000Z').getTime()
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => mockedNow)

    storageState.loadedState = createLoadedState({
      settings: {
        ...createLoadedState().settings,
        ...(await createLockedSettings('1234')),
      },
    })

    renderWithUser(<App />)
    await screen.findByRole('heading', { name: 'Unlock Tally' })

    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await screen.findByText('This month')

    setDocumentVisibilityState('hidden')
    fireEvent(document, new Event('visibilitychange'))
    mockedNow += APP_LOCK_RELOCK_TIMEOUT_MS + 1_000
    setDocumentVisibilityState('visible')
    fireEvent(document, new Event('visibilitychange'))

    expect(await screen.findByRole('heading', { name: 'Unlock Tally' })).toBeInTheDocument()
    expect(screen.queryByText('This month')).not.toBeInTheDocument()

    nowSpy.mockRestore()
  }, 15000)

  it('applies a short cooldown after repeated incorrect PIN attempts', async () => {
    const mockedNow = new Date('2026-04-22T12:00:00.000Z').getTime()
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => mockedNow)

    storageState.loadedState = createLoadedState({
      settings: {
        ...createLoadedState().settings,
        ...(await createLockedSettings('1234')),
      },
    })

    renderWithUser(<App />)

    await screen.findByRole('heading', { name: 'Unlock Tally' })
    const pinInput = screen.getByLabelText('PIN')

    for (let attempt = 0; attempt < 2; attempt += 1) {
      fireEvent.change(pinInput, { target: { value: '9999' } })
      fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

      expect(await screen.findByText('Incorrect PIN.')).toBeInTheDocument()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Unlock' })).toBeEnabled()
      })
    }

    fireEvent.change(pinInput, { target: { value: '9999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    expect(await screen.findByText('Too many incorrect attempts. Try again in a moment.')).toBeInTheDocument()
    expect(await screen.findByText(/Try again in \d+s\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeDisabled()

    nowSpy.mockRestore()
  }, 15000)

  it('does not show backup reminder immediately after first-run privacy confirmation', async () => {
    storageState.loadedState = createLoadedState({
      settings: {
        ...initialFinanceState.settings,
        hasSeenPrivacyModal: false,
        backupRemindersEnabled: true,
        lastBackupAt: null,
        backupReminderBaselineAt: null,
        changesSinceBackup: 0,
        lastReminderAt: null,
      },
      transactions: [],
      budgets: [],
      recurringTemplates: [],
    })

    renderWithUser(<App />)

    const privacyDialog = await screen.findByRole('dialog', {
      name: 'Private by default',
    })

    fireEvent.click(within(privacyDialog).getByRole('button', { name: 'I understand' }))

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Private by default' }),
      ).not.toBeInTheDocument()
    })

    expect(screen.queryByLabelText('Backup reminder')).not.toBeInTheDocument()

    await new Promise((resolve) => {
      window.setTimeout(resolve, 900)
    })

    expect(screen.queryByLabelText('Backup reminder')).not.toBeInTheDocument()

    await waitFor(() => {
      expect(storageState.saveSpy).toHaveBeenCalled()
    })

    const latestSavedState = storageState.saveSpy.mock.lastCall?.[0] as
      | FinanceState
      | undefined

    expect(latestSavedState?.settings.hasSeenPrivacyModal).toBe(true)
    expect(latestSavedState?.settings.lastBackupAt).toBeNull()
    expect(latestSavedState?.settings.backupReminderBaselineAt).not.toBeNull()
    expect(latestSavedState?.settings.changesSinceBackup).toBe(0)
  }, 15000)

  it('preserves existing reminder metadata during first-run privacy confirmation', async () => {
    const existingReminderAt = '2026-03-19T10:00:00.000Z'

    storageState.loadedState = createLoadedState({
      settings: {
        ...initialFinanceState.settings,
        hasSeenPrivacyModal: false,
        backupRemindersEnabled: true,
        lastBackupAt: null,
        backupReminderBaselineAt: null,
        changesSinceBackup: 0,
        lastReminderAt: existingReminderAt,
      },
      transactions: [],
      budgets: [],
      recurringTemplates: [],
    })

    renderWithUser(<App />)

    const privacyDialog = await screen.findByRole('dialog', {
      name: 'Private by default',
    })

    fireEvent.click(within(privacyDialog).getByRole('button', { name: 'I understand' }))

    await waitFor(() => {
      expect(storageState.saveSpy).toHaveBeenCalled()
    })

    const latestSavedState = storageState.saveSpy.mock.lastCall?.[0] as
      | FinanceState
      | undefined

    expect(latestSavedState?.settings.hasSeenPrivacyModal).toBe(true)
    expect(latestSavedState?.settings.lastBackupAt).toBeNull()
    expect(latestSavedState?.settings.backupReminderBaselineAt).toBeNull()
    expect(latestSavedState?.settings.lastReminderAt).toBe(existingReminderAt)
  }, 15000)

  it('supports category deletion flow from settings with confirmation', async () => {
    storageState.loadedState = createLoadedState({
      transactions: [
        {
          id: 'txn-linked-food',
          type: 'expense',
          amount: 42,
          categoryId: 'cat-food',
          note: 'Linked expense',
          occurredAt: createFixtureDate(0),
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-03-20T09:00:00.000Z',
          updatedAt: '2026-03-20T09:00:00.000Z',
        },
      ],
    })

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user } = renderWithUser(<App />)
    await screen.findByRole('button', { name: 'Settings' })
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: 'Manage categories' }))

    await user.click(screen.getByRole('button', { name: /Food/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Update category' })

    await user.click(within(dialog).getByRole('button', { name: 'Delete category' }))

    expect(confirmSpy).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Update category' })).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.queryByText('Food')).not.toBeInTheDocument()
    })

    confirmSpy.mockRestore()
  }, 15000)

  it('edits and deletes an existing transaction from the UI', async () => {
    storageState.loadedState = createLoadedState({
      transactions: [
        createTransaction({
          id: 'txn-edit-me',
          note: 'Old note',
          amount: 31,
        }),
      ],
    })

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user } = renderWithUser(<App />)

    await screen.findByText('Old note')
    await user.click(screen.getByText('Old note'))

    const dialog = await screen.findByRole('dialog', { name: 'Update transaction' })
    const noteInput = within(dialog).getByRole('textbox', { name: 'Note (optional)' })

    await user.clear(noteInput)
    await user.type(noteInput, 'Updated note')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(await screen.findByText('Updated note')).toBeInTheDocument()

    await user.click(screen.getByText('Updated note'))
    const editDialog = await screen.findByRole('dialog', { name: 'Update transaction' })
    await user.click(within(editDialog).getByRole('button', { name: 'Delete transaction' }))

    expect(confirmSpy).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByText('Updated note')).not.toBeInTheDocument()
    })

    confirmSpy.mockRestore()
  })

  it('creates and removes a budget from the budgets screen', async () => {
    storageState.loadedState = createLoadedState({
      transactions: [
        createTransaction({
          id: 'txn-income-budget',
          type: 'income',
          amount: 1500,
          categoryId: 'cat-salary',
          note: 'Salary',
        }),
      ],
    })

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user } = renderWithUser(<App />)

    await screen.findByRole('button', { name: 'Budgets' })
    await user.click(screen.getByRole('button', { name: 'Budgets' }))
    await screen.findByText('Available to budget')

    await user.click(screen.getByRole('button', { name: '+ Add budget' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create budget' })

    await user.type(within(dialog).getByRole('textbox', { name: 'Budget name' }), 'Food budget')
    await user.click(within(dialog).getByRole('button', { name: /Food/i }))
    await user.type(within(dialog).getByRole('spinbutton', { name: 'Monthly limit' }), '100')
    await user.click(within(dialog).getByRole('button', { name: 'Save budget' }))

    expect(await screen.findByText('Food budget')).toBeInTheDocument()
    expect(screen.getByText('$1,400.00 left')).toBeInTheDocument()

    await user.click(screen.getByText('Food budget'))
    const editDialog = await screen.findByRole('dialog', { name: 'Update budget' })
    await user.click(within(editDialog).getByRole('button', { name: 'Remove budget' }))

    expect(confirmSpy).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByText('Food budget')).not.toBeInTheDocument()
    })

    confirmSpy.mockRestore()
  }, 10000)

  it('renders insights bars and charts views with seeded history', async () => {
    storageState.loadedState = createLoadedState({
      transactions: [
        createTransaction({
          id: 'txn-insight-current',
          note: 'Current groceries',
          amount: 90,
          occurredAt: createFixtureDate(0),
        }),
        createTransaction({
          id: 'txn-insight-prev-month',
          note: 'Previous groceries',
          amount: 80,
          occurredAt: `${createFixtureDate(0).slice(0, 5)}02-10`,
          createdAt: '2026-02-10T08:00:00.000Z',
          updatedAt: '2026-02-10T08:00:00.000Z',
        }),
      ],
    })

    const { user } = renderWithUser(<App />)

    await screen.findByRole('button', { name: 'Insights' })
    await user.click(screen.getByRole('button', { name: 'Insights' }))

    expect(await screen.findByText('Monthly spending')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Charts' }))

    expect(await screen.findByRole('img', { name: 'Monthly spending trend chart' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Top spending categories donut chart' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '3M' }))
    expect(screen.getAllByText('spent in the last 3 months').length).toBeGreaterThan(0)
  })

  it('adds a due recurring occurrence from the home screen', async () => {
    storageState.loadedState = createLoadedState({
      recurringTemplates: [
        createRecurringTemplate({
          id: 'rec-gym',
          note: 'Gym pass',
          nextDueDate: createFixtureDate(0),
        }),
      ],
    })

    const { user } = renderWithUser(<App />)

    await screen.findByText('Recurring due')
    await user.click(screen.getByRole('button', { name: 'Review' }))
    expect(await screen.findByRole('button', { name: 'Add occurrence' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add occurrence' }))
    expect(await screen.findByText('Added recurring occurrence.')).toBeInTheDocument()
    expect(await screen.findByText('Gym pass')).toBeInTheDocument()
  })

  it('stops a recurring template from the home screen review state', async () => {
    storageState.loadedState = createLoadedState({
      recurringTemplates: [
        createRecurringTemplate({
          id: 'rec-stop',
          note: 'Stop me',
          nextDueDate: createFixtureDate(0),
        }),
      ],
    })

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user } = renderWithUser(<App />)

    await screen.findByText('Recurring due')
    await user.click(screen.getByRole('button', { name: 'Review' }))
    await user.click(screen.getByRole('button', { name: 'Stop recurring' }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(await screen.findByText('Recurring stopped.')).toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  it('exports CSV and creates a backup from settings', async () => {
    storageState.loadedState = createLoadedState({
      transactions: [createTransaction({ id: 'txn-export', note: 'Export me' })],
    })

    const { user } = renderWithUser(<App />)

    await screen.findByRole('button', { name: 'Settings' })
    await user.click(screen.getByRole('button', { name: 'Settings' }))

    await user.click(screen.getByRole('button', { name: 'Create backup' }))
    expect(await screen.findByText('Backup downloaded successfully.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Export CSV/i }))

    expect(storageState.downloadSpy).toHaveBeenCalledTimes(2)
    expect(storageState.downloadSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^tally-backup-/),
      expect.stringContaining('"schemaVersion": 2'),
      'application/json;charset=utf-8',
    )
    expect(storageState.downloadSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^tally-transactions-/),
      expect.stringContaining('Export me'),
      'text/csv;charset=utf-8',
    )
  })
})
