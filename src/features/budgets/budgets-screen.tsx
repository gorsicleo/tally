import { useMemo, useState } from 'react'
import { formatCurrency, formatMonthLabel } from '../../domain/formatters'
import {
  getBudgetAllocationSummary,
  getBudgetSignals,
  getMonthKey,
  shiftMonthKey,
} from '../../domain/selectors'
import { useFinance } from '../../state/use-finance'
import { BudgetEditorSheet } from './budget-editor-sheet'
import { getVisibleManagedCategories } from '../../domain/categories'

function formatAvailableToBudgetLabel(
  availableToBudget: number,
  currency: string,
): string {
  if (availableToBudget < 0) {
    return `${formatCurrency(Math.abs(availableToBudget), currency)} over-allocated`
  }

  return `${formatCurrency(Math.max(availableToBudget, 0), currency)} left`
}

export function BudgetsScreen() {
  const { state, upsertBudget, removeBudget } = useFinance()
  const currentMonthKey = useMemo(() => getMonthKey(), [])
  const [monthKey, setMonthKey] = useState(currentMonthKey)
  const monthLabel = useMemo(() => formatMonthLabel(monthKey), [monthKey])
  const currency = state.settings.currency
  const [editingBudgetId, setEditingBudgetId] = useState<string | 'create' | null>(null)
  const allocationSummary = useMemo(
    () => getBudgetAllocationSummary(state, monthKey),
    [monthKey, state],
  )
  const budgetSignals = useMemo(
    () => getBudgetSignals(state, monthKey),
    [monthKey, state],
  )
  const managedExpenseCategories = useMemo(
    () =>
      getVisibleManagedCategories(state.categories).filter(
        (category) => category.kind !== 'income',
      ),
    [state.categories],
  )
  const selectedSignal = budgetSignals.find(
    (entry) => entry.budget.id === editingBudgetId,
  ) ?? null
  const selectedBudget = selectedSignal?.budget ?? null
  const availabilityLabel = formatAvailableToBudgetLabel(
    allocationSummary.availableToBudgetForPeriod,
    currency,
  )
  const allocationHelperText = !allocationSummary.hasIncomeRecorded
    ? `No income recorded ${monthKey === currentMonthKey ? 'this month' : `for ${monthLabel}`}.`
    : !allocationSummary.hasAllocatedBudgets
      ? 'Start assigning budget limits to your categories.'
      : null
  const availabilityTone = allocationSummary.availableToBudgetForPeriod < 0
    ? 'danger'
    : allocationSummary.availableToBudgetForPeriod === 0
      ? 'neutral'
      : 'safe'

  return (
    <div className="screen-stack budgets-screen">
      <section className={`panel budget-allocation-card ${availabilityTone}`.trim()}>
        <div className="budget-allocation-header">
          <div>
            <p className="eyebrow">Available to budget</p>
            <p className="budget-allocation-period">{monthLabel}</p>
          </div>

          <div className="budget-period-switch" role="group" aria-label="Budget period">
            <button
              type="button"
              className="ghost-button compact"
              aria-label="Previous month"
              onClick={() => {
                setMonthKey((current) => shiftMonthKey(current, -1))
                setEditingBudgetId(null)
              }}
            >
              {'<'}
            </button>

            <button
              type="button"
              className="ghost-button compact"
              aria-label="Next month"
              onClick={() => {
                setMonthKey((current) => shiftMonthKey(current, 1))
                setEditingBudgetId(null)
              }}
            >
              {'>'}
            </button>
          </div>
        </div>

        <h2 className={`budget-allocation-value ${availabilityTone}`.trim()}>
          {availabilityLabel}
        </h2>

        <p className="budget-allocation-meta">
          Income {formatCurrency(allocationSummary.totalIncomeForPeriod, currency)}
          {' • '}
          Allocated {formatCurrency(allocationSummary.totalAllocatedBudgetLimitsForPeriod, currency)}
        </p>

        {allocationHelperText ? (
          <p className="budget-allocation-help">{allocationHelperText}</p>
        ) : null}
      </section>

      {managedExpenseCategories.length === 0 ? (
        <p className="empty-state">Create an expense category first to set a budget.</p>
      ) : (
        <section className="panel budget-signal-list" aria-label="Budget status list">
          <div className="section-heading-row budget-list-header">
            <div>
              <p className="eyebrow">Budget limits</p>
              <p>{monthLabel}</p>
            </div>
            <button
              type="button"
              className="ghost-button compact"
              onClick={() => setEditingBudgetId('create')}
            >
              + Add budget
            </button>
          </div>

          {budgetSignals.length === 0 ? (
            <p className="empty-state">No budgets yet. Add your first budget for {monthLabel}.</p>
          ) : null}

          {budgetSignals.map((entry) => {
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
                onClick={() => setEditingBudgetId(entry.budget.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setEditingBudgetId(entry.budget.id)
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
      )}

      {editingBudgetId === 'create' || selectedBudget ? (
        <BudgetEditorSheet
          key={editingBudgetId}
          mode={editingBudgetId === 'create' ? 'create' : 'edit'}
          budget={selectedBudget}
          categories={managedExpenseCategories}
          spent={selectedSignal?.spent ?? 0}
          allocationSummary={allocationSummary}
          currency={currency}
          monthLabel={monthLabel}
          onClose={() => setEditingBudgetId(null)}
          onSave={(input) =>
            upsertBudget({
              id: input.id,
              name: input.name,
              categoryIds: input.categoryIds,
              monthKey: input.id && selectedBudget?.id === input.id
                ? selectedBudget.monthKey
                : monthKey,
              limit: input.limit,
              recurring: input.recurring,
            })
          }
          onRemove={(budgetId) => {
            removeBudget(budgetId)
          }}
        />
      ) : null}
    </div>
  )
}
