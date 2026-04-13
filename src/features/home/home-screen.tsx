import { useMemo } from 'react'
import { formatCurrency, formatMonthLabel } from '../../domain/formatters'
import {
  getBudgetSignals,
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
  const budgetAlerts = useMemo(
    () =>
      getBudgetSignals(state, monthKey).filter(
        (entry) => entry.tone === 'warning' || entry.tone === 'danger',
      ),
    [monthKey, state],
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

      {!state.settings.hideOverspendingBudgetsInHome && budgetAlerts.length > 0 ? (
        <section className="panel budget-signal-list home-budget-alerts" aria-label="Overspent budgets">
          <div className="section-heading-row budget-list-header">
            <div>
              <p className="eyebrow">Overspent budgets</p>
              <p>Budgets close to overspending this month.</p>
            </div>
          </div>

          {budgetAlerts.map((entry) => {
            const statusLabel =
              entry.remaining >= 0
                ? `${formatCurrency(entry.remaining, currency)} left`
                : `${formatCurrency(Math.abs(entry.remaining), currency)} over`
            const detailLabel = `${formatCurrency(entry.spent, currency)} / ${formatCurrency(entry.limit, currency)}`
            const categoriesLabel = entry.categories.map((category) => category.name).join(', ')

            return (
              <article
                key={entry.budget.id}
                className={`budget-signal-row ${entry.tone}`.trim()}
                onClick={() => onNavigate('budgets')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onNavigate('budgets')
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="budget-signal-head">
                  <div className="budget-signal-name">
                    <strong>{entry.budget.name}</strong>
                    <span className="budget-signal-detail">{categoriesLabel}</span>
                  </div>

                  <div className="budget-signal-summary">
                    {entry.budget.recurring ? (
                      <span className="budget-recurring-badge">Recurring</span>
                    ) : null}
                    <strong>{statusLabel}</strong>
                  </div>
                </div>

                <div className="budget-signal-body">
                  <span className="budget-signal-detail">{detailLabel}</span>

                  <div className="progress-track budget-signal-track">
                    <span
                      className={entry.tone}
                      style={{ width: `${entry.progress * 100}%` }}
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      ) : null}

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
