import { useEffect, useRef, useState, type FormEvent } from 'react'
import { formatCurrency } from '../../domain/formatters'
import type { Budget, Category } from '../../domain/models'

interface BudgetEditorSheetProps {
  category: Category
  budget: Budget | null
  spent: number
  currency: string
  monthLabel: string
  onClose: () => void
  onSave: (limit: number) => void
  onRemove: () => void
}

const SHEET_CLOSE_MS = 280
const quickBudgetValues = [100, 200, 500]

export function BudgetEditorSheet({
  category,
  budget,
  spent,
  currency,
  monthLabel,
  onClose,
  onSave,
  onRemove,
}: BudgetEditorSheetProps) {
  const [limit, setLimit] = useState(budget ? String(budget.limit) : '')
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<'opening' | 'open' | 'closing'>('opening')
  const closingRef = useRef(false)
  const closeTimeoutRef = useRef<number | null>(null)

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

    const numericLimit = Number(limit)

    if (!Number.isFinite(numericLimit) || numericLimit <= 0) {
      setError('Limit must be greater than zero.')
      return
    }

    onSave(numericLimit)
    requestClose()
  }

  const handleRemove = () => {
    if (!budget) {
      return
    }

    requestClose(() => {
      onRemove()
    })
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
            <h3 id="budget-sheet-title">{category.name}</h3>
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