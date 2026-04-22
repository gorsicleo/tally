import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  previewAvailableToBudgetAfterBudgetChange,
  type BudgetAllocationSummary,
} from '../../domain/selectors'
import type { Budget, Category } from '../../domain/models'
import { formatSensitiveCurrency } from '../privacy/sensitive-data'

interface BudgetEditorSheetProps {
  mode: 'create' | 'edit'
  budget: Budget | null
  categories: Category[]
  spent: number
  allocationSummary: BudgetAllocationSummary
  currency: string
  hideSensitiveValues: boolean
  monthLabel: string
  onClose: () => void
  onSave: (input: {
    id?: string
    name: string
    categoryIds: string[]
    limit: number
    recurring: boolean
  }) => string | null
  onRemove: (budgetId: string) => void
}

const SHEET_CLOSE_MS = 280

const BUDGET_CATEGORY_LABEL_MAX = 34

function formatBudgetCategoryLabel(name: string): string {
  if (name.length <= BUDGET_CATEGORY_LABEL_MAX) {
    return name
  }

  const parts = name
    .split('/')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  if (parts.length >= 2) {
    const start = parts[0]
    const end = parts[parts.length - 1]
    const separator = ' / ... / '

    if (start.length + separator.length + end.length <= BUDGET_CATEGORY_LABEL_MAX) {
      return `${start}${separator}${end}`
    }
  }

  const visibleChars = BUDGET_CATEGORY_LABEL_MAX - 1
  const leadingChars = Math.ceil(visibleChars / 2)
  const trailingChars = Math.floor(visibleChars / 2)

  return `${name.slice(0, leadingChars)}…${name.slice(-trailingChars)}`
}

