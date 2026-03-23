import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initialFinanceState } from '../../domain/default-data'
import type { RecurringTemplate, Transaction } from '../../domain/models'
import { getTodayLocalDate } from '../../utils/date'
import { TransactionEditorSheet } from './transaction-editor-sheet'

const SHEET_DEFAULTS_KEY = 'tally.transaction-sheet.defaults.v1'

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    type: 'expense',
    amount: 18.5,
    categoryId: 'cat-food',
    note: 'Lunch',
    occurredAt: '2026-03-20',
    recurringTemplateId: null,
    recurringOccurrenceDate: null,
    createdAt: '2026-03-20T08:00:00.000Z',
    updatedAt: '2026-03-20T08:00:00.000Z',
    syncStatus: 'synced',
    ...overrides,
  }
}

function createRecurringTemplate(
  overrides: Partial<RecurringTemplate> = {},
): RecurringTemplate {
  return {
    id: 'rec-1',
    type: 'expense',
    amount: 18.5,
    categoryId: 'cat-food',
    note: 'Lunch plan',
    frequency: 'monthly',
    intervalDays: null,
    startDate: '2026-03-01',
    nextDueDate: '2026-04-01',
    active: true,
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-03-01T08:00:00.000Z',
    syncStatus: 'synced',
    ...overrides,
  }
}

function renderSheet(
  overrides: Partial<React.ComponentProps<typeof TransactionEditorSheet>> = {},
) {
  const onClose = vi.fn()
  const onCreate = vi.fn()
  const onUpdate = vi.fn()
  const onDelete = vi.fn()
  const onEditFutureRecurring = vi.fn()
  const onStopRecurring = vi.fn()
  const user = userEvent.setup(
    vi.isFakeTimers() ? { advanceTimers: vi.advanceTimersByTime } : undefined,
  )

  const view = render(
    <TransactionEditorSheet
      mode="create"
      categories={initialFinanceState.categories}
      onClose={onClose}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onEditFutureRecurring={onEditFutureRecurring}
      onStopRecurring={onStopRecurring}
      {...overrides}
    />,
  )

  return {
    user,
    onClose,
    onCreate,
    onUpdate,
    onDelete,
    onEditFutureRecurring,
    onStopRecurring,
    ...view,
  }
}

describe('TransactionEditorSheet', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('creates a recurring transaction using stored defaults', async () => {
    window.localStorage.setItem(
      SHEET_DEFAULTS_KEY,
      JSON.stringify({
        lastType: 'income',
        lastCategoryByType: {
          income: 'cat-freelance',
        },
      }),
    )

    const { user, onCreate } = renderSheet()

    fireEvent.change(screen.getByLabelText('Amount'), {
      target: { value: '1200' },
    })
    await user.click(screen.getByRole('button', { name: /Repeat/i }))
    await user.click(screen.getByRole('button', { name: 'Custom' }))
    await user.clear(screen.getByLabelText('Repeat every how many days?'))
    await user.type(screen.getByLabelText('Repeat every how many days?'), '10')
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2026-03-25' },
    })
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onCreate).toHaveBeenCalledWith(
      {
        type: 'income',
        amount: 1200,
        categoryId: 'cat-freelance',
        note: '',
        occurredAt: getTodayLocalDate(),
      },
      {
        frequency: 'custom',
        intervalDays: 10,
        startDate: '2026-03-25',
      },
    )

    expect(JSON.parse(window.localStorage.getItem(SHEET_DEFAULTS_KEY) ?? '{}')).toEqual({
      lastType: 'income',
      lastCategoryByType: {
        income: 'cat-freelance',
      },
    })
  })

  it('supports expanded category, date, and note controls in create mode', async () => {
    const { user, onCreate } = renderSheet()

    fireEvent.change(screen.getByLabelText('Amount'), {
      target: { value: '42.5' },
    })
    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.selectOptions(screen.getByLabelText('All categories'), 'cat-fun')
    await user.click(screen.getByRole('button', { name: 'Today' }))
    fireEvent.change(screen.getByLabelText('Transaction date'), {
      target: { value: '2026-03-22' },
    })
    await user.click(screen.getByRole('button', { name: '+ Add note' }))
    await user.type(screen.getByPlaceholderText('Add note'), 'Movie night')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onCreate).toHaveBeenCalledWith(
      {
        type: 'expense',
        amount: 42.5,
        categoryId: 'cat-fun',
        note: 'Movie night',
        occurredAt: '2026-03-22',
      },
      null,
    )
  })

  it('updates an existing transaction in edit mode', async () => {
    const { user, onUpdate } = renderSheet({
      mode: 'edit',
      initialTransaction: createTransaction(),
    })

    fireEvent.change(screen.getByLabelText('Amount'), {
      target: { value: '55' },
    })
    await user.clear(screen.getByDisplayValue('Lunch'))
    await user.type(screen.getByPlaceholderText('Add note'), 'Team lunch')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onUpdate).toHaveBeenCalledWith({
      id: 'txn-1',
      type: 'expense',
      amount: 55,
      categoryId: 'cat-food',
      note: 'Team lunch',
      occurredAt: '2026-03-20',
    })
  })

  it('routes recurring series actions for future occurrences in edit mode', async () => {
    vi.useFakeTimers()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const firstRender = renderSheet({
      mode: 'edit',
      initialTransaction: createTransaction({ recurringTemplateId: 'rec-1' }),
      recurringTemplate: createRecurringTemplate(),
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Edit future recurring transactions' }),
    )

    expect(firstRender.onEditFutureRecurring).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(firstRender.onEditFutureRecurring).toHaveBeenCalledWith('rec-1')
    expect(firstRender.onClose).toHaveBeenCalled()
    firstRender.unmount()

    const secondRender = renderSheet({
      mode: 'edit',
      initialTransaction: createTransaction({ recurringTemplateId: 'rec-1' }),
      recurringTemplate: createRecurringTemplate(),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Stop recurring' }))

    expect(confirmSpy).toHaveBeenCalledWith('Stop recurring for future occurrences?')
    expect(secondRender.onStopRecurring).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(secondRender.onStopRecurring).toHaveBeenCalledWith('rec-1')
  })

  it('deletes an existing transaction after confirmation', async () => {
    vi.useFakeTimers()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user, onDelete, onClose } = renderSheet({
      mode: 'edit',
      initialTransaction: createTransaction(),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete transaction' }))

    expect(confirmSpy).toHaveBeenCalledWith('Delete Lunch from history?')
    expect(onDelete).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onDelete).toHaveBeenCalledWith('txn-1')
    expect(onClose).toHaveBeenCalled()
  })
})