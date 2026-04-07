import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { getRecurringFrequencyLabel } from '../../domain/recurring'
import { formatCompactDateLabel } from '../../domain/formatters'
import { UNCATEGORIZED_CATEGORY_ID } from '../../domain/categories'
import type {
  AddTransactionInput,
  TransactionRecurrenceInput,
  UpdateTransactionInput,
} from '../../state/finance-store'
import type {
  Category,
  RecurringFrequency,
  RecurringTemplate,
  Transaction,
  TransactionType,
} from '../../domain/models'
import { getTodayLocalDate } from '../../utils/date'

interface TransactionEditorSheetProps {
  mode: 'create' | 'edit'
  categories: Category[]
  initialTransaction?: Transaction | null
  recurringTemplate?: RecurringTemplate | null
  onClose: () => void
  onCreate: (
    input: AddTransactionInput,
    recurrence: TransactionRecurrenceInput | null,
  ) => void
  onUpdate: (input: UpdateTransactionInput) => void
  onDelete?: (transactionId: string) => void
  onEditFutureRecurring?: (templateId: string) => void
  onStopRecurring?: (templateId: string) => void
}

const SHEET_CLOSE_MS = 280
const SHEET_DEFAULTS_KEY = 'tally.transaction-sheet.defaults.v1'
const MAX_QUICK_CATEGORY_CHIPS = 5
const AMOUNT_AUTOFOCUS_DELAY_MS = 48
const AMOUNT_INPUT_PATTERN = '(?:\\d+(?:[.,]\\d{1,2})?|[.,]\\d{1,2})'
const AMOUNT_INPUT_REGEX = /^(?:\d+(?:[.,]\d{1,2})?|[.,]\d{1,2})$/
const AMOUNT_FORMAT_ERROR = 'Enter a valid amount (for example 12.50 or 12,50).'

interface TransactionSheetDefaults {
  lastType: TransactionType
  lastCategoryByType: Partial<Record<TransactionType, string>>
  quickCategoryByType: Partial<Record<TransactionType, string[]>>
}

const EMPTY_SHEET_DEFAULTS: TransactionSheetDefaults = {
  lastType: 'expense',
  lastCategoryByType: {},
  quickCategoryByType: {},
}

function isTransactionType(value: unknown): value is TransactionType {
  return value === 'income' || value === 'expense'
}

function readTransactionSheetDefaults(): TransactionSheetDefaults {
  if (typeof window === 'undefined') {
    return EMPTY_SHEET_DEFAULTS
  }

  try {
    const raw = window.localStorage.getItem(SHEET_DEFAULTS_KEY)

    if (!raw) {
      return EMPTY_SHEET_DEFAULTS
    }

    const parsed: unknown = JSON.parse(raw)

    if (!parsed || typeof parsed !== 'object') {
      return EMPTY_SHEET_DEFAULTS
    }

    const candidate = parsed as {
      lastType?: unknown
      lastCategoryByType?: unknown
      quickCategoryByType?: unknown
    }
    const normalizedDefaults: TransactionSheetDefaults = {
      lastType: isTransactionType(candidate.lastType)
        ? candidate.lastType
        : 'expense',
      lastCategoryByType: {},
      quickCategoryByType: {},
    }

    if (
      candidate.lastCategoryByType &&
      typeof candidate.lastCategoryByType === 'object'
    ) {
      const categoryByType = candidate.lastCategoryByType as Record<string, unknown>

      if (typeof categoryByType.expense === 'string') {
        normalizedDefaults.lastCategoryByType.expense = categoryByType.expense
      }

      if (typeof categoryByType.income === 'string') {
        normalizedDefaults.lastCategoryByType.income = categoryByType.income
      }
    }

    if (candidate.quickCategoryByType && typeof candidate.quickCategoryByType === 'object') {
      const quickCategoryByType = candidate.quickCategoryByType as Record<string, unknown>

      if (Array.isArray(quickCategoryByType.expense)) {
        normalizedDefaults.quickCategoryByType.expense = quickCategoryByType.expense
          .filter((value): value is string => typeof value === 'string')
          .slice(0, MAX_QUICK_CATEGORY_CHIPS)
      }

      if (Array.isArray(quickCategoryByType.income)) {
        normalizedDefaults.quickCategoryByType.income = quickCategoryByType.income
          .filter((value): value is string => typeof value === 'string')
          .slice(0, MAX_QUICK_CATEGORY_CHIPS)
      }
    }

    return normalizedDefaults
  } catch {
    return EMPTY_SHEET_DEFAULTS
  }
}