export function BudgetEditorSheet({
  mode,
  budget,
  categories,
  spent,
  allocationSummary,
  currency,
  hideSensitiveValues,
  monthLabel,
  onClose,
  onSave,
  onRemove,
}: BudgetEditorSheetProps) {
  const [name, setName] = useState(budget?.name ?? '')
  const [limit, setLimit] = useState(budget ? String(budget.limit) : '')
  const [recurring, setRecurring] = useState(budget?.recurring ?? true)
  const [categoryIds, setCategoryIds] = useState<string[]>(budget?.categoryIds ?? [])
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<'opening' | 'open' | 'closing'>('opening')
  const closingRef = useRef(false)
  const closeTimeoutRef = useRef<number | null>(null)
  const preview = useMemo(() => {
    const numericLimit = Number(limit)

    return previewAvailableToBudgetAfterBudgetChange({
      totalIncomeForPeriod: allocationSummary.totalIncomeForPeriod,
      totalAllocatedBudgetLimitsForPeriod:
        allocationSummary.totalAllocatedBudgetLimitsForPeriod,
      draftLimit: Number.isFinite(numericLimit) ? numericLimit : null,
      previousBudgetLimit: budget?.limit ?? null,
    })
  }, [allocationSummary, budget?.limit, limit])
  const previewLabel = preview
    ? preview.availableToBudgetForPeriod < 0
      ? `After this budget: ${formatSensitiveCurrency(preview.overAllocatedAmountForPeriod, currency, hideSensitiveValues)} over-allocated`
      : `After this budget: ${formatSensitiveCurrency(Math.max(preview.availableToBudgetForPeriod, 0), currency, hideSensitiveValues)} left`
    : null

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setState('open')
    })

    return () => {
      window.cancelAnimationFrame(frame)

      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  const requestClose = (afterClose?: () => void) => {
    if (closingRef.current) {
      return
    }

    closingRef.current = true
    setState('closing')
    closeTimeoutRef.current = window.setTimeout(() => {
      afterClose?.()
      onClose()
    }, SHEET_CLOSE_MS)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = name.trim()
    const numericLimit = Number(limit)

    if (!trimmedName) {
      setError('Budget name is required.')
      return
    }

    if (!Number.isFinite(numericLimit) || numericLimit <= 0) {
      setError('Limit must be greater than zero.')
      return
    }

    if (categoryIds.length === 0) {
      setError('Select at least one category.')
      return
    }

    const nextError = onSave({
      id: budget?.id,
      name: trimmedName,
      categoryIds,
      limit: numericLimit,
      recurring,
    })

    if (nextError) {
      setError(nextError)
      return
    }

    requestClose()
  }

  const handleRemove = () => {
    if (!budget) {
      return
    }

    const confirmed = window.confirm(`Remove budget ${budget.name}?`)

    if (!confirmed) {
      return
    }

    requestClose(() => {
      onRemove(budget.id)
    })
  }

  const toggleCategory = (categoryId: string) => {
    setCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((entry) => entry !== categoryId)
        : [...current, categoryId],
    )
    setError(null)
  }

  return (
    <div
      className="sheet-backdrop"
      data-state={state}
      role="presentation"
      onClick={() => requestClose()}
    >
      <section
        className="panel sheet-panel budget-sheet-panel"
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grabber" aria-hidden="true" />

        <div className="sheet-header">
          <div>
            <p className="eyebrow">Budget</p>
            <h3 id="budget-sheet-title">
              {mode === 'edit' ? 'Update budget' : 'Create budget'}
            </h3>
            <p>{monthLabel}</p>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={() => requestClose()}
          >
            {mode === 'edit' ? 'Close' : 'Discard'}
          </button>
        </div>

        <div className="mini-status-grid budget-sheet-stats">
          <div>
            <span>Spent this month</span>
            <strong>{formatSensitiveCurrency(spent, currency, hideSensitiveValues)}</strong>
          </div>
          <div>
            <span>{budget ? 'Current limit' : 'Status'}</span>
            <strong>
              {budget ? formatSensitiveCurrency(budget.limit, currency, hideSensitiveValues) : 'No budget set'}
            </strong>
          </div>
        </div>

        <form className="field-grid" onSubmit={handleSubmit}>
          <label>
            Budget name
            <input
              type="text"
              maxLength={48}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError(null)
              }}
              placeholder="Essentials"
              required
            />
          </label>

          <label>
            Monthly limit
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={limit}
              onChange={(event) => {
                setLimit(event.target.value)
                setError(null)
              }}
              placeholder="0.00"
            />
          </label>

          <div className="budget-recurring-control">
            <span className="sheet-inline-label">Cadence</span>
            <div className="budget-recurring-switch" role="group" aria-label="Budget cadence">
              <button
                type="button"
                className={`${recurring ? 'active' : ''}`.trim()}
                aria-pressed={recurring}
                onClick={() => setRecurring(true)}
              >
                Recurring
              </button>
              <button
                type="button"
                className={`${!recurring ? 'active' : ''}`.trim()}
                aria-pressed={!recurring}
                onClick={() => setRecurring(false)}
              >
                This month only
              </button>
            </div>
            <p className="budget-recurring-hint">
              Recurring budgets apply every month.
            </p>
          </div>

          {previewLabel ? (
            <p className="support-copy budget-allocation-preview">{previewLabel}</p>
          ) : null}

          <fieldset className="budget-category-fieldset">
            <legend>Categories</legend>
            <p className="budget-category-hint" id="budget-category-hint">
              Tap to include one or more categories in this budget.
            </p>

            {categories.length === 0 ? (
              <p className="support-copy">No expense categories are available.</p>
            ) : (
              <div
                className="budget-category-grid"
                role="group"
                aria-label="Budget categories"
                aria-describedby="budget-category-hint"
              >
                {categories.map((category) => {
                  const active = categoryIds.includes(category.id)
                  const displayName = formatBudgetCategoryLabel(category.name)

                  return (
                    <button
                      key={category.id}
                      type="button"
                      className={`budget-category-pill ${active ? 'active' : ''}`.trim()}
                      aria-pressed={active}
                      aria-label={category.name}
                      onClick={() => toggleCategory(category.id)}
                    >
                      <span
                        className="chip-dot"
                        aria-hidden="true"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="budget-category-label" title={category.name}>
                        {displayName}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </fieldset>

          {error ? <p className="inline-error">{error}</p> : null}

          <div className={`sheet-footer-actions ${budget ? 'with-delete' : ''}`.trim()}>
            <button type="submit" className="submit-button">
              Save budget
            </button>

            {budget ? (
              <button
                type="button"
                className="ghost-button danger-button"
                onClick={handleRemove}
              >
                Remove budget
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  )
}