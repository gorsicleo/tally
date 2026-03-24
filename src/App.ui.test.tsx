import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import App from './App'
import { initialFinanceState } from './domain/default-data'
import type { FinanceState, RecurringTemplate, Transaction } from './domain/models'
import { toLocalDateKey } from './utils/date'
import { renderWithUser } from './test/render-utils'

const storageState = vi.hoisted(() => ({
  loadedState: null as FinanceState | null,
  saveSpy: vi.fn(async () => undefined),
  downloadSpy: vi.fn(),
  restoreResult: {
    ok: false as const,
    message: 'This backup file is not valid.',
  },
}))

vi.mock('./persistence/finance-storage', () => ({
  loadFinanceState: vi.fn(async () => storageState.loadedState),
  saveFinanceState: storageState.saveSpy,
}))

vi.mock('./utils/download', () => ({
  downloadTextFile: storageState.downloadSpy,
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

describe('App UI behavior', () => {
  beforeEach(() => {
    storageState.loadedState = createLoadedState()
    storageState.saveSpy.mockClear()
    storageState.downloadSpy.mockClear()
    storageState.restoreResult = {
      ok: false,
      message: 'This backup file is not valid.',
    }
    window.localStorage.clear()
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
    await user.click(within(dialog).getByRole('checkbox', { name: /Food/i }))
    await user.click(within(dialog).getByRole('button', { name: '$100.00' }))
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
