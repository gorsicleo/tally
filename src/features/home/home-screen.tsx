import { useMemo } from 'react'
import { formatCurrency, formatMonthLabel } from '../../domain/formatters'
import {
  getCategoryTotals,
  getComparisonOverview,
  getMonthKey,
  getMonthlyOverview,
  getRecentTransactions,
} from '../../domain/selectors'
import type { Transaction } from '../../domain/models'
import { RecurringDueSection } from '../recurring/recurring-due-section'
import { useFinance } from '../../state/use-finance'
import { TransactionHistory } from '../transactions/transaction-history'
import type { AppTab } from '../shell/tab-bar'

interface HomeScreenProps {
  onNavigate: (tab: AppTab) => void
  onEditTransaction: (transaction: Transaction) => void
  onEditRecurring: (templateId: string) => void
  onShowToast: (message: string) => void
}

export function HomeScreen({
  onNavigate,
  onEditTransaction,
  onEditRecurring,
  onShowToast,
}: HomeScreenProps) {
  const { state } = useFinance()
  const monthKey = useMemo(() => getMonthKey(), [])
  const monthLabel = useMemo(() => formatMonthLabel(monthKey), [monthKey])
  const monthTotals = useMemo(
    () => getMonthlyOverview(state, monthKey),
    [state, monthKey],
  )
  const comparison = useMemo(
    () => getComparisonOverview(state, monthKey),
    [state, monthKey],
  )
  const recentTransactions = useMemo(
    () => getRecentTransactions(state, 6),
    [state],
  )
  const topCategory = useMemo(
    () => getCategoryTotals(state, monthKey, 'expense')[0] ?? null,
    [state, monthKey],
  )
  const currency = state.settings.currency

  const netTone = monthTotals.balance >= 0 ? 'positive' : 'negative'
  const comparisonText =
    comparison.delta.expense === 0
      ? 'Your expense pace matches last month so far.'
      : comparison.delta.expense > 0
        ? `You spent ${formatCurrency(comparison.delta.expense, currency)} more than last month.`
        : `You spent ${formatCurrency(Math.abs(comparison.delta.expense), currency)} less than last month.`

  return (
    <div className="screen-stack">
      <section className="panel home-summary-card">
        <div className="section-heading-row compact-end">
          <div>
            <p className="eyebrow">This month</p>
            <p>{monthLabel}</p>
          </div>
        </div>

        <div className="financial-rows">
          <div className="financial-row">
            <span>Income</span>
            <strong className="income">{formatCurrency(monthTotals.income, currency)}</strong>
          </div>
          <div className="financial-row">
            <span>Expenses</span>
            <strong className="expense">{formatCurrency(monthTotals.expense, currency)}</strong>
          </div>
          <div className="financial-row net-row">
            <span>Net</span>
            <strong className={netTone}>{formatCurrency(monthTotals.balance, currency)}</strong>
          </div>
        </div>
      </section>

      <RecurringDueSection
        currency={currency}
        onOpenRecurringEditor={onEditRecurring}
        onShowToast={onShowToast}
      />

      <section className="screen-grid secondary-grid">
        <TransactionHistory
          title="Recent transactions"
          embedInPanel
          categories={state.categories}
          transactions={recentTransactions}
          currency={currency}
          emptyMessage="Your latest activity will show up here."
          onEdit={onEditTransaction}
        />

        <article className="panel spotlight-card single-insight-card">
          <p className="eyebrow">INSIGHT</p>
          {topCategory ? (
            <>
              <h3>Top category: {topCategory.name}</h3>
              <p>
                {formatCurrency(topCategory.total, currency)} across {topCategory.count}{' '}
                transaction{topCategory.count === 1 ? '' : 's'} this month.
              </p>
            </>
          ) : (
            <>
              <h3>Monthly comparison</h3>
              <p>{comparisonText}</p>
            </>
          )}

          <button
            type="button"
            className="text-button"
            onClick={() => onNavigate(topCategory ? 'insights' : 'transactions')}
          >
            {topCategory ? 'Open insights' : 'Open records'}
          </button>
        </article>
      </section>
    </div>
  )
}
