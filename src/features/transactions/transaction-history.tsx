import { useMemo } from 'react'
import {
  formatCompactDateLabel,
  formatLongDateLabel,
} from '../../domain/formatters'
import type { Category, Transaction } from '../../domain/models'
import { formatSensitiveCurrency } from '../privacy/sensitive-data'
import { getTodayLocalDate, shiftLocalDateKey } from '../../utils/date'

interface TransactionHistoryProps {
  title?: string
  embedInPanel?: boolean
  categories: Category[]
  transactions: Transaction[]
  currency: string
  hideSensitiveValues?: boolean
  emptyMessage?: string
  onEdit: (transaction: Transaction) => void
}

interface TransactionGroup {
  key: string
  label: string
  transactions: Transaction[]
}

function getGroupLabel(isoDate: string): string {
  const todayKey = getTodayLocalDate()
  const yesterdayKey = shiftLocalDateKey(todayKey, -1)

  if (isoDate === todayKey) {
    return 'Today'
  }

  if (isoDate === yesterdayKey) {
    return 'Yesterday'
  }

  return formatLongDateLabel(isoDate)
}

export function TransactionHistory({
  title,
  embedInPanel = false,
  categories,
  transactions,
  currency,
  hideSensitiveValues = false,
  emptyMessage,
  onEdit,
}: TransactionHistoryProps) {
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const groups = useMemo(() => {
    const groupedTransactions = new Map<string, TransactionGroup>()

    transactions.forEach((transaction) => {
      const existingGroup = groupedTransactions.get(transaction.occurredAt)

      if (existingGroup) {
        existingGroup.transactions.push(transaction)
        return
      }

      groupedTransactions.set(transaction.occurredAt, {
        key: transaction.occurredAt,
        label: getGroupLabel(transaction.occurredAt),
        transactions: [transaction],
      })
    })

    return [...groupedTransactions.values()]
  }, [transactions])

  const content = groups.length === 0 ? (
    <p className="empty-state">
      {emptyMessage ?? 'No records match this filter yet.'}
    </p>
  ) : (
    <div className="history-groups">
      {groups.map((group) => (
        <section className="history-group" key={group.key}>
          <header className="history-date-header">{group.label}</header>

          <ul className="transaction-list">
            {group.transactions.map((transaction) => {
              const category = categoriesById.get(transaction.categoryId)
              const isExpense = transaction.type === 'expense'
              const primaryLabel = transaction.note || category?.name || 'Transaction'
              const metaBits = [formatCompactDateLabel(transaction.occurredAt)]

              if (transaction.note && category?.name) {
                metaBits.unshift(category.name)
              }

              if (transaction.recurringTemplateId) {
                metaBits.push('Recurring')
              }

              return (
                <li
                  className="transaction-item compact-record interactive"
                  key={transaction.id}
                  onClick={() => onEdit(transaction)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onEdit(transaction)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="transaction-main">
                    <div className="transaction-note-row">
                      <p className="transaction-note">{primaryLabel}</p>
                    </div>

                    <div className="transaction-meta compact-meta">
                      {metaBits.map((bit, index) => (
                          <span key={`${transaction.id}-${bit}-${index}`}>
                          {index > 0 ? (
                            <span className="transaction-meta-separator" aria-hidden="true">
                              •
                            </span>
                          ) : null}
                          {bit}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="transaction-tail">
                    <p className={`transaction-amount ${transaction.type}`}>
                      {isExpense ? '-' : '+'}
                      {formatSensitiveCurrency(
                        transaction.amount,
                        currency,
                        hideSensitiveValues,
                      )}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )

  if (embedInPanel) {
    return (
      <article className="panel transaction-panel">
        {title ? <h3>{title}</h3> : null}
        {content}
      </article>
    )
  }

  if (groups.length === 0) {
    return (
      <article className="panel transaction-panel">
        {content}
      </article>
    )
  }

  return content
}