function persistTransactionSheetDefaults(
  defaults: TransactionSheetDefaults,
): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(SHEET_DEFAULTS_KEY, JSON.stringify(defaults))
}

function getCompatibleCategories(
  categories: Category[],
  type: TransactionType,
): Category[] {
  return categories.filter(
    (category) => category.kind === 'both' || category.kind === type,
  )
}

function parseAmountInput(value: string): number {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return Number.NaN
  }

  if (!AMOUNT_INPUT_REGEX.test(trimmedValue)) {
    return Number.NaN
  }

  return Number(trimmedValue.replace(',', '.'))
}

function getDefaultQuickCategoryId(categories: Category[]): string {
  return (
    categories.find((category) => category.id === UNCATEGORIZED_CATEGORY_ID)?.id ??
    categories[0]?.id ??
    ''
  )
}

export function TransactionEditorSheet({
  mode,
  categories,
  initialTransaction,
  recurringTemplate,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onEditFutureRecurring,
  onStopRecurring,
}: TransactionEditorSheetProps) {
  const [sheetDefaults, setSheetDefaults] = useState<TransactionSheetDefaults>(
    () => readTransactionSheetDefaults(),
  )
  const amountInputRef = useRef<HTMLInputElement | null>(null)
  const todayDate = useMemo(() => getTodayLocalDate(), [])
  const initialType = initialTransaction?.type ?? sheetDefaults.lastType
  const initialCategory =
    initialTransaction?.categoryId ??
    sheetDefaults.lastCategoryByType[initialType] ??
    ''

  const [type, setType] = useState<TransactionType>(
    initialType,
  )
  const [amount, setAmount] = useState(
    initialTransaction ? String(initialTransaction.amount) : '',
  )
  const dateInputRef = useRef<HTMLInputElement | null>(null)
  const [categoryId, setCategoryId] = useState(initialCategory)
  const [occurredAt, setOccurredAt] = useState(
    initialTransaction?.occurredAt ?? todayDate,
  )
  const [note, setNote] = useState(initialTransaction?.note ?? '')
  const [showNoteInput, setShowNoteInput] = useState(
    Boolean(initialTransaction?.note),
  )
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [showRecurringOptions, setShowRecurringOptions] = useState(false)
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly')
  const [recurringIntervalDays, setRecurringIntervalDays] = useState('7')
  const [recurringStartDate, setRecurringStartDate] = useState(
    initialTransaction?.occurredAt ?? todayDate,
  )
  const [hasEditedRecurringStartDate, setHasEditedRecurringStartDate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<'opening' | 'open' | 'closing'>('opening')
  const closingRef = useRef(false)
  const closeTimeoutRef = useRef<number | null>(null)
  const hasHydratedDefaultsRef = useRef(false)

  const compatibleCategories = getCompatibleCategories(categories, type)
  const selectedCategoryId =
    compatibleCategories.find((category) => category.id === categoryId)?.id ??
    compatibleCategories[0]?.id ??
    ''
  const quickCategoryIds = useMemo(() => {
    const configuredCategoryIds = sheetDefaults.quickCategoryByType[type] ?? []
    const validConfiguredCategoryIds = configuredCategoryIds.filter((configuredId) =>
      compatibleCategories.some((category) => category.id === configuredId),
    )

    if (validConfiguredCategoryIds.length > 0) {
      return Array.from(new Set(validConfiguredCategoryIds)).slice(
        0,
        MAX_QUICK_CATEGORY_CHIPS,
      )
    }

    return compatibleCategories
      .slice(0, MAX_QUICK_CATEGORY_CHIPS)
      .map((category) => category.id)
  }, [compatibleCategories, sheetDefaults.quickCategoryByType, type])
  const quickCategoryOptions = useMemo(() => {
    return quickCategoryIds
      .map((categoryIdFromDefaults) =>
        compatibleCategories.find((category) => category.id === categoryIdFromDefaults),
      )
      .filter((category): category is Category => Boolean(category))
  }, [compatibleCategories, quickCategoryIds])
  const recurringSummary = showRecurringOptions
    ? getRecurringFrequencyLabel({
        frequency: recurringFrequency,
        intervalDays:
          recurringFrequency === 'custom'
            ? Number(recurringIntervalDays)
            : null,
      })
    : 'Off'

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
  }, [mode])

  useEffect(() => {
    if (mode !== 'create' || state !== 'open') {
      return
    }

    const autofocusTimeout = window.setTimeout(() => {
      const amountInput = amountInputRef.current

      if (!amountInput) {
        return
      }

      amountInput.focus({ preventScroll: true })
      amountInput.select()
    }, AMOUNT_AUTOFOCUS_DELAY_MS)

    return () => {
      window.clearTimeout(autofocusTimeout)
    }
  }, [mode, state])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const { body, documentElement } = document
    const previousBodyOverflow = body.style.overflow
    const previousHtmlOverflow = documentElement.style.overflow

    body.style.overflow = 'hidden'
    documentElement.style.overflow = 'hidden'

    return () => {
      body.style.overflow = previousBodyOverflow
      documentElement.style.overflow = previousHtmlOverflow
    }
  }, [])

  useEffect(() => {
    if (!hasHydratedDefaultsRef.current) {
      hasHydratedDefaultsRef.current = true
      return
    }

    persistTransactionSheetDefaults(sheetDefaults)
  }, [sheetDefaults])

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

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType)
    setError(null)

    const nextCompatibleCategories = getCompatibleCategories(categories, nextType)

    if (nextCompatibleCategories.some((category) => category.id === categoryId)) {
      return
    }

    if (mode === 'create') {
      const preferredCategoryId = sheetDefaults.lastCategoryByType[nextType]

      if (
        preferredCategoryId &&
        nextCompatibleCategories.some(
          (category) => category.id === preferredCategoryId,
        )
      ) {
        setCategoryId(preferredCategoryId)
        return
      }
    }

    setCategoryId(nextCompatibleCategories[0]?.id ?? '')
  }

  const persistQuickCategoryChips = (nextQuickCategoryIds: string[]) => {
    setSheetDefaults((currentDefaults) => {
      return {
        ...currentDefaults,
        quickCategoryByType: {
          ...currentDefaults.quickCategoryByType,
          [type]: nextQuickCategoryIds,
        },
      }
    })
  }

  const handleSelectCategory = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId)
    setError(null)

    const existingCategoryIds = quickCategoryIds.filter(
      (categoryIdValue) => categoryIdValue !== nextCategoryId,
    )
    const nextQuickCategoryIds = [nextCategoryId, ...existingCategoryIds].slice(
      0,
      MAX_QUICK_CATEGORY_CHIPS,
    )

    persistQuickCategoryChips(nextQuickCategoryIds)
  }

  const handleRemoveQuickCategoryChip = (categoryIdToRemove: string) => {
    const filteredQuickCategoryIds = quickCategoryIds.filter(
      (chipCategoryId) => chipCategoryId !== categoryIdToRemove,
    )
    const fallbackCategoryId = getDefaultQuickCategoryId(compatibleCategories)
    const nextQuickCategoryIds =
      filteredQuickCategoryIds.length > 0 || !fallbackCategoryId
        ? filteredQuickCategoryIds
        : [fallbackCategoryId]

    persistQuickCategoryChips(nextQuickCategoryIds)

    if (selectedCategoryId === categoryIdToRemove) {
      setCategoryId(nextQuickCategoryIds[0] ?? fallbackCategoryId)
    }

    setError(null)
  }

  const handleDelete = () => {
    if (!initialTransaction || !onDelete) {
      return
    }

    const confirmed = window.confirm(
      `Delete ${initialTransaction.note || initialTransaction.type} from history?`,
    )

    if (!confirmed) {
      return
    }

    requestClose(() => {
      onDelete(initialTransaction.id)
    })
  }

  const openDatePicker = () => {
    const dateInput = dateInputRef.current

    if (!dateInput) {
      return
    }

    dateInput.focus({ preventScroll: true })

    if (typeof dateInput.showPicker === 'function') {
      try {
        dateInput.showPicker()
        return
      } catch {
        // Ignore and fallback to click for browsers with stricter picker constraints.
      }
    }

    dateInput.click()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const numericAmount = parseAmountInput(amount)

    if (!selectedCategoryId) {
      setError('Create a matching category first.')
      return
    }

    if (!Number.isFinite(numericAmount)) {
      setError(AMOUNT_FORMAT_ERROR)
      return
    }

    if (numericAmount <= 0) {
      setError('Amount must be greater than zero.')
      return
    }

    let recurrence: TransactionRecurrenceInput | null = null

    if (mode === 'create' && showRecurringOptions) {
      const numericIntervalDays = Number(recurringIntervalDays)

      if (
        recurringFrequency === 'custom' &&
        (!Number.isFinite(numericIntervalDays) || numericIntervalDays < 1)
      ) {
        setError('Custom repeat must be at least 1 day.')
        return
      }

      recurrence = {
        frequency: recurringFrequency,
        intervalDays:
          recurringFrequency === 'custom'
            ? Math.floor(numericIntervalDays)
            : null,
        startDate: recurringStartDate,
      }
    }

    const nextDefaults: TransactionSheetDefaults = {
      lastType: type,
      lastCategoryByType: {
        ...sheetDefaults.lastCategoryByType,
        ...(selectedCategoryId ? { [type]: selectedCategoryId } : {}),
      },
      quickCategoryByType: {
        ...sheetDefaults.quickCategoryByType,
        [type]: quickCategoryIds,
      },
    }

    setSheetDefaults(nextDefaults)

    if (mode === 'edit' && initialTransaction) {
      onUpdate({
        id: initialTransaction.id,
        type,
        amount: numericAmount,
        categoryId: selectedCategoryId,
        note,
        occurredAt,
      })
    } else {
      onCreate(
        {
          type,
          amount: numericAmount,
          categoryId: selectedCategoryId,
          note,
          occurredAt,
        },
        recurrence,
      )
    }

    requestClose()
  }

  const hasValidOccurredAt = /^\d{4}-\d{2}-\d{2}$/.test(occurredAt)
  const dateLabel =
    occurredAt === todayDate || !hasValidOccurredAt
      ? 'Today'
      : formatCompactDateLabel(occurredAt)

  return (
    <div
      className="sheet-backdrop"
      data-state={state}
      role="presentation"
      onClick={() => requestClose()}
    >
      <section
        className="panel sheet-panel"
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-header compact-sheet-header">
          <div>
            <p className="eyebrow">{mode === 'edit' ? 'Edit' : 'New'}</p>
            <h3 id="transaction-sheet-title">
              {mode === 'edit' ? 'Update transaction' : 'Add transaction'}
            </h3>
          </div>

          <button
            type="button"
            className="icon-button sheet-close-button"
            aria-label="Close transaction editor"
            title="Close"
            onClick={() => requestClose()}
          >
            <span aria-hidden="true">&#215;</span>
          </button>
        </div>

        <form className="field-grid transaction-sheet-form" onSubmit={handleSubmit}>
          <div className="sheet-amount-field">
            <input
              ref={amountInputRef}
              type="text"
              inputMode="decimal"
              pattern={AMOUNT_INPUT_PATTERN}
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value)
                setError(null)
              }}
              placeholder="0.00"
              aria-label="Amount"
              className="sheet-amount-input"
              autoFocus={mode === 'create'}
              required
            />
          </div>

          <div className="type-toggle" role="group" aria-label="Transaction type">
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

          <div className="sheet-category-section">
            <span className="sheet-inline-label">Category</span>

            <div className="quick-category-chips" role="group" aria-label="Quick categories">
              {quickCategoryOptions.map((category) => (
                <div
                  key={category.id}
                  className={
                    `quick-category-chip ${selectedCategoryId === category.id ? 'active' : ''}`.trim()
                  }
                >
                  <button
                    type="button"
                    className="quick-category-chip-select"
                    onClick={() => handleSelectCategory(category.id)}
                    aria-pressed={selectedCategoryId === category.id}
                  >
                    {category.name}
                  </button>
                  <button
                    type="button"
                    className="quick-category-chip-remove"
                    aria-label={`Remove ${category.name} quick chip`}
                    onClick={() => handleRemoveQuickCategoryChip(category.id)}
                  >
                    -
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="quick-category-add-chip"
                onClick={() => setShowCategoryPicker((current) => !current)}
                aria-expanded={showCategoryPicker}
                aria-controls="all-categories-select"
              >
                + Category
              </button>
            </div>

            {showCategoryPicker ? (
              <label className="sheet-select-label">
                All categories
                <select
                  id="all-categories-select"
                  value={selectedCategoryId}
                  onChange={(event) => {
                    handleSelectCategory(event.target.value)
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
            ) : null}
          </div>

          <div className="sheet-section-separator" aria-hidden="true" />

          <div className="sheet-secondary-chips" role="group" aria-label="Secondary options">
            <label
              className="ghost-button compact sheet-inline-chip sheet-inline-date-chip"
              onClick={openDatePicker}
            >
              <span>Date: {dateLabel}</span>
              <input
                ref={dateInputRef}
                type="date"
                className="sheet-date-input-tap-target"
                aria-label="Transaction date"
                value={hasValidOccurredAt ? occurredAt : todayDate}
                onChange={(event) => {
                  const nextOccurredAt = event.target.value || todayDate

                  setOccurredAt(nextOccurredAt)

                  if (!hasEditedRecurringStartDate) {
                    setRecurringStartDate(nextOccurredAt)
                  }
                }}
                required
              />
            </label>

            {mode === 'create' ? (
              <button
                type="button"
                className={`ghost-button compact sheet-inline-chip ${showRecurringOptions ? 'active' : ''}`.trim()}
                onClick={() => {
                  setShowRecurringOptions((current) => !current)
                  setError(null)
                }}
                aria-expanded={showRecurringOptions}
              >
                Repeat: {recurringSummary}
              </button>
            ) : null}
          </div>

          {mode === 'create' ? (
            showRecurringOptions ? (
              <div className="sheet-recurring-fields compact">
                <div className="pill-switch" role="group" aria-label="Recurring frequency">
                  <button
                    type="button"
                    className={recurringFrequency === 'monthly' ? 'active' : ''}
                    onClick={() => {
                      setRecurringFrequency('monthly')
                      setError(null)
                    }}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    className={recurringFrequency === 'custom' ? 'active' : ''}
                    onClick={() => {
                      setRecurringFrequency('custom')
                      setError(null)
                    }}
                  >
                    Custom
                  </button>
                </div>

                {recurringFrequency === 'custom' ? (
                  <label className="sheet-select-label">
                    Repeat every how many days?
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={recurringIntervalDays}
                      onChange={(event) => {
                        setRecurringIntervalDays(event.target.value)
                        setError(null)
                      }}
                      required
                    />
                  </label>
                ) : null}

                <label className="sheet-select-label">
                  Start date
                  <input
                    type="date"
                    min={occurredAt}
                    value={recurringStartDate}
                    onChange={(event) => {
                      setRecurringStartDate(event.target.value)
                      setHasEditedRecurringStartDate(true)
                      setError(null)
                    }}
                    required
                  />
                </label>

                <p className="support-copy sheet-recurring-help">
                  Due items stay visible on Home until you confirm them.
                </p>
              </div>
            ) : null
          ) : recurringTemplate ? (
            <div className="sheet-recurring-origin-card">
              <p className="sheet-recurring-origin-title">
                This transaction is part of a recurring series.
              </p>
              <p className="sheet-recurring-origin-copy">
                {recurringTemplate.active
                  ? 'Changes here affect only this transaction. Edit the recurring source separately for future occurrences.'
                  : 'Changes here affect only this transaction. The recurring source has already been stopped.'}
              </p>

              <div className="sheet-recurring-origin-actions">
                {recurringTemplate.active && onEditFutureRecurring ? (
                  <button
                    type="button"
                    className="ghost-button compact"
                    onClick={() => {
                      requestClose(() => onEditFutureRecurring(recurringTemplate.id))
                    }}
                  >
                    Edit future recurring transactions
                  </button>
                ) : null}

                {recurringTemplate.active && onStopRecurring ? (
                  <button
                    type="button"
                    className="ghost-button compact danger-button"
                    onClick={() => {
                      const confirmed = window.confirm(
                        'Stop recurring for future occurrences?',
                      )

                      if (!confirmed) {
                        return
                      }

                      requestClose(() => onStopRecurring(recurringTemplate.id))
                    }}
                  >
                    Stop recurring
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {showNoteInput ? (
            <label className="sheet-note-label">
              Note (optional)
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Add note"
                className="quick-note-input"
              />
            </label>
          ) : (
            <button
              type="button"
              className="text-button sheet-inline-link"
              onClick={() => setShowNoteInput(true)}
            >
              + Add note
            </button>
          )}

          {error ? <p className="inline-error">{error}</p> : null}

          <div className={`sheet-footer-actions ${mode === 'edit' ? 'with-delete' : ''}`.trim()}>
            <button type="submit" className="submit-button">
              {mode === 'edit' ? 'Save' : 'Add'}
            </button>

            {mode === 'edit' && initialTransaction && onDelete ? (
              <button
                type="button"
                className="ghost-button danger-button"
                onClick={handleDelete}
              >
                Delete transaction
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  )
}
