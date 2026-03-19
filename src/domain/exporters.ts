import type { FinanceState } from './models'
import { getSortedTransactions } from './selectors'

function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`
  }

  return value
}

export function exportTransactionsAsCsv(state: FinanceState): string {
  const categoriesById = new Map(
    state.categories.map((category) => [category.id, category.name]),
  )
  const rows = getSortedTransactions(state.transactions).map((transaction) => {
    const categoryName = categoriesById.get(transaction.categoryId) ?? 'Unknown'

    return [
      transaction.id,
      transaction.type,
      transaction.amount.toFixed(2),
      categoryName,
      transaction.note,
      transaction.occurredAt,
      transaction.syncStatus,
      transaction.updatedAt,
    ]
      .map((cell) => escapeCsvCell(String(cell)))
      .join(',')
  })

  return [
    'id,type,amount,category,note,occurredAt,syncStatus,updatedAt',
    ...rows,
  ].join('\n')
}
