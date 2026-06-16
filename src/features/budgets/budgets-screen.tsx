import { useEffect, useMemo, useState } from 'react'
import { formatMonthLabel } from '../../domain/formatters'
import {
  getActiveFinancialGoals,
  getBudgetAllocationSummary,
  getBudgetSignals,
  getFinancialGoalSummaries,
  getMonthKey,
  shiftMonthKey,
} from '../../domain/selectors'
import { useFinance } from '../../state/use-finance'
import { BudgetEditorSheet } from './budget-editor-sheet'
import { getVisibleManagedCategories } from '../../domain/categories'
import { formatSensitiveCurrency } from '../privacy/sensitive-data'
import {
  financialGoalPriorityLabels,
  financialGoalTypeLabels,
} from '../../domain/financial-goals'
import { FinancialGoalSheet } from './financial-goal-sheet'

function formatAvailableToBudgetLabel(
  availableToBudget: number,
  currency: string,
  hideSensitiveValues: boolean,
): string {
  if (availableToBudget < 0) {
    return `${formatSensitiveCurrency(Math.abs(availableToBudget), currency, hideSensitiveValues)} over-allocated`
  }

  return `${formatSensitiveCurrency(Math.max(availableToBudget, 0), currency, hideSensitiveValues)} left`
}

interface BudgetsScreenProps {
  initialView?: 'budgets' | 'goals'
  openCreateGoalRequest?: boolean
  onOpenCreateGoalHandled?: () => void
}

