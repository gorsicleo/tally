import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { TransactionsScreen } from './transactions-screen'
import { createFinanceContextValue, renderWithFinance } from '../../test/finance-test-utils'
import { initialFinanceState } from '../../domain/default-data'
import type { FinanceState, Transaction } from '../../domain/models'
import { toLocalDateKey } from '../../utils/date'

function createDate(offsetDays = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return toLocalDateKey(date)
}

function createTransaction(index: number, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id ?? `txn-${index}`,
    type: overrides.type ?? 'expense',
    amount: overrides.amount ?? index + 1,
    categoryId: overrides.categoryId ?? 'cat-food',
    note: overrides.note ?? `Transaction ${index}`,
    occurredAt: overrides.occurredAt ?? createDate(-index),
    recurringTemplateId: overrides.recurringTemplateId ?? null,
    recurringOccurrenceDate: overrides.recurringOccurrenceDate ?? null,
    createdAt: overrides.createdAt ?? `2026-03-${String((index % 28) + 1).padStart(2, '0')}T08:00:00.000Z`,
    updatedAt: overrides.updatedAt ?? `2026-03-${String((index % 28) + 1).padStart(2, '0')}T08:00:00.000Z`,
  }
}

function createState(transactions: Transaction[]): FinanceState {
  return {
    ...initialFinanceState,
    categories: [...initialFinanceState.categories],
    transactions,
  }
}

describe('TransactionsScreen', () => {
  it('filters by search, category, type, and custom date range', async () => {
    const onEditTransaction = vi.fn()
    const state = createState([
      createTransaction(1, {
        id: 'txn-food',
        note: 'Lunch',
        categoryId: 'cat-food',
        occurredAt: createDate(0),
      }),
      createTransaction(2, {
        id: 'txn-income',
        type: 'income',
        note: 'Salary',
        categoryId: 'cat-salary',
        occurredAt: createDate(-1),
      }),
      createTransaction(3, {
        id: 'txn-transport',
        note: 'Bus',
        categoryId: 'cat-transport',
        occurredAt: createDate(-10),
      }),
    ])

    const { user } = renderWithFinance(
      <TransactionsScreen onEditTransaction={onEditTransaction} />,
      createFinanceContextValue({ state }),
    )

    await user.type(screen.getByRole('searchbox', { name: 'Search transactions' }), 'Lunch')
    expect(await screen.findByText('1 results')).toBeInTheDocument()
    expect(screen.queryByText('Salary')).not.toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: 'Search transactions' }))
    await user.click(screen.getByRole('button', { name: 'More filters' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'cat-transport')
    expect(await screen.findByText('Bus')).toBeInTheDocument()
    expect(screen.queryByText('Lunch')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'all')
    await user.click(screen.getByRole('button', { name: 'income' }))
    expect(screen.getAllByText('Salary').length).toBeGreaterThan(0)
    expect(screen.queryByText('Bus')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'all' }))
    await user.clear(screen.getByLabelText('Start date'))
    await user.type(screen.getByLabelText('Start date'), createDate(-2))
    await user.clear(screen.getByLabelText('End date'))
    await user.type(screen.getByLabelText('End date'), createDate(0))
    expect(await screen.findByText('Lunch')).toBeInTheDocument()
    expect(screen.queryByText('Bus')).not.toBeInTheDocument()
  }, 15000)

  it('applies quick date presets and resets visible count on load more', async () => {
    const transactions = Array.from({ length: 30 }, (_, index) =>
      createTransaction(index + 1, {
        note: `Bulk ${index + 1}`,
        occurredAt: createDate(0),
      }),
    )
    const { user } = renderWithFinance(
      <TransactionsScreen onEditTransaction={vi.fn()} />,
      createFinanceContextValue({ state: createState(transactions) }),
    )

    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument()
    expect(document.querySelectorAll('.transaction-item')).toHaveLength(25)

    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
    expect(document.querySelectorAll('.transaction-item')).toHaveLength(30)

    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument()
    expect(document.querySelectorAll('.transaction-item')).toHaveLength(25)
  }, 15000)

  it('invokes edit callback when a visible transaction row is opened', async () => {
    const transaction = createTransaction(1, {
      id: 'txn-open',
      note: 'Open me',
      occurredAt: createDate(0),
    })
    const onEditTransaction = vi.fn()
    const { user } = renderWithFinance(
      <TransactionsScreen onEditTransaction={onEditTransaction} />,
      createFinanceContextValue({ state: createState([transaction]) }),
    )

    await user.click(await screen.findByText('Open me'))
    expect(onEditTransaction).toHaveBeenCalledWith(transaction)
  })
})