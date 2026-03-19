import { useMemo, useState } from 'react'
import { formatCurrency, formatMonthLabel } from '../../domain/formatters'
import { getBudgetSignals, getMonthKey } from '../../domain/selectors'
import { useFinance } from '../../state/use-finance'
import { BudgetEditorSheet } from './budget-editor-sheet'

export function BudgetsScreen() {
  const { state, setBudget } = useFinance()
  const monthKey = useMemo(() => getMonthKey(), [])
  const monthLabel = useMemo(() => formatMonthLabel(monthKey), [monthKey])
  const currency = state.settings.currency
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const budgetSignals = useMemo(
    () => getBudgetSignals(state, monthKey),
    [monthKey, state],
  )
  const selectedSignal = budgetSignals.find(
    (entry) => entry.category.id === selectedCategoryId,
  ) ?? null
  const overspentTotal = budgetSignals.reduce(
    (sum, entry) => sum + (entry.remaining < 0 ? Math.abs(entry.remaining) : 0),
    0,
  )
  const atRiskCount = budgetSignals.filter((entry) => entry.tone === 'danger' || entry.tone === 'warning').length
  const withoutBudgetCount = budgetSignals.filter((entry) => entry.tone === 'missing').length
  const activeBudgetCount = budgetSignals.filter((entry) => entry.tone !== 'missing').length
  const summaryHeadline =
    overspentTotal > 0
      ? `${formatCurrency(overspentTotal, currency)} overspent`
      : atRiskCount > 0
        ? `${atRiskCount} categor${atRiskCount === 1 ? 'y is' : 'ies are'} near limit`
        : activeBudgetCount > 0
          ? 'All budgets on track'
          : 'No budgets set yet'
  const summaryCopy =
    overspentTotal > 0
      ? 'The first rows need attention right now.'
      : withoutBudgetCount > 0
        ? `${withoutBudgetCount} categor${withoutBudgetCount === 1 ? 'y has' : 'ies have'} no monthly limit yet.`
        : 'Every active budget is currently within its monthly limit.'

  return (
    <div className="screen-stack budgets-screen">
      <section className="panel budget-overview-card">
        <div className="budget-overview-copy">
          <p className="eyebrow">{monthLabel}</p>
          <h2>{summaryHeadline}</h2>
          <p>{summaryCopy}</p>
        </div>

        <div className="budget-overview-stats">
          <div className="budget-overview-stat">
            <span>Overspent</span>
            <strong>{formatCurrency(overspentTotal, currency)}</strong>
          </div>
          <div className="budget-overview-stat">
            <span>At risk</span>
            <strong>{atRiskCount}</strong>
          </div>
          <div className="budget-overview-stat">
            <span>Without budgets</span>
            <strong>{withoutBudgetCount}</strong>
          </div>
        </div>
      </section>

      {budgetSignals.length === 0 ? (
        <p className="empty-state">Create an expense category first to set a budget.</p>
      ) : (
        <section className="panel budget-signal-list" aria-label="Budget status list">
          {budgetSignals.map((entry) => {
            const statusLabel =
              entry.tone === 'missing'
                ? 'No budget'
                : entry.remaining >= 0
                  ? `${formatCurrency(entry.remaining, currency)} left`
                  : `${formatCurrency(Math.abs(entry.remaining), currency)} over`
            const detailLabel =
              entry.tone === 'missing'
                ? entry.spent > 0
                  ? `Spent ${formatCurrency(entry.spent, currency)} this month`
                  : 'Tap to set a limit'
                : `${formatCurrency(entry.spent, currency)} / ${formatCurrency(entry.limit, currency)}`

            return (
              <article
                key={entry.category.id}
                className={`budget-signal-row ${entry.tone}`.trim()}
                onClick={() => setSelectedCategoryId(entry.category.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedCategoryId(entry.category.id)
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="budget-signal-head">
                  <div className="budget-signal-name">
                    <span
                      className="chip-dot"
                      style={{ backgroundColor: entry.category.color }}
                      aria-hidden="true"
                    />
                    <strong>{entry.category.name}</strong>
                  </div>

                  <div className="budget-signal-summary">
                    <strong>{statusLabel}</strong>
                    {entry.tone === 'missing' ? (
                      <span className="budget-signal-action">+ Set</span>
                    ) : null}
                  </div>
                </div>

                <div className="budget-signal-body">
                  <span className="budget-signal-detail">{detailLabel}</span>

                  {entry.tone !== 'missing' ? (
                    <div className="progress-track budget-signal-track">
                      <span
                        className={entry.tone}
                        style={{ width: `${entry.progress * 100}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}
        </section>
      )}

      {selectedSignal ? (
        <BudgetEditorSheet
          key={selectedSignal.category.id}
          category={selectedSignal.category}
          budget={selectedSignal.budget}
          spent={selectedSignal.spent}
          currency={currency}
          monthLabel={monthLabel}
          onClose={() => setSelectedCategoryId(null)}
          onSave={(limit: number) =>
            setBudget({ categoryId: selectedSignal.category.id, monthKey, limit })
          }
          onRemove={() =>
            setBudget({ categoryId: selectedSignal.category.id, monthKey, limit: 0 })
          }
        />
      ) : null}
    </div>
  )
}
