import { useDeferredValue, useMemo, useState } from 'react'
import { formatCurrency } from '../../domain/formatters'
import { getOverviewForTransactions, getSortedTransactions } from '../../domain/selectors'
import type { Transaction, TransactionType } from '../../domain/models'
import { useFinance } from '../../state/use-finance'
import { toLocalDateKey } from '../../utils/date'
import { TransactionHistory } from './transaction-history'

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom'

interface TransactionsScreenProps {
  onEditTransaction: (transaction: Transaction) => void
}

function getPresetRange(preset: Exclude<DatePreset, 'custom'>): {
  startDate: string
  endDate: string
} {
  if (preset === 'all') {
    return { startDate: '', endDate: '' }
  }

  const today = new Date()
  const endDate = toLocalDateKey(today)

  if (preset === 'today') {
    return { startDate: endDate, endDate }
  }

  if (preset === 'week') {
    const weekStart = new Date(today)
    const offset = (weekStart.getDay() + 6) % 7
    weekStart.setDate(weekStart.getDate() - offset)

    return {
      startDate: toLocalDateKey(weekStart),
      endDate,
    }
  }

  return {
    startDate: toLocalDateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate,
  }
}

export function TransactionsScreen({
  onEditTransaction,
}: TransactionsScreenProps) {
  const { state } = useFinance()
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [visibleCount, setVisibleCount] = useState(25)
  const deferredQuery = useDeferredValue(searchQuery)

  const categoriesById = useMemo(
    () => new Map(state.categories.map((category) => [category.id, category])),
    [state.categories],
  )

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase()

    return getSortedTransactions(state.transactions).filter((transaction) => {
      if (typeFilter !== 'all' && transaction.type !== typeFilter) {
        return false
      }

      if (categoryFilter !== 'all' && transaction.categoryId !== categoryFilter) {
        return false
      }

      if (startDate && transaction.occurredAt < startDate) {
        return false
      }

      if (endDate && transaction.occurredAt > endDate) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const categoryName =
        categoriesById.get(transaction.categoryId)?.name.toLowerCase() ?? ''

      return (
        transaction.note.toLowerCase().includes(normalizedQuery) ||
        categoryName.includes(normalizedQuery) ||
        transaction.occurredAt.includes(normalizedQuery)
      )
    })
  }, [categoriesById, categoryFilter, deferredQuery, endDate, startDate, state.transactions, typeFilter])

  const visibleTransactions = filteredTransactions.slice(0, visibleCount)
  const filteredOverview = useMemo(
    () => getOverviewForTransactions(filteredTransactions),
    [filteredTransactions],
  )
  const hasMore = visibleTransactions.length < filteredTransactions.length

  const applyPreset = (preset: Exclude<DatePreset, 'custom'>) => {
    const range = getPresetRange(preset)

    setDatePreset(preset)
    setStartDate(range.startDate)
    setEndDate(range.endDate)
    setVisibleCount(25)
  }

  return (
    <div className="screen-stack">
      <section className="panel toolbar-panel records-toolbar-panel">
        <div>
          <p className="eyebrow">RECORDS</p>
          <h2>Transaction history</h2>
          <p>Search first, skim quickly, and open any row for details or deletion.</p>
        </div>

        <label className="records-search-field">
          Search transactions
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
              setVisibleCount(25)
            }}
            placeholder="Search notes or categories"
          />
        </label>

        <div className="records-toolbar-footer">
          <div className="records-total-bar">
            <span>{filteredTransactions.length} results</span>
            <strong>{formatCurrency(filteredOverview.balance, state.settings.currency)}</strong>
          </div>

          <button
            type="button"
            className="ghost-button compact"
            onClick={() => setShowFilters((current) => !current)}
          >
            {showFilters ? 'Hide filters' : 'More filters'}
          </button>
        </div>
      </section>

      <div className="records-quick-filters" role="group" aria-label="Quick date filters">
        {(
          [
            ['all', 'All'],
            ['today', 'Today'],
            ['week', 'This week'],
            ['month', 'This month'],
          ] as const
        ).map(([preset, label]) => (
          <button
            key={preset}
            type="button"
            className={`filter-chip ${datePreset === preset ? 'active' : ''}`.trim()}
            onClick={() => applyPreset(preset)}
          >
            {label}
          </button>
        ))}
      </div>

      {showFilters ? (
        <section className="panel filter-panel records-filter-panel">
          <div className="filters-panel">
            <div className="filter-grid">
              <label>
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    setDatePreset('custom')
                    setStartDate(event.target.value)
                    setVisibleCount(25)
                  }}
                />
              </label>

              <label>
                End date
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => {
                    setDatePreset('custom')
                    setEndDate(event.target.value)
                    setVisibleCount(25)
                  }}
                />
              </label>
            </div>

            <div className="filter-grid">
              <label>
                Category
                <select
                  value={categoryFilter}
                  onChange={(event) => {
                    setCategoryFilter(event.target.value)
                    setVisibleCount(25)
                  }}
                >
                  <option value="all">All categories</option>
                  {state.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="pill-switch" role="group" aria-label="Transaction filter">
                {(['all', 'expense', 'income'] as const).map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    className={typeFilter === entry ? 'active' : ''}
                    onClick={() => {
                      setTypeFilter(entry)
                      setVisibleCount(25)
                    }}
                  >
                    {entry}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <TransactionHistory
        categories={state.categories}
        transactions={visibleTransactions}
        currency={state.settings.currency}
        emptyMessage="No transactions match this filter yet."
        onEdit={onEditTransaction}
      />

      {hasMore ? (
        <div className="history-footer">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setVisibleCount((current) => current + 25)}
          >
            Load more
          </button>
        </div>
      ) : null}
    </div>
  )
}
