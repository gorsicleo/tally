import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { formatCurrency } from '../../domain/formatters'
import {
  previewAvailableToBudgetAfterBudgetChange,
  type BudgetAllocationSummary,
} from '../../domain/selectors'
import type { Budget, Category } from '../../domain/models'

interface BudgetEditorSheetProps {
  mode: 'create' | 'edit'
  budget: Budget | null
  categories: Category[]
  spent: number
  allocationSummary: BudgetAllocationSummary
  currency: string
  monthLabel: string
  onClose: () => void
  onSave: (input: {
    id?: string
    name: string
    categoryIds: string[]
    limit: number
  }) => string | null
  onRemove: (budgetId: string) => void
}

const SHEET_CLOSE_MS = 280
const quickBudgetValues = [100, 200, 500]

export function BudgetEditorSheet({
  mode,
  budget,
  categories,
  spent,
  allocationSummary,
  currency,
  monthLabel,
  onClose,
  onSave,
  onRemove,
}: BudgetEditorSheetProps) {
  const [name, setName] = useState(budget?.name ?? '')
  const [limit, setLimit] = useState(budget ? String(budget.limit) : '')
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
      ? `After this budget: ${formatCurrency(preview.overAllocatedAmountForPeriod, currency)} over-allocated`
      : `After this budget: ${formatCurrency(Math.max(preview.availableToBudgetForPeriod, 0), currency)} left`
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
            Close
          </button>
        </div>

        <div className="mini-status-grid budget-sheet-stats">
          <div>
            <span>Spent this month</span>
            <strong>{formatCurrency(spent, currency)}</strong>
          </div>
          <div>
            <span>{budget ? 'Current limit' : 'Status'}</span>
            <strong>
              {budget ? formatCurrency(budget.limit, currency) : 'No budget set'}
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

          {previewLabel ? (
            <p className="support-copy budget-allocation-preview">{previewLabel}</p>
          ) : null}

          <fieldset className="budget-category-fieldset">
            <legend>Categories</legend>

            {categories.length === 0 ? (
              <p className="support-copy">No expense categories are available.</p>
            ) : (
              <div className="budget-category-grid" role="group" aria-label="Budget categories">
                {categories.map((category) => {
                  const active = categoryIds.includes(category.id)

                  return (
                    <label
                      key={category.id}
                      className={`budget-category-pill ${active ? 'active' : ''}`.trim()}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleCategory(category.id)}
                      />
                      <span
                        className="chip-dot"
                        aria-hidden="true"
                        style={{ backgroundColor: category.color }}
                      />
                      <span>{category.name}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </fieldset>

          <div className="budget-quick-values" role="group" aria-label="Quick budget values">
            {quickBudgetValues.map((value) => (
              <button
                key={value}
                type="button"
                className="ghost-button compact"
                onClick={() => {
                  setLimit(String(value))
                  setError(null)
                }}
              >
                {formatCurrency(value, currency)}
              </button>
            ))}
          </div>

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