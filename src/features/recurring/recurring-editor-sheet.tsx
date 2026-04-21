import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { getRecurringFrequencyLabel } from '../../domain/recurring'
import type { Category, RecurringFrequency } from '../../domain/models'
import { useFinance } from '../../state/use-finance'

interface RecurringEditorSheetProps {
  templateId: string
  onClose: () => void
  onShowToast: (message: string) => void
}

const RECURRING_EDITOR_CLOSE_MS = 280

function getCompatibleCategories(
  categories: Category[],
  type: 'income' | 'expense',
): Category[] {
  return categories.filter(
    (category) => category.kind === 'both' || category.kind === type,
  )
}

export function RecurringEditorSheet({
  templateId,
  onClose,
  onShowToast,
}: RecurringEditorSheetProps) {
  const {
    state,
    updateRecurringTemplate,
    stopRecurringTemplate,
  } = useFinance()
  const template = state.recurringTemplates.find((entry) => entry.id === templateId) ?? null
  const [sheetState, setSheetState] = useState<'opening' | 'open' | 'closing'>('opening')
  const [type, setType] = useState(template?.type ?? 'expense')
  const [amount, setAmount] = useState(template ? String(template.amount) : '')
  const [categoryId, setCategoryId] = useState(template?.categoryId ?? '')
  const [note, setNote] = useState(template?.note ?? '')
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    template?.frequency ?? 'monthly',
  )
  const [intervalDays, setIntervalDays] = useState(
    template?.intervalDays ? String(template.intervalDays) : '7',
  )
  const [nextDueDate, setNextDueDate] = useState(template?.nextDueDate ?? '')
  const [error, setError] = useState<string | null>(null)
  const closingRef = useRef(false)
  const closeTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSheetState('open')
    })

    return () => {
      window.cancelAnimationFrame(frame)

      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [templateId])

  useEffect(() => {
    if (!template) {
      onClose()
    }
  }, [onClose, template])

  const compatibleCategories = useMemo(
    () => getCompatibleCategories(state.categories, type),
    [state.categories, type],
  )
  const selectedCategoryId =
    compatibleCategories.find((category) => category.id === categoryId)?.id ??
    compatibleCategories[0]?.id ??
    ''

  if (!template) {
    return null
  }

  const requestClose = (afterClose?: () => void) => {
    if (closingRef.current) {
      return
    }

    closingRef.current = true
    setSheetState('closing')
    closeTimeoutRef.current = window.setTimeout(() => {
      afterClose?.()
      onClose()
    }, RECURRING_EDITOR_CLOSE_MS)
  }

  const handleTypeChange = (nextType: 'income' | 'expense') => {
    setType(nextType)
    setError(null)

    const nextCompatibleCategories = getCompatibleCategories(
      state.categories,
      nextType,
    )

    if (nextCompatibleCategories.some((category) => category.id === categoryId)) {
      return
    }

    setCategoryId(nextCompatibleCategories[0]?.id ?? '')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const numericAmount = Number(amount)
    const numericIntervalDays = Number(intervalDays)

    if (!selectedCategoryId) {
      setError('Create a matching category first.')
      return
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Amount must be greater than zero.')
      return
    }

    if (frequency === 'custom' && (!Number.isFinite(numericIntervalDays) || numericIntervalDays < 1)) {
      setError('Custom repeat must be at least 1 day.')
      return
    }

    updateRecurringTemplate({
      id: template.id,
      type,
      amount: numericAmount,
      categoryId: selectedCategoryId,
      note,
      frequency,
      intervalDays: frequency === 'custom' ? Math.floor(numericIntervalDays) : null,
      startDate: nextDueDate,
      nextDueDate,
    })

    requestClose(() => {
      onShowToast('Recurring updated.')
    })
  }

  const handleStopRecurring = () => {
    const confirmed = window.confirm('Stop recurring for future occurrences?')

    if (!confirmed) {
      return
    }

    stopRecurringTemplate(template.id)

    requestClose(() => {
      onShowToast('Recurring stopped.')
    })
  }

  return (
    <div
      className="sheet-backdrop"
      data-state={sheetState}
      role="presentation"
      onClick={() => requestClose()}
    >
      <section
        className="panel sheet-panel recurring-sheet-panel"
        data-state={sheetState}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurring-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grabber" aria-hidden="true" />

        <div className="sheet-header compact-sheet-header">
          <div>
            <p className="eyebrow">Recurring</p>
            <h3 id="recurring-sheet-title">Edit future recurring transactions</h3>
          </div>

          <button
            type="button"
            className="icon-button sheet-close-button"
            aria-label="Close recurring editor"
            title="Close"
            onClick={() => requestClose()}
          >
            <span aria-hidden="true">&#215;</span>
          </button>
        </div>

        <form className="field-grid transaction-sheet-form" onSubmit={handleSubmit}>
          <div className="type-toggle" role="group" aria-label="Recurring type">
            <button
              type="button"
              className={type === 'expense' ? 'active' : ''}
              onClick={() => handleTypeChange('expense')}
            >
              Expense
            </button>
            <button
              type="button"
              className={type === 'income' ? 'active' : ''}
              onClick={() => handleTypeChange('income')}
            >
              Income
            </button>
          </div>

          <div className="sheet-amount-field">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value)
                setError(null)
              }}
              placeholder="0.00"
              aria-label="Recurring amount"
              className="sheet-amount-input"
              required
            />
          </div>

          <label className="sheet-select-label">
            Category
            <select
              value={selectedCategoryId}
              onChange={(event) => {
                setCategoryId(event.target.value)
                setError(null)
              }}
              required
            >
              {compatibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="sheet-note-label">
            Note (optional)
            <textarea
              value={note}
              onChange={(event) => {
                setNote(event.target.value)
                setError(null)
              }}
              placeholder="Add note"
              className="quick-note-input"
            />
          </label>

          <div className="sheet-recurring-fields">
            <div className="sheet-inline-row">
              <span className="sheet-inline-label">Repeat</span>
              <span className="sheet-recurring-summary subtle-text">
                {getRecurringFrequencyLabel({ frequency, intervalDays: frequency === 'custom' ? Number(intervalDays) : null })}
              </span>
            </div>

            <div className="pill-switch" role="group" aria-label="Recurring frequency">
              <button
                type="button"
                className={frequency === 'monthly' ? 'active' : ''}
                onClick={() => {
                  setFrequency('monthly')
                  setError(null)
                }}
              >
                Monthly
              </button>
              <button
                type="button"
                className={frequency === 'custom' ? 'active' : ''}
                onClick={() => {
                  setFrequency('custom')
                  setError(null)
                }}
              >
                Custom
              </button>
            </div>

            {frequency === 'custom' ? (
              <label className="sheet-select-label">
                Repeat every how many days?
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={intervalDays}
                  onChange={(event) => {
                    setIntervalDays(event.target.value)
                    setError(null)
                  }}
                  required
                />
              </label>
            ) : null}

            <label className="sheet-select-label">
              Next due date
              <input
                type="date"
                value={nextDueDate}
                onChange={(event) => {
                  setNextDueDate(event.target.value)
                  setError(null)
                }}
                required
              />
            </label>
          </div>

          {error ? <p className="inline-error">{error}</p> : null}

          <div className="sheet-footer-actions with-delete">
            <button type="submit" className="submit-button">
              Save recurring
            </button>

            <button
              type="button"
              className="ghost-button danger-button"
              onClick={handleStopRecurring}
            >
              Stop recurring
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}