export function BudgetsScreen({
  initialView = 'budgets',
  openCreateGoalRequest = false,
  onOpenCreateGoalHandled,
}: BudgetsScreenProps) {
  const {
    state,
    upsertBudget,
    removeBudget,
    upsertFinancialGoal,
    archiveFinancialGoal,
    shouldHideSensitiveValues,
  } = useFinance()
  const currentMonthKey = useMemo(() => getMonthKey(), [])
  const [monthKey, setMonthKey] = useState(currentMonthKey)
  const [view, setView] = useState<'budgets' | 'goals'>(initialView)
  const monthLabel = useMemo(() => formatMonthLabel(monthKey), [monthKey])
  const currency = state.settings.currency
  const [editingBudgetId, setEditingBudgetId] = useState<string | 'create' | null>(null)
  const [goalSheet, setGoalSheet] = useState<
    | { mode: 'create' }
    | { mode: 'details' | 'edit'; goalId: string }
    | null
  >(null)
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
  const activeGoals = useMemo(() => getActiveFinancialGoals(state), [state])
  const goalSummaries = useMemo(() => getFinancialGoalSummaries(activeGoals), [activeGoals])
  const selectedGoal =
    goalSheet && goalSheet.mode !== 'create'
      ? activeGoals.find((goal) => goal.id === goalSheet.goalId) ?? null
      : null
  const availabilityLabel = formatAvailableToBudgetLabel(
    allocationSummary.availableToBudgetForPeriod,
    currency,
    shouldHideSensitiveValues,
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

  useEffect(() => {
    setView(initialView)
  }, [initialView])

  useEffect(() => {
    if (!openCreateGoalRequest || view !== 'goals') {
      return
    }

    setGoalSheet({ mode: 'create' })
    onOpenCreateGoalHandled?.()
  }, [onOpenCreateGoalHandled, openCreateGoalRequest, view])

  return (
    <div className="screen-stack budgets-screen">
      <section className="panel budget-view-switch-panel">
        <div className="settings-inline-switch" role="tablist" aria-label="Budgets and goals">
          <button
            type="button"
            role="tab"
            className={view === 'budgets' ? 'active' : ''}
            aria-selected={view === 'budgets'}
            onClick={() => {
              setView('budgets')
              setGoalSheet(null)
            }}
          >
            Budgets
          </button>
          <button
            type="button"
            role="tab"
            className={view === 'goals' ? 'active' : ''}
            aria-selected={view === 'goals'}
            onClick={() => {
              setView('goals')
              setEditingBudgetId(null)
            }}
          >
            Goals
          </button>
        </div>
      </section>

      {view === 'budgets' ? (
        <>
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
          Income {formatSensitiveCurrency(allocationSummary.totalIncomeForPeriod, currency, shouldHideSensitiveValues)}
          {' • '}
          Allocated {formatSensitiveCurrency(allocationSummary.totalAllocatedBudgetLimitsForPeriod, currency, shouldHideSensitiveValues)}
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
                ? `${formatSensitiveCurrency(entry.remaining, currency, shouldHideSensitiveValues)} left`
                : `${formatSensitiveCurrency(Math.abs(entry.remaining), currency, shouldHideSensitiveValues)} over`
            const detailLabel = `${formatSensitiveCurrency(entry.spent, currency, shouldHideSensitiveValues)} / ${formatSensitiveCurrency(entry.limit, currency, shouldHideSensitiveValues)}`
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
          hideSensitiveValues={shouldHideSensitiveValues}
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

        </>
      ) : (
        <section className="panel budget-signal-list" aria-label="Financial goals">
          <div className="section-heading-row budget-list-header">
            <div>
              <p className="eyebrow">Financial goals</p>
              <p>Track progress for your long-term savings plans.</p>
            </div>
            <button
              type="button"
              className="ghost-button compact"
              onClick={() => setGoalSheet({ mode: 'create' })}
            >
              + Create goal
            </button>
          </div>

          {goalSummaries.length === 0 ? (
            <p className="empty-state">No active goals yet. Create your first goal.</p>
          ) : null}

          {goalSummaries.map((entry) => (
            <article
              key={entry.goal.id}
              className="budget-signal-row safe"
              onClick={() => {
                setGoalSheet({ mode: 'details', goalId: entry.goal.id })
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setGoalSheet({ mode: 'details', goalId: entry.goal.id })
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="budget-signal-head">
                <div className="budget-signal-name">
                  <strong>{entry.goal.name}</strong>
                  <span className="budget-signal-detail">
                    {financialGoalTypeLabels[entry.goal.type]}
                    {' • '}
                    {financialGoalPriorityLabels[entry.goal.priority]}
                  </span>
                </div>

                <div className="budget-signal-summary">
                  <strong>{Math.round(entry.progressRatio * 100)}%</strong>
                </div>
              </div>

              <div className="budget-signal-body">
                <span className="budget-signal-detail">
                  {formatSensitiveCurrency(
                    entry.goal.currentAmount,
                    currency,
                    shouldHideSensitiveValues,
                  )}
                  {' / '}
                  {formatSensitiveCurrency(
                    entry.goal.targetAmount,
                    currency,
                    shouldHideSensitiveValues,
                  )}
                  {' • Remaining '}
                  {formatSensitiveCurrency(
                    entry.remainingAmount,
                    currency,
                    shouldHideSensitiveValues,
                  )}
                  {entry.goal.targetDate ? ` • Target ${entry.goal.targetDate}` : ''}
                </span>

                <div className="progress-track budget-signal-track">
                  <span
                    className="safe"
                    style={{ width: `${entry.progressRatio * 100}%` }}
                  />
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {goalSheet && (goalSheet.mode === 'create' || selectedGoal) ? (
        <FinancialGoalSheet
          mode={goalSheet.mode}
          goal={selectedGoal}
          currency={currency}
          hideSensitiveValues={shouldHideSensitiveValues}
          onClose={() => {
            setGoalSheet(null)
          }}
          onSave={(input) =>
            upsertFinancialGoal({
              id: input.id,
              name: input.name,
              description: input.description,
              type: input.type,
              targetAmount: input.targetAmount,
              currentAmount: input.currentAmount,
              targetDate: input.targetDate,
              priority: input.priority,
            })
          }
          onArchive={(goalId) => {
            archiveFinancialGoal(goalId)
          }}
          onRequestEdit={() => {
            if (selectedGoal) {
              setGoalSheet({ mode: 'edit', goalId: selectedGoal.id })
            }
          }}
        />
      ) : null}
    </div>
  )
}
