import { useMemo } from 'react'
import { formatCurrency, formatDateLabel } from '../../domain/formatters'
import type { Category, Transaction } from '../../domain/models'

interface TransactionListProps {
  title?: string
  categories: Category[]
  transactions: Transaction[]
  currency: string
  emptyMessage?: string
  onSelect?: (transaction: Transaction) => void
}

export function TransactionList({
  title,
  categories,
  transactions,
  currency,
  emptyMessage,
  onSelect,
}: TransactionListProps) {
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  return (
    <article className="panel transaction-panel">
      {title ? <h3>{title}</h3> : null}

      {transactions.length === 0 ? (
        <p className="empty-state">
          {emptyMessage ?? 'No entries yet. Add your first transaction to start tracking trends.'}
        </p>
      ) : (
        <ul className="transaction-list">
          {transactions.map((transaction) => {
            const category = categoriesById.get(transaction.categoryId)
            const isExpense = transaction.type === 'expense'
            const note = transaction.note || 'No note'

            return (
              <li
                className={`transaction-item ${onSelect ? 'interactive' : ''}`.trim()}
                key={transaction.id}
                onClick={onSelect ? () => onSelect(transaction) : undefined}
                onKeyDown={
                  onSelect
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onSelect(transaction)
                        }
                      }
                    : undefined
                }
                role={onSelect ? 'button' : undefined}
                tabIndex={onSelect ? 0 : undefined}
              >
                <span
                  className={`transaction-kind ${transaction.type}`}
                  aria-label={transaction.type}
                >
                  {transaction.type}
                </span>

                <div className="transaction-main">
                  <p className="transaction-note">{note}</p>
                  <div className="transaction-meta">
                    <span className="transaction-category">
                      {category?.name ?? 'Unknown'}
                    </span>
                    <span>{formatDateLabel(transaction.occurredAt)}</span>
                    {transaction.recurringTemplateId ? (
                      <span className="mini-pill neutral">Recurring</span>
                    ) : null}
                  </div>
                </div>

                <div className="transaction-tail">
                  <p className={`transaction-amount ${transaction.type}`}>
                    {isExpense ? '-' : '+'}
                    {formatCurrency(transaction.amount, currency)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}
