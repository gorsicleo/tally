import { describe, expect, it } from 'vitest'
import { initialFinanceState } from './default-data'
import type { FinanceState, Transaction } from './models'
import { exportTransactionsAsCsv } from './exporters'

function createTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? 'txn-default',
    type: overrides.type ?? 'expense',
    amount: overrides.amount ?? 1,
    categoryId: overrides.categoryId ?? 'cat-food',
    note: overrides.note ?? '',
    occurredAt: overrides.occurredAt ?? '2026-03-20',
    recurringTemplateId: overrides.recurringTemplateId ?? null,
    recurringOccurrenceDate: overrides.recurringOccurrenceDate ?? null,
    createdAt: overrides.createdAt ?? '2026-03-20T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-20T10:00:00.000Z',
  }
}

function createState(transactions: Transaction[]): FinanceState {
  return {
    ...initialFinanceState,
    categories: [...initialFinanceState.categories],
    transactions,
  }
}

describe('exportTransactionsAsCsv', () => {
  it('returns only header when there are no transactions', () => {
    const csv = exportTransactionsAsCsv(createState([]))

    expect(csv).toBe('id,type,amount,category,note,occurredAt,updatedAt')
  })

  it('sorts transactions by occurredAt descending and then by createdAt descending', () => {
    const csv = exportTransactionsAsCsv(
      createState([
        createTransaction({
          id: 'txn-old',
          occurredAt: '2026-03-19',
          createdAt: '2026-03-19T08:00:00.000Z',
        }),
        createTransaction({
          id: 'txn-newer-created',
          occurredAt: '2026-03-20',
          createdAt: '2026-03-20T12:00:00.000Z',
        }),
        createTransaction({
          id: 'txn-older-created',
          occurredAt: '2026-03-20',
          createdAt: '2026-03-20T07:00:00.000Z',
        }),
      ]),
    )

    const lines = csv.split('\n')

    expect(lines[1].startsWith('txn-newer-created,')).toBe(true)
    expect(lines[2].startsWith('txn-older-created,')).toBe(true)
    expect(lines[3].startsWith('txn-old,')).toBe(true)
  })

  it('escapes commas, quotes, and multiline notes according to CSV rules', () => {
    const csv = exportTransactionsAsCsv(
      createState([
        createTransaction({
          id: 'txn-special',
          note: 'Coffee, "beans"\nRefill',
        }),
      ]),
    )

    const line = csv.split('\n')[1]

    expect(line).toContain('"Coffee, ""beans""')
    expect(csv).toContain('\nRefill"')
  })

  it('falls back to Unknown when transaction category is missing', () => {
    const csv = exportTransactionsAsCsv(
      createState([
        createTransaction({
          id: 'txn-missing-category',
          categoryId: 'cat-missing',
        }),
      ]),
    )

    const line = csv.split('\n')[1]

    expect(line).toContain(',Unknown,')
  })
})