import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { formatCompactDateLabel } from '../../domain/formatters'
import type {
  AddTransactionInput,
  UpdateTransactionInput,
} from '../../state/finance-store'
import type { Category, Transaction, TransactionType } from '../../domain/models'
import { getTodayLocalDate } from '../../utils/date'

interface TransactionEditorSheetProps {
  mode: 'create' | 'edit'
  categories: Category[]
  initialTransaction?: Transaction | null
  onClose: () => void
  onCreate: (input: AddTransactionInput) => void
  onUpdate: (input: UpdateTransactionInput) => void
  onDelete?: (transactionId: string) => void
}

const SHEET_CLOSE_MS = 280
const SHEET_DEFAULTS_KEY = 'tally.transaction-sheet.defaults.v1'
const MAX_QUICK_CATEGORY_CHIPS = 5

interface TransactionSheetDefaults {
  lastType: TransactionType
  lastCategoryByType: Partial<Record<TransactionType, string>>
}

const EMPTY_SHEET_DEFAULTS: TransactionSheetDefaults = {
  lastType: 'expense',
  lastCategoryByType: {},
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
    }
    const normalizedDefaults: TransactionSheetDefaults = {
      lastType: isTransactionType(candidate.lastType)
        ? candidate.lastType
        : 'expense',
      lastCategoryByType: {},
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

export function TransactionEditorSheet({
  mode,
  categories,
  initialTransaction,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
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
  const [categoryId, setCategoryId] = useState(initialCategory)
  const [occurredAt, setOccurredAt] = useState(
    initialTransaction?.occurredAt ?? todayDate,
  )
  const [note, setNote] = useState(initialTransaction?.note ?? '')
  const [showDatePicker, setShowDatePicker] = useState(
    Boolean(initialTransaction && initialTransaction.occurredAt !== todayDate),
  )
  const [showNoteInput, setShowNoteInput] = useState(
    Boolean(initialTransaction?.note),
  )
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<'opening' | 'open' | 'closing'>('opening')
  const closingRef = useRef(false)
  const closeTimeoutRef = useRef<number | null>(null)

  const compatibleCategories = getCompatibleCategories(categories, type)
  const selectedCategoryId =
    compatibleCategories.find((category) => category.id === categoryId)?.id ??
    compatibleCategories[0]?.id ??
    ''
  const quickCategoryOptions = useMemo(() => {
    const firstCategories = compatibleCategories.slice(0, MAX_QUICK_CATEGORY_CHIPS)

    if (
      selectedCategoryId &&
      !firstCategories.some((category) => category.id === selectedCategoryId)
    ) {
      const selectedCategory = compatibleCategories.find(
        (category) => category.id === selectedCategoryId,
      )

      if (selectedCategory) {
        return [
          selectedCategory,
          ...firstCategories.slice(0, MAX_QUICK_CATEGORY_CHIPS - 1),
        ]
      }
    }

    return firstCategories
  }, [compatibleCategories, selectedCategoryId])
  const hasMoreCategories = compatibleCategories.length > MAX_QUICK_CATEGORY_CHIPS

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setState('open')
    })
    const autofocusTimeout =
      mode === 'create'
        ? window.setTimeout(() => {
            amountInputRef.current?.focus()
            amountInputRef.current?.select()
          }, 120)
        : null

    return () => {
      window.cancelAnimationFrame(frame)
      if (autofocusTimeout !== null) {
        window.clearTimeout(autofocusTimeout)
      }

      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [mode])

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const numericAmount = Number(amount)

    if (!selectedCategoryId) {
      setError('Create a matching category first.')
      return
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Amount must be greater than zero.')
      return
    }

    const nextDefaults: TransactionSheetDefaults = {
      lastType: type,
      lastCategoryByType: {
        ...sheetDefaults.lastCategoryByType,
        ...(selectedCategoryId ? { [type]: selectedCategoryId } : {}),
      },
    }

    setSheetDefaults(nextDefaults)
    persistTransactionSheetDefaults(nextDefaults)

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
      onCreate({
        type,
        amount: numericAmount,
        categoryId: selectedCategoryId,
        note,
        occurredAt,
      })
    }

    requestClose()
  }

  const dateLabel =
    occurredAt === todayDate ? 'Today' : formatCompactDateLabel(occurredAt)

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
        <div className="sheet-grabber" aria-hidden="true" />

        <div className="sheet-header compact-sheet-header">
          <div>
            <p className="eyebrow">{mode === 'edit' ? 'Edit' : 'New'}</p>
            <h3 id="transaction-sheet-title">
              {mode === 'edit' ? 'Update transaction' : 'Add transaction'}
            </h3>
          </div>
        </div>

        <form className="field-grid transaction-sheet-form" onSubmit={handleSubmit}>
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

          <div className="sheet-amount-field">
            <input
              ref={amountInputRef}
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
              aria-label="Amount"
              className="sheet-amount-input"
              required
            />
          </div>

          <div className="sheet-category-section">
            <div className="sheet-inline-row">
              <span className="sheet-inline-label">Category</span>
              {hasMoreCategories ? (
                <button
                  type="button"
                  className="text-button sheet-inline-link"
                  onClick={() => setShowCategoryPicker((current) => !current)}
                >
                  {showCategoryPicker ? 'Hide all' : 'More'}
                </button>
              ) : null}
            </div>

            <div className="quick-category-chips" role="group" aria-label="Quick categories">
              {quickCategoryOptions.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={
                    `quick-category-chip ${selectedCategoryId === category.id ? 'active' : ''}`.trim()
                  }
                  onClick={() => {
                    setCategoryId(category.id)
                    setError(null)
                  }}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {showCategoryPicker ? (
              <label className="sheet-select-label">
                All categories
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
            ) : null}
          </div>

          <div className="sheet-inline-row">
            <span className="sheet-inline-label">Date</span>
            <button
              type="button"
              className="ghost-button compact sheet-inline-button"
              onClick={() => setShowDatePicker((current) => !current)}
            >
              {dateLabel}
            </button>
          </div>

          {showDatePicker ? (
            <label className="sheet-select-label">
              Transaction date
              <input
                type="date"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
                required
              />
            </label>
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
