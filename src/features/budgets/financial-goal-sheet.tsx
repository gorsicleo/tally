import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { formatDateTimeLabel } from '../../domain/formatters'
import {
  financialGoalPriorityLabels,
  financialGoalTypeLabels,
  getFinancialGoalProgressRatio,
  getFinancialGoalRemainingAmount,
} from '../../domain/financial-goals'
import type {
  FinancialGoal,
  FinancialGoalPriority,
  FinancialGoalType,
} from '../../domain/models'
import { formatSensitiveCurrency } from '../privacy/sensitive-data'

interface FinancialGoalSheetProps {
  mode: 'create' | 'edit' | 'details'
  goal: FinancialGoal | null
  currency: string
  hideSensitiveValues: boolean
  onClose: () => void
  onSave: (input: {
    id?: string
    name: string
    description: string
    type: FinancialGoalType
    targetAmount: number
    currentAmount: number
    targetDate: string | null
    priority: FinancialGoalPriority
  }) => string | null
  onArchive: (goalId: string) => void
  onRequestEdit: () => void
}

const SHEET_CLOSE_MS = 280

const goalTypeOptions: FinancialGoalType[] = [
  'house',
  'car',
  'emergencyFund',
  'vacation',
  'education',
  'custom',
]
const goalPriorityOptions: FinancialGoalPriority[] = ['high', 'medium', 'low']

