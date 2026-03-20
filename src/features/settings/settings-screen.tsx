import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import type { PreparedBackupRestore } from '../../backup/backup-models'
import { prepareBackupRestoreFile } from '../../backup/restore-service'
import { RestoreBackupDialog } from '../backup/backup-ui'
import type { CategoryDeletionStrategy } from '../../domain/category-service'
import { exportTransactionsAsCsv } from '../../domain/exporters'
import {
  getRecurringFrequencyLabel,
  getRecurringTemplateLabel,
} from '../../domain/recurring'
import { formatCurrency, formatDateTimeLabel, formatLongDateLabel } from '../../domain/formatters'
import type { Category, CategoryKind } from '../../domain/models'
import { getVisibleManagedCategories } from '../../domain/categories'
import { getMonthKey } from '../../domain/selectors'
import { useFinance } from '../../state/use-finance'
import { downloadTextFile } from '../../utils/download'

const currencyOptions = ['USD', 'EUR', 'GBP', 'CZK']
const CATEGORY_SHEET_CLOSE_MS = 280

type SettingsView = 'main' | 'categories' | 'recurring'

function categorySupportsType(
  category: Pick<Category, 'kind'>,
  type: 'income' | 'expense',
): boolean {
  return category.kind === 'both' || category.kind === type
}

interface CategoryEditorInput {
  name: string
  color: string
  kind: CategoryKind
}

interface CategoryEditorSheetProps {
  mode: 'create' | 'edit'
  initialCategory: Category | null
  linkedCount: number
  deletionStrategy: CategoryDeletionStrategy
  replacementCategoryId: string | null
  replacementCategories: Category[]
  deletionImpactSummary: string | null
  deletionConfirmationText: string
  canDelete: boolean
  onDeletionStrategyChange: (strategy: CategoryDeletionStrategy) => void
  onReplacementCategoryChange: (categoryId: string) => void
  onClose: () => void
  onSave: (input: CategoryEditorInput) => string | null
  onDelete: () => string | null
}

