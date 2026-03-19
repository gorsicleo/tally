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
import { exportTransactionsAsCsv } from '../../domain/exporters'
import { formatDateTimeLabel } from '../../domain/formatters'
import type { Category, CategoryKind } from '../../domain/models'
import { getMonthKey, getSyncSummary } from '../../domain/selectors'
import { useFinance } from '../../state/use-finance'
import { downloadTextFile } from '../../utils/download'
import { ThemeToggle } from '../shell/theme-toggle'

const currencyOptions = ['USD', 'EUR', 'GBP', 'CZK']
const CATEGORY_SHEET_CLOSE_MS = 280

type SettingsView = 'main' | 'categories'

interface CategoryEditorInput {
  name: string
  color: string
  kind: CategoryKind
}

interface CategoryEditorSheetProps {
  mode: 'create' | 'edit'
  initialCategory: Category | null
  linkedCount: number
  onClose: () => void
  onSave: (input: CategoryEditorInput) => string | null
  onDelete: () => string | null
}

function CategoryEditorSheet({
  mode,
  initialCategory,
  linkedCount,
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
    if (!initialCategory) {
      return
    }

    const confirmed = window.confirm(`Delete category ${initialCategory.name}?`)

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
              {initialCategory.isDefault ? (
                <span className="micro-badge subtle">default</span>
              ) : null}
              <span className="micro-badge subtle">{linkedCount} linked</span>
            </div>
          ) : null}

          {error ? <p className="inline-error">{error}</p> : null}

          <div className={`sheet-footer-actions ${mode === 'edit' ? 'with-delete' : ''}`.trim()}>
            <button type="submit" className="submit-button">
              {mode === 'edit' ? 'Save category' : 'Add category'}
            </button>

            {mode === 'edit' ? (
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
  onShowToast: (message: string) => void
}

export function SettingsScreen({
  canInstall,
  isInstalled,
  onCreateBackup,
  onInstall,
  onShowToast,
}: SettingsScreenProps) {
  const {
    state,
    isOnline,
    isSyncing,
    addCategory,
    updateCategory,
    deleteCategory,
    setTheme,
    setCurrency,
    setSyncEndpoint,
    updateBackupSettings,
    replaceState,
    syncNow,
  } = useFinance()

  const [view, setView] = useState<SettingsView>('main')
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [backupMessage, setBackupMessage] = useState<{
    tone: 'default' | 'error'
    text: string
  } | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<string | 'create' | null>(null)
  const [pendingRestore, setPendingRestore] = useState<{
    fileName: string
    prepared: PreparedBackupRestore
  } | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const syncSummary = useMemo(() => getSyncSummary(state), [state])

  const sortedCategories = useMemo(
    () =>
      [...state.categories].sort((left, right) => {
        if (left.isDefault !== right.isDefault) {
          return left.isDefault ? -1 : 1
        }

        return left.name.localeCompare(right.name)
      }),
    [state.categories],
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

  const categoryBeingEdited =
    editingCategoryId && editingCategoryId !== 'create'
      ? state.categories.find((category) => category.id === editingCategoryId) ?? null
      : null

  const editingLinkedCount = categoryBeingEdited
    ? linkedTransactionsByCategoryId.get(categoryBeingEdited.id) ?? 0
    : 0

  const syncStatusLabel = isSyncing
    ? 'Syncing'
    : !isOnline
      ? 'Offline'
      : syncSummary.failed > 0
        ? `${syncSummary.failed} failed`
        : syncSummary.pending > 0
          ? `${syncSummary.pending} pending`
          : 'Synced'

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
      const incompatibleKind = linkedTransactions.some(
        (transaction) => input.kind !== 'both' && transaction.type !== input.kind,
      )

      if (incompatibleKind) {
        return 'This category already has linked transactions of the other type.'
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
    if (!categoryBeingEdited) {
      return 'Category not found.'
    }

    if (categoryBeingEdited.isDefault) {
      return 'Default categories cannot be deleted.'
    }

    if ((linkedTransactionsByCategoryId.get(categoryBeingEdited.id) ?? 0) > 0) {
      return 'Delete or reassign linked transactions before removing this category.'
    }

    deleteCategory(categoryBeingEdited.id)

    return null
  }

  const openCategoryEditor = (categoryId: string | 'create') => {
    setEditingCategoryId(categoryId)
  }

  const closeCategoryEditor = () => {
    setEditingCategoryId(null)
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
                <ThemeToggle
                  theme={state.settings.theme}
                  onToggle={() =>
                    setTheme(state.settings.theme === 'dark' ? 'light' : 'dark')
                  }
                />
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

          <div className="settings-group">
            <p className="settings-group-title">Sync</p>

            <div className="settings-group-list">
              <div className="settings-list-row">
                <span className="settings-row-label">Status</span>
                <span className="settings-row-value">{syncStatusLabel}</span>
              </div>
              <div className="settings-list-row">
                <span className="settings-row-label">Last synced</span>
                <span className="settings-row-value">{formatDateTimeLabel(state.lastSyncedAt)}</span>
              </div>
            </div>

            <div className="settings-sync-actions">
              <button
                type="button"
                className="submit-button compact"
                onClick={() => {
                  void syncNow()
                }}
                disabled={!isOnline || isSyncing}
              >
                {isSyncing ? 'Syncing...' : 'Sync now'}
              </button>

              {canInstall ? (
                <button
                  type="button"
                  className="ghost-button compact"
                  onClick={onInstall}
                >
                  Install app
                </button>
              ) : null}
            </div>

            {isInstalled ? <p className="support-copy">App is already installed on this device.</p> : null}
            {state.lastSyncError ? <p className="inline-error">{state.lastSyncError}</p> : null}
          </div>

          <div className="settings-group settings-advanced-group">
            <button
              type="button"
              className="settings-advanced-toggle"
              onClick={() => setIsAdvancedOpen((current) => !current)}
            >
              <span className="settings-row-label">Advanced settings</span>
              <span className="settings-row-chevron" aria-hidden="true">
                {isAdvancedOpen ? '−' : '+'}
              </span>
            </button>

            {isAdvancedOpen ? (
              <div className="settings-advanced-body">
                <label>
                  Sync endpoint
                  <input
                    type="url"
                    value={state.settings.syncEndpoint}
                    onChange={(event) => setSyncEndpoint(event.target.value)}
                    placeholder="demo://local or https://your-api/sync"
                  />
                </label>

                <div className="settings-endpoint-buttons">
                  <button
                    type="button"
                    className="ghost-button compact"
                    onClick={() => setSyncEndpoint('demo://local')}
                  >
                    Use demo sync
                  </button>
                  <button
                    type="button"
                    className="ghost-button compact"
                    onClick={() => setSyncEndpoint('http://localhost:8787/api/sync')}
                  >
                    Use local API
                  </button>
                </div>

                <p className="support-copy">
                  Conflict policy is <strong>client wins</strong>. Local changes stay source of truth.
                </p>
              </div>
            ) : null}
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
              <p className="eyebrow">CATEGORIES</p>
              <h3>Manage categories</h3>
              <p>Tap a row to edit. Delete lives inside the editor.</p>
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
                    {category.isDefault ? (
                      <span className="micro-badge subtle">default</span>
                    ) : null}
                    <span className="settings-category-count">{linkedCount} linked</span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {editingCategoryId ? (
        <CategoryEditorSheet
          key={editingCategoryId}
          mode={editingCategoryId === 'create' ? 'create' : 'edit'}
          initialCategory={categoryBeingEdited}
          linkedCount={editingLinkedCount}
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