export function FinancialGoalSheet({
  mode,
  goal,
  currency,
  hideSensitiveValues,
  onClose,
  onSave,
  onArchive,
  onRequestEdit,
}: FinancialGoalSheetProps) {
  const [name, setName] = useState(goal?.name ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [type, setType] = useState<FinancialGoalType>(goal?.type ?? 'custom')
  const [targetAmount, setTargetAmount] = useState(
    goal ? String(goal.targetAmount) : '',
  )
  const [currentAmount, setCurrentAmount] = useState(
    goal ? String(goal.currentAmount) : '0',
  )
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '')
  const [priority, setPriority] = useState<FinancialGoalPriority>(
    goal?.priority ?? 'medium',
  )
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<'opening' | 'open' | 'closing'>('opening')
  const closingRef = useRef(false)
  const closeTimeoutRef = useRef<number | null>(null)

  const numericTargetAmount = Number(targetAmount)
  const numericCurrentAmount = Number(currentAmount)
  const progressRatio = useMemo(
    () => getFinancialGoalProgressRatio(numericCurrentAmount, numericTargetAmount),
    [numericCurrentAmount, numericTargetAmount],
  )
  const remainingAmount = useMemo(
    () => getFinancialGoalRemainingAmount(numericCurrentAmount, numericTargetAmount),
    [numericCurrentAmount, numericTargetAmount],
  )

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

  const requestClose = () => {
    if (closingRef.current) {
      return
    }

    closingRef.current = true
    setState('closing')
    closeTimeoutRef.current = window.setTimeout(() => {
      onClose()
    }, SHEET_CLOSE_MS)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const saveError = onSave({
      id: goal?.id,
      name,
      description,
      type,
      targetAmount: numericTargetAmount,
      currentAmount: numericCurrentAmount,
      targetDate: targetDate || null,
      priority,
    })

    if (saveError) {
      setError(saveError)
      return
    }

    requestClose()
  }

  if (mode === 'details' && goal) {
    const detailsProgressRatio = getFinancialGoalProgressRatio(
      goal.currentAmount,
      goal.targetAmount,
    )
    const detailsRemainingAmount = getFinancialGoalRemainingAmount(
      goal.currentAmount,
      goal.targetAmount,
    )

    return (
      <div
        className="sheet-backdrop"
        data-state={state}
        role="presentation"
        onClick={requestClose}
      >
        <section
          className="panel sheet-panel budget-sheet-panel"
          data-state={state}
          role="dialog"
          aria-modal="true"
          aria-labelledby="goal-sheet-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sheet-grabber" aria-hidden="true" />

          <div className="sheet-header">
            <div>
              <p className="eyebrow">Financial goal</p>
              <h3 id="goal-sheet-title">{goal.name}</h3>
            </div>
            <button type="button" className="icon-button" onClick={requestClose}>
              Close
            </button>
          </div>

          <div className="mini-status-grid budget-sheet-stats">
            <div>
              <span>Current</span>
              <strong>
                {formatSensitiveCurrency(
                  goal.currentAmount,
                  currency,
                  hideSensitiveValues,
                )}
              </strong>
            </div>
            <div>
              <span>Target</span>
              <strong>
                {formatSensitiveCurrency(
                  goal.targetAmount,
                  currency,
                  hideSensitiveValues,
                )}
              </strong>
            </div>
          </div>

          <div className="field-grid">
            {goal.description ? <p>{goal.description}</p> : null}
            <p className="support-copy">
              Type {financialGoalTypeLabels[goal.type]}
              {' • '}
              Priority {financialGoalPriorityLabels[goal.priority]}
            </p>
            {goal.targetDate ? (
              <p className="support-copy">Target date {goal.targetDate}</p>
            ) : null}
            <p className="support-copy">
              Created {formatDateTimeLabel(goal.createdAt)}
            </p>
            <p className="support-copy">
              Remaining{' '}
              {formatSensitiveCurrency(
                detailsRemainingAmount,
                currency,
                hideSensitiveValues,
              )}
            </p>

            <div className="progress-track budget-signal-track">
              <span
                className="safe"
                style={{ width: `${detailsProgressRatio * 100}%` }}
              />
            </div>
            <p className="support-copy">Progress {Math.round(detailsProgressRatio * 100)}%</p>

            <div className="sheet-footer-actions with-delete">
              <button
                type="button"
                className="submit-button"
                onClick={onRequestEdit}
              >
                Edit goal
              </button>
              <button
                type="button"
                className="ghost-button danger-button"
                onClick={() => {
                  const confirmed = window.confirm(`Archive goal ${goal.name}?`)

                  if (!confirmed) {
                    return
                  }

                  onArchive(goal.id)
                  requestClose()
                }}
              >
                Archive goal
              </button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div
      className="sheet-backdrop"
      data-state={state}
      role="presentation"
      onClick={requestClose}
    >
      <section
        className="panel sheet-panel budget-sheet-panel"
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grabber" aria-hidden="true" />

        <div className="sheet-header">
          <div>
            <p className="eyebrow">Financial goal</p>
            <h3 id="goal-sheet-title">
              {mode === 'edit' ? 'Update goal' : 'Create goal'}
            </h3>
          </div>
          <button type="button" className="icon-button" onClick={requestClose}>
            {mode === 'edit' ? 'Close' : 'Discard'}
          </button>
        </div>

        <div className="mini-status-grid budget-sheet-stats">
          <div>
            <span>Progress</span>
            <strong>{Math.round(progressRatio * 100)}%</strong>
          </div>
          <div>
            <span>Remaining</span>
            <strong>
              {formatSensitiveCurrency(
                remainingAmount,
                currency,
                hideSensitiveValues,
              )}
            </strong>
          </div>
        </div>

        <form className="field-grid" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              type="text"
              maxLength={64}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError(null)
              }}
              placeholder="House"
              required
            />
          </label>

          <label>
            Description
            <textarea
              value={description}
              maxLength={280}
              onChange={(event) => {
                setDescription(event.target.value)
                setError(null)
              }}
              placeholder="Optional"
            />
          </label>

          <label>
            Goal type
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value as FinancialGoalType)
                setError(null)
              }}
            >
              {goalTypeOptions.map((goalType) => (
                <option key={goalType} value={goalType}>
                  {financialGoalTypeLabels[goalType]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Target amount
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={targetAmount}
              onChange={(event) => {
                setTargetAmount(event.target.value)
                setError(null)
              }}
              placeholder="0.00"
            />
          </label>

          <label>
            Current amount
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={currentAmount}
              onChange={(event) => {
                setCurrentAmount(event.target.value)
                setError(null)
              }}
              placeholder="0.00"
            />
          </label>

          <label>
            Target date
            <input
              type="date"
              value={targetDate}
              onChange={(event) => {
                setTargetDate(event.target.value)
                setError(null)
              }}
            />
          </label>

          <label>
            Priority
            <select
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value as FinancialGoalPriority)
                setError(null)
              }}
            >
              {goalPriorityOptions.map((goalPriority) => (
                <option key={goalPriority} value={goalPriority}>
                  {financialGoalPriorityLabels[goalPriority]}
                </option>
              ))}
            </select>
          </label>

          <div className="progress-track budget-signal-track">
            <span className="safe" style={{ width: `${progressRatio * 100}%` }} />
          </div>

          {error ? <p className="inline-error">{error}</p> : null}

          <div className="sheet-footer-actions">
            <button type="submit" className="submit-button">
              Save goal
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