function CategoryEditorSheet({
  mode,
  initialCategory,
  linkedCount,
  deletionStrategy,
  replacementCategoryId,
  replacementCategories,
  deletionImpactSummary,
  deletionConfirmationText,
  canDelete,
  onDeletionStrategyChange,
  onReplacementCategoryChange,
  onClose,
  onSave,
  onDelete,
}: CategoryEditorSheetProps) {
  const [name, setName] = useState(initialCategory?.name ?? '')
  const [color, setColor] = useState(initialCategory?.color ?? '#0f766e')
  const [kind, setKind] = useState<CategoryKind>(
    initialCategory?.kind ?? 'expense',
  )
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

  const requestClose = () => {
    if (closingRef.current) {
      return
    }

    closingRef.current = true
    setState('closing')
    closeTimeoutRef.current = window.setTimeout(() => {
      onClose()
    }, CATEGORY_SHEET_CLOSE_MS)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextError = onSave({ name, color, kind })

    if (nextError) {
      setError(nextError)
      return
    }

    requestClose()
  }

  const handleDelete = () => {
    if (!initialCategory || !canDelete) {
      return
    }

    const confirmed = window.confirm(deletionConfirmationText)

    if (!confirmed) {
      return
    }

    const nextError = onDelete()

    if (nextError) {
      setError(nextError)
      return
    }

    requestClose()
  }

  return (
    <div
      className="sheet-backdrop"
      data-state={state}
      role="presentation"
      onClick={requestClose}
    >
      <section
        className="panel sheet-panel category-sheet-panel"
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grabber" aria-hidden="true" />

        <div className="sheet-header">
          <div>
            <p className="eyebrow">{mode === 'edit' ? 'Edit' : 'New'} category</p>
            <h3 id="category-sheet-title">
              {mode === 'edit' ? 'Update category' : 'Create category'}
            </h3>
          </div>
          <button type="button" className="icon-button" onClick={requestClose}>
            Close
          </button>
        </div>

        <form className="field-grid" onSubmit={handleSubmit}>
          <div className="field-row two-col">
            <label>
              Name
              <input
                type="text"
                maxLength={32}
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setError(null)
                }}
                placeholder="Health"
                required
              />
            </label>

            <label>
              Kind
              <select
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value as CategoryKind)
                  setError(null)
                }}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="both">Both</option>
              </select>
            </label>
          </div>

          <label className="category-color-control">
            Color
            <input
              type="color"
              value={color}
              onChange={(event) => {
                setColor(event.target.value)
                setError(null)
              }}
            />
          </label>

          {mode === 'edit' && initialCategory ? (
            <div className="category-sheet-meta">
              <span className="micro-badge">{initialCategory.kind}</span>
              <span className="micro-badge subtle">{linkedCount} linked</span>
            </div>
          ) : null}

          {mode === 'edit' && canDelete ? (
            <div className="field-grid category-delete-options">
              <div>
                <p className="support-copy">When deleted, linked records are moved to:</p>
                <div className="settings-inline-switch" role="group" aria-label="Category delete strategy">
                  <button
                    type="button"
                    className={deletionStrategy === 'uncategorized' ? 'active' : ''}
                    onClick={() => onDeletionStrategyChange('uncategorized')}
                  >
                    Uncategorized
                  </button>
                  <button
                    type="button"
                    className={deletionStrategy === 'reassign' ? 'active' : ''}
                    onClick={() => onDeletionStrategyChange('reassign')}
                    disabled={replacementCategories.length === 0}
                  >
                    Reassign
                  </button>
                </div>
              </div>

              {deletionStrategy === 'reassign' ? (
                <label>
                  Replacement category
                  <select
                    value={replacementCategoryId ?? ''}
                    onChange={(event) => {
                      onReplacementCategoryChange(event.target.value)
                    }}
                    required
                  >
                    {replacementCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {deletionImpactSummary ? (
                <p className="support-copy">{deletionImpactSummary}</p>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="inline-error">{error}</p> : null}

          <div className={`sheet-footer-actions ${mode === 'edit' ? 'with-delete' : ''}`.trim()}>
            <button type="submit" className="submit-button">
              {mode === 'edit' ? 'Save category' : 'Add category'}
            </button>

            {mode === 'edit' && canDelete ? (
              <button
                type="button"
                className="ghost-button danger-button"
                onClick={handleDelete}
              >
                Delete category
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  )
}

interface SettingsScreenProps {
  canInstall: boolean
  isInstalled: boolean
  onCreateBackup: () => Promise<boolean>
  onInstall: () => void
  onOpenRecurringEditor: (templateId: string) => void
  onShowToast: (message: string) => void
}

export function SettingsScreen({
  canInstall,
  isInstalled,
  onCreateBackup,
  onInstall,
  onOpenRecurringEditor,
  onShowToast,
}: SettingsScreenProps) {
  const {
    state,
    addCategory,
    updateCategory,
    previewCategoryDeletion,
    deleteCategory,
    setTheme,
    setCurrency,
    updateBackupSettings,
    replaceState,
  } = useFinance()

  const [view, setView] = useState<SettingsView>('main')
  const [backupMessage, setBackupMessage] = useState<{
    tone: 'default' | 'error'
    text: string
  } | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<string | 'create' | null>(null)
  const [deletionStrategy, setDeletionStrategy] = useState<CategoryDeletionStrategy>('uncategorized')
  const [replacementCategoryId, setReplacementCategoryId] = useState<string | null>(null)
  const [pendingRestore, setPendingRestore] = useState<{
    fileName: string
    prepared: PreparedBackupRestore
  } | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const managedCategories = useMemo(
    () => getVisibleManagedCategories(state.categories),
    [state.categories],
  )
  const sortedCategories = useMemo(
    () => [...managedCategories].sort((left, right) => left.name.localeCompare(right.name)),
    [managedCategories],
  )

  const linkedTransactionsByCategoryId = useMemo(() => {
    const counts = new Map<string, number>()

    state.transactions.forEach((transaction) => {
      counts.set(
        transaction.categoryId,
        (counts.get(transaction.categoryId) ?? 0) + 1,
      )
    })

    return counts
  }, [state.transactions])

  const activeRecurringTemplates = useMemo(
    () =>
      state.recurringTemplates
        .filter((template) => template.active)
        .sort((left, right) => left.nextDueDate.localeCompare(right.nextDueDate)),
    [state.recurringTemplates],
  )

  const categoryBeingEdited =
    editingCategoryId && editingCategoryId !== 'create'
      ? managedCategories.find((category) => category.id === editingCategoryId) ?? null
      : null

  const requiredReplacementTypes = useMemo(() => {
    if (!categoryBeingEdited) {
      return [] as Array<'income' | 'expense'>
    }

    const typeSet = new Set<'income' | 'expense'>()

    state.transactions
      .filter((transaction) => transaction.categoryId === categoryBeingEdited.id)
      .forEach((transaction) => {
        typeSet.add(transaction.type)
      })

    state.recurringTemplates
      .filter((template) => template.categoryId === categoryBeingEdited.id)
      .forEach((template) => {
        typeSet.add(template.type)
      })

    return [...typeSet]
  }, [categoryBeingEdited, state.recurringTemplates, state.transactions])

  const replacementCategories = useMemo(() => {
    if (!categoryBeingEdited) {
      return [] as Category[]
    }

    return sortedCategories.filter((category) => {
      if (category.id === categoryBeingEdited.id) {
        return false
      }

      return requiredReplacementTypes.every((type) => categorySupportsType(category, type))
    })
  }, [categoryBeingEdited, requiredReplacementTypes, sortedCategories])

  const effectiveReplacementCategoryId =
    replacementCategories.find((category) => category.id === replacementCategoryId)?.id ??
    replacementCategories[0]?.id ??
    null

  const categoryDeletionInput = useMemo(
    () =>
      categoryBeingEdited
        ? {
            categoryId: categoryBeingEdited.id,
            strategy: deletionStrategy,
            replacementCategoryId:
              deletionStrategy === 'reassign' ? effectiveReplacementCategoryId : null,
          }
        : null,
    [categoryBeingEdited, deletionStrategy, effectiveReplacementCategoryId],
  )

  const categoryDeletionPreview = useMemo(() => {
    if (!categoryDeletionInput) {
      return null
    }

    return previewCategoryDeletion(categoryDeletionInput)
  }, [categoryDeletionInput, previewCategoryDeletion])

  const deletionImpactSummary =
    categoryDeletionPreview && categoryDeletionPreview.ok
      ? `${categoryDeletionPreview.plan.impact.transactionCount} transactions, ${categoryDeletionPreview.plan.impact.recurringTemplateCount} recurring templates, ${categoryDeletionPreview.plan.impact.affectedBudgetCount} budgets affected.`
      : categoryDeletionPreview?.message ?? null

  const deletionConfirmationText =
    categoryDeletionPreview && categoryDeletionPreview.ok
      ? `Delete category ${categoryDeletionPreview.plan.impact.categoryName}?\n\nThis will move ${categoryDeletionPreview.plan.impact.transactionCount} transactions and ${categoryDeletionPreview.plan.impact.recurringTemplateCount} recurring templates to ${categoryDeletionPreview.plan.impact.replacementCategoryName}.\n\nBudgets updated: ${categoryDeletionPreview.plan.impact.budgetsKeepingCategoriesCount}\nBudgets removed: ${categoryDeletionPreview.plan.impact.budgetsDeletedCount}`
      : 'Delete this category?'

  const editingLinkedCount = categoryBeingEdited
    ? linkedTransactionsByCategoryId.get(categoryBeingEdited.id) ?? 0
    : 0

  const handleExportCsv = () => {
    downloadTextFile(
      `tally-transactions-${getMonthKey()}.csv`,
      exportTransactionsAsCsv(state),
      'text/csv;charset=utf-8',
    )
  }

  const handleCreateBackup = async () => {
    setBackupMessage(null)

    const didCreateBackup = await onCreateBackup()

    if (!didCreateBackup) {
      setBackupMessage({ tone: 'error', text: 'Backup could not be downloaded.' })
    }
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setBackupMessage(null)

    const restoreResult = await prepareBackupRestoreFile(file)

    if (!restoreResult.ok) {
      setBackupMessage({ tone: 'error', text: restoreResult.message })
      event.target.value = ''
      return
    }

    setPendingRestore({
      fileName: file.name,
      prepared: restoreResult.prepared,
    })
    event.target.value = ''
  }

  const handleConfirmRestore = async () => {
    if (!pendingRestore) {
      return
    }

    try {
      await replaceState(pendingRestore.prepared.nextState)
      setPendingRestore(null)
      setBackupMessage(null)
      onShowToast('Backup restored successfully.')
    } catch {
      setBackupMessage({ tone: 'error', text: 'Backup could not be restored.' })
    }
  }

  const handleSaveCategory = (input: CategoryEditorInput): string | null => {
    const trimmedName = input.name.trim()

    if (!trimmedName) {
      return 'Category name is required.'
    }

    const normalizedName = trimmedName.toLowerCase()
    const editingId = editingCategoryId !== 'create' ? editingCategoryId : null
    const duplicateName = state.categories.some(
      (category) =>
        category.id !== editingId &&
        category.name.trim().toLowerCase() === normalizedName,
    )

    if (duplicateName) {
      return 'That category already exists.'
    }

    if (editingId) {
      const linkedTransactions = state.transactions.filter(
        (transaction) => transaction.categoryId === editingId,
      )
      const linkedRecurringTemplates = state.recurringTemplates.filter(
        (template) => template.categoryId === editingId,
      )
      const incompatibleKind = linkedTransactions.some(
        (transaction) => input.kind !== 'both' && transaction.type !== input.kind,
      )
      const incompatibleRecurringKind = linkedRecurringTemplates.some(
        (template) => input.kind !== 'both' && template.type !== input.kind,
      )
      const hasLinkedBudgets = state.budgets.some((budget) =>
        budget.categoryIds.includes(editingId),
      )

      if (incompatibleKind) {
        return 'This category already has linked transactions of the other type.'
      }

      if (incompatibleRecurringKind) {
        return 'This category already has recurring templates of the other type.'
      }

      if (input.kind === 'income' && hasLinkedBudgets) {
        return 'Budgets are linked to this category. Move or remove those budgets first.'
      }

      updateCategory({
        id: editingId,
        name: trimmedName,
        color: input.color,
        kind: input.kind,
      })

      return null
    }

    addCategory({
      name: trimmedName,
      color: input.color,
      kind: input.kind,
    })

    return null
  }

  const handleDeleteCategory = (): string | null => {
    if (!categoryDeletionInput) {
      return 'Category not found.'
    }

    const preview = previewCategoryDeletion(categoryDeletionInput)

    if (!preview.ok) {
      return preview.message
    }

    const deleteMessage = deleteCategory(categoryDeletionInput)

    if (deleteMessage) {
      return deleteMessage
    }

    return null
  }

  const openCategoryEditor = (categoryId: string | 'create') => {
    setEditingCategoryId(categoryId)

    if (categoryId === 'create') {
      setDeletionStrategy('uncategorized')
      setReplacementCategoryId(null)
      return
    }

    const category = managedCategories.find((entry) => entry.id === categoryId)

    if (!category) {
      setDeletionStrategy('uncategorized')
      setReplacementCategoryId(null)
      return
    }

    const linkedTypes = new Set<'income' | 'expense'>()
    state.transactions
      .filter((transaction) => transaction.categoryId === category.id)
      .forEach((transaction) => {
        linkedTypes.add(transaction.type)
      })
    state.recurringTemplates
      .filter((template) => template.categoryId === category.id)
      .forEach((template) => {
        linkedTypes.add(template.type)
      })

    const initialReplacementOptions = managedCategories.filter((entry) => {
      if (entry.id === category.id) {
        return false
      }

      return [...linkedTypes].every((type) => categorySupportsType(entry, type))
    })

    if (initialReplacementOptions.length > 0) {
      setDeletionStrategy('reassign')
      setReplacementCategoryId(initialReplacementOptions[0].id)
      return
    }

    setDeletionStrategy('uncategorized')
    setReplacementCategoryId(null)
  }

  const closeCategoryEditor = () => {
    setEditingCategoryId(null)
    setDeletionStrategy('uncategorized')
    setReplacementCategoryId(null)
  }

  return (
    <div className="screen-stack settings-screen">
      {view === 'main' ? (
        <section className="panel settings-list-panel">
          <div className="settings-group">
            <p className="settings-group-title">General</p>

            <div className="settings-group-list">
              <label className="settings-list-row settings-control-row">
                <span className="settings-row-label">Currency</span>
                <select
                  value={state.settings.currency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>

              <div className="settings-list-row settings-control-row">
                <span className="settings-row-label">Theme</span>
                <div className="settings-inline-switch" role="group" aria-label="Theme">
                  <button
                    type="button"
                    className={state.settings.theme === 'auto' ? 'active' : ''}
                    onClick={() => setTheme('auto')}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    className={state.settings.theme === 'light' ? 'active' : ''}
                    onClick={() => setTheme('light')}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    className={state.settings.theme === 'dark' ? 'active' : ''}
                    onClick={() => setTheme('dark')}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="settings-group">
            <p className="settings-group-title">Backup &amp; Restore</p>

            <div className="settings-group-list">
              <div className="settings-list-row">
                <span className="settings-row-label">Last backup</span>
                <span className="settings-row-value">
                  {formatDateTimeLabel(state.settings.lastBackupAt)}
                </span>
              </div>

              <div className="settings-list-row settings-backup-toggle-row">
                <div className="settings-row-copy">
                  <span className="settings-row-label">Backup reminders</span>
                  <span className="settings-row-caption">
                    {state.settings.backupRemindersEnabled ? 'On' : 'Off'}
                  </span>
                </div>

                <div className="settings-inline-switch" role="group" aria-label="Backup reminders">
                  <button
                    type="button"
                    className={state.settings.backupRemindersEnabled ? 'active' : ''}
                    onClick={() => {
                      updateBackupSettings({ backupRemindersEnabled: true })
                    }}
                  >
                    On
                  </button>
                  <button
                    type="button"
                    className={!state.settings.backupRemindersEnabled ? 'active' : ''}
                    onClick={() => {
                      updateBackupSettings({ backupRemindersEnabled: false })
                    }}
                  >
                    Off
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-backup-actions">
              <button
                type="button"
                className="submit-button compact"
                onClick={() => {
                  void handleCreateBackup()
                }}
              >
                Create backup
              </button>

              <button
                type="button"
                className="ghost-button compact"
                onClick={() => importInputRef.current?.click()}
              >
                Restore backup
              </button>
            </div>

            <input
              ref={importInputRef}
              className="settings-import-input"
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
            />

            <p className="support-copy settings-backup-help">
              Backup files contain sensitive financial data. Store them securely.
            </p>

            {backupMessage ? (
              <p className={backupMessage.tone === 'error' ? 'inline-error' : 'support-copy'}>
                {backupMessage.text}
              </p>
            ) : null}
          </div>

          <div className="settings-group">
            <p className="settings-group-title">Data</p>

            <div className="settings-group-list">
              <button
                type="button"
                className="settings-list-row settings-action-row"
                onClick={handleExportCsv}
              >
                <span className="settings-row-label">Export CSV</span>
                <span className="settings-row-caption">Transactions only</span>
              </button>

              {canInstall ? (
                <button
                  type="button"
                  className="settings-list-row settings-action-row"
                  onClick={onInstall}
                >
                  <span className="settings-row-label">Install app</span>
                  <span className="settings-row-caption">Add to this device</span>
                </button>
              ) : null}
            </div>

            {isInstalled ? <p className="support-copy">App is already installed on this device.</p> : null}
          </div>

          <div className="settings-group">
            <p className="settings-group-title">Recurring</p>

            <div className="settings-group-list">
              <button
                type="button"
                className="settings-list-row settings-nav-row"
                onClick={() => setView('recurring')}
              >
                <div className="settings-row-copy">
                  <span className="settings-row-label">Manage recurring</span>
                  <span className="settings-row-caption">
                    {activeRecurringTemplates.length} active
                  </span>
                </div>
                <span className="settings-row-chevron" aria-hidden="true">
                  {'>'}
                </span>
              </button>
            </div>
          </div>

          <div className="settings-group">
            <p className="settings-group-title">Categories</p>

            <div className="settings-group-list">
              <button
                type="button"
                className="settings-list-row settings-nav-row"
                onClick={() => setView('categories')}
              >
                <span className="settings-row-label">Manage categories</span>
                <span className="settings-row-chevron" aria-hidden="true">
                  {'>'}
                </span>
              </button>
            </div>
          </div>

        </section>
      ) : view === 'categories' ? (
        <section className="panel settings-list-panel">
          <div className="settings-categories-header">
            <button
              type="button"
              className="ghost-button compact"
              onClick={() => setView('main')}
            >
              Back
            </button>

            <div>
              <p className="eyebrow">CATEGORIES</p>
              <h3>Manage categories</h3>
              <p>Tap a row to edit. Deletion now supports reassignment or Uncategorized fallback.</p>
            </div>

            <button
              type="button"
              className="submit-button compact"
              onClick={() => openCategoryEditor('create')}
            >
              + Add
            </button>
          </div>

          <div className="settings-group-list settings-category-list-panel">
            {sortedCategories.map((category) => {
              const linkedCount = linkedTransactionsByCategoryId.get(category.id) ?? 0

              return (
                <button
                  key={category.id}
                  type="button"
                  className="settings-category-row"
                  onClick={() => openCategoryEditor(category.id)}
                >
                  <div className="settings-category-main">
                    <span
                      className="chip-dot"
                      aria-hidden="true"
                      style={{ backgroundColor: category.color }}
                    />

                    <div className="settings-category-info">
                      <strong>{category.name}</strong>
                      <span className="settings-category-kind">{category.kind}</span>
                    </div>
                  </div>

                  <div className="settings-category-meta">
                    <span className="settings-category-count">{linkedCount} linked</span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ) : (
        <section className="panel settings-list-panel">
          <div className="settings-categories-header">
            <button
              type="button"
              className="ghost-button compact"
              onClick={() => setView('main')}
            >
              Back
            </button>

            <div>
              <p className="eyebrow">RECURRING</p>
              <h3>Recurring transactions</h3>
              <p>Manage future occurrences without changing past records.</p>
            </div>

            <span className="micro-badge subtle">
              {activeRecurringTemplates.length} active
            </span>
          </div>

          {activeRecurringTemplates.length === 0 ? (
            <p className="empty-state">
              Recurring items you create will appear here for future editing.
            </p>
          ) : (
            <div className="settings-group-list settings-category-list-panel">
              {activeRecurringTemplates.map((template) => {
                const category = state.categories.find(
                  (entry) => entry.id === template.categoryId,
                )

                return (
                  <button
                    key={template.id}
                    type="button"
                    className="settings-category-row"
                    onClick={() => onOpenRecurringEditor(template.id)}
                  >
                    <div className="settings-category-main">
                      <span
                        className="chip-dot"
                        aria-hidden="true"
                        style={{ backgroundColor: category?.color ?? 'var(--accent)' }}
                      />

                      <div className="settings-category-info">
                        <strong>
                          {getRecurringTemplateLabel(template, category?.name)}
                        </strong>
                        <span className="settings-category-kind">
                          {getRecurringFrequencyLabel(template)} · due {formatLongDateLabel(template.nextDueDate)}
                        </span>
                      </div>
                    </div>

                    <div className="settings-category-meta recurring-settings-meta">
                      <span className="micro-badge subtle">{template.type}</span>
                      <strong className="settings-row-value">
                        {formatCurrency(template.amount, state.settings.currency)}
                      </strong>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      {editingCategoryId ? (
        <CategoryEditorSheet
          key={editingCategoryId}
          mode={editingCategoryId === 'create' ? 'create' : 'edit'}
          initialCategory={categoryBeingEdited}
          linkedCount={editingLinkedCount}
          deletionStrategy={deletionStrategy}
          replacementCategoryId={effectiveReplacementCategoryId}
          replacementCategories={replacementCategories}
          deletionImpactSummary={deletionImpactSummary}
          deletionConfirmationText={deletionConfirmationText}
          canDelete={Boolean(categoryBeingEdited)}
          onDeletionStrategyChange={(strategy) => {
            setDeletionStrategy(strategy)
          }}
          onReplacementCategoryChange={(categoryId) => {
            setReplacementCategoryId(categoryId)
          }}
          onClose={closeCategoryEditor}
          onSave={handleSaveCategory}
          onDelete={handleDeleteCategory}
        />
      ) : null}

      {pendingRestore ? (
        <RestoreBackupDialog
          fileName={pendingRestore.fileName}
          exportedAtLabel={formatDateTimeLabel(pendingRestore.prepared.payload.exportedAt)}
          onCancel={() => setPendingRestore(null)}
          onConfirm={handleConfirmRestore}
        />
      ) : null}
    </div>
  )
}
