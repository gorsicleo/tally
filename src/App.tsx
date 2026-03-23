import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  downloadBackupFile,
} from './backup/backup-service'
import {
  evaluateBackupReminder,
  getBackupReminderBody,
} from './backup/backup-reminder-service'
import { formatMonthLabel } from './domain/formatters'
import { getNextRecurringDate } from './domain/recurring'
import { getMonthKey } from './domain/selectors'
import {
  BackupReminderCard,
  PrivacyFirstModal,
} from './features/backup/backup-ui'
import { useInstallPrompt } from './pwa/register-service-worker'
import { AppHeader } from './features/shell/app-header'
import { TabBar, type AppTab } from './features/shell/tab-bar'
import {
  getActiveTabMeta,
  getHeaderVariant,
} from './features/shell/app-tab-metadata'
import { AppScreenResolver } from './features/shell/app-screen-resolver'
import { useEditorOrchestration } from './features/shell/use-editor-orchestration'
import { RecurringEditorSheet } from './features/recurring/recurring-editor-sheet'
import { TransactionEditorSheet } from './features/transactions/transaction-editor-sheet'
import { FinanceProvider } from './state/finance-context'
import { useFinance } from './state/use-finance'
import type { BackupPreferences } from './domain/models'
import type {
  AddTransactionInput,
  TransactionRecurrenceInput,
  UpdateTransactionInput,
} from './state/finance-store'

function FinanceWorkspace() {
  const {
    state,
    isLoaded,
    addTransaction,
    addRecurringTemplate,
    updateTransaction,
    deleteTransaction,
    stopRecurringTemplate,
    updateBackupSettings,
  } = useFinance()
  const { canInstall, install, isInstalled } = useInstallPrompt()
  const [activeTab, setActiveTab] = useState<AppTab>('home')
  const {
    editorTransactionId,
    editingTransaction,
    editingRecurringTemplate,
    openQuickAdd,
    openTransactionEditor,
    openRecurringEditor,
    closeEditor,
    closeRecurringEditor,
  } = useEditorOrchestration({
    transactions: state.transactions,
    recurringTemplates: state.recurringTemplates,
  })
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const [isBackupReminderVisible, setIsBackupReminderVisible] = useState(false)
  const toastTimeoutRef = useRef<number | null>(null)
  const reminderTimeoutRef = useRef<number | null>(null)
  const hasShownBackupReminderInSession = useRef(false)
  const currentMonthLabel = useMemo(() => formatMonthLabel(getMonthKey()), [])
  const backupReminderDecision = useMemo(
    () => evaluateBackupReminder(state),
    [state],
  )
  const backupReminderBody = useMemo(
    () => getBackupReminderBody(state.settings.lastBackupAt),
    [state.settings.lastBackupAt],
  )

  const handleTabChange = (tab: AppTab) => {
    setActiveTab(tab)
  }

  const activeMeta = getActiveTabMeta(activeTab, currentMonthLabel)
  const headerVariant = getHeaderVariant(activeTab)

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current)
      }

      if (reminderTimeoutRef.current !== null) {
        window.clearTimeout(reminderTimeoutRef.current)
      }
    }
  }, [])

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current)
    }

    setToast({ id: Date.now(), message })
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null)
    }, 1600)
  }, [])

  const createBackup = useCallback(
    async (settingsPatch: Partial<BackupPreferences> = {}) => {
      const result = downloadBackupFile(state, settingsPatch)

      if (!result.ok) {
        showToast(result.message)
        return false
      }

      updateBackupSettings({
        ...settingsPatch,
        lastBackupAt: result.exportedAt,
        changesSinceBackup: 0,
        lastReminderAt: null,
      })
      setIsBackupReminderVisible(false)
      showToast('Backup downloaded successfully.')

      return true
    },
    [showToast, state, updateBackupSettings],
  )

  const handleContinuePrivacyModal = useCallback(
    async (remindersEnabled: boolean) => {
      updateBackupSettings({
        hasSeenPrivacyModal: true,
        backupRemindersEnabled: remindersEnabled,
      })
    },
    [updateBackupSettings],
  )

  useEffect(() => {
    if (reminderTimeoutRef.current !== null) {
      window.clearTimeout(reminderTimeoutRef.current)
      reminderTimeoutRef.current = null
    }

    if (
      !isLoaded ||
      !state.settings.hasSeenPrivacyModal ||
      editorTransactionId !== null ||
      activeTab === 'settings' ||
      isBackupReminderVisible ||
      hasShownBackupReminderInSession.current ||
      !backupReminderDecision.shouldShow
    ) {
      return
    }

    reminderTimeoutRef.current = window.setTimeout(() => {
      hasShownBackupReminderInSession.current = true
      setIsBackupReminderVisible(true)
      updateBackupSettings({ lastReminderAt: new Date().toISOString() })
      reminderTimeoutRef.current = null
    }, 720)

    return () => {
      if (reminderTimeoutRef.current !== null) {
        window.clearTimeout(reminderTimeoutRef.current)
        reminderTimeoutRef.current = null
      }
    }
  }, [
    activeTab,
    backupReminderDecision.shouldShow,
    editorTransactionId,
    isBackupReminderVisible,
    isLoaded,
    state.settings.hasSeenPrivacyModal,
    updateBackupSettings,
  ])

  const handleCreateTransaction = (
    input: AddTransactionInput,
    recurrence: TransactionRecurrenceInput | null,
  ) => {
    if (!recurrence) {
      addTransaction(input)
      showToast('Saved')
      return
    }

    const firstOccurrenceIsCurrentTransaction = recurrence.startDate === input.occurredAt
    const recurringTemplateId = addRecurringTemplate({
      type: input.type,
      amount: input.amount,
      categoryId: input.categoryId,
      note: input.note,
      frequency: recurrence.frequency,
      intervalDays: recurrence.intervalDays,
      startDate: recurrence.startDate,
      nextDueDate: firstOccurrenceIsCurrentTransaction
        ? getNextRecurringDate(
            {
              frequency: recurrence.frequency,
              intervalDays: recurrence.intervalDays,
              startDate: recurrence.startDate,
            },
            recurrence.startDate,
          )
        : recurrence.startDate,
    })

    addTransaction({
      ...input,
      recurringTemplateId:
        firstOccurrenceIsCurrentTransaction && recurringTemplateId
          ? recurringTemplateId
          : null,
      recurringOccurrenceDate:
        firstOccurrenceIsCurrentTransaction && recurringTemplateId
          ? recurrence.startDate
          : null,
    })
    showToast(recurringTemplateId ? 'Saved with recurring' : 'Saved')
  }

  const handleUpdateTransaction = (input: UpdateTransactionInput) => {
    updateTransaction(input)
    showToast('Saved')
  }

  const handleDeleteTransaction = (transactionId: string) => {
    deleteTransaction(transactionId)
    showToast('Deleted')
  }

  const showPrivacyModal = isLoaded && !state.settings.hasSeenPrivacyModal
  const showBackupReminder =
    isLoaded &&
    !showPrivacyModal &&
    activeTab !== 'settings' &&
    editorTransactionId === null &&
    isBackupReminderVisible &&
    state.settings.backupRemindersEnabled

  return (
    <div className="app-shell">
      <div className="backdrop glow-1" aria-hidden="true" />
      <div className="backdrop glow-2" aria-hidden="true" />

      <AppHeader
        key={activeTab}
        title={activeMeta.title}
        subtitle={activeMeta.subtitle}
        variant={headerVariant}
      />

      <main className="app-main">
        {showBackupReminder ? (
          <BackupReminderCard
            body={backupReminderBody}
            onCreateBackup={async () => {
              await createBackup()
            }}
            onLater={() => {
              setIsBackupReminderVisible(false)
            }}
          />
        ) : null}

        {isLoaded ? (
          <AppScreenResolver
            activeTab={activeTab}
            canInstall={canInstall}
            isInstalled={isInstalled}
            onCreateBackup={() => createBackup()}
            onInstall={() => {
              void install()
            }}
            onNavigate={handleTabChange}
            onEditTransaction={openTransactionEditor}
            onEditRecurring={openRecurringEditor}
            onShowToast={showToast}
          />
        ) : (
          <section className="panel loading-panel">
            <p className="eyebrow">LOADING</p>
            <h2>Opening your offline ledger...</h2>
            <p>IndexedDB data and your saved preferences are being restored.</p>
          </section>
        )}
      </main>

      {isLoaded ? (
        <button type="button" className="floating-add-button" onClick={openQuickAdd}>
          <span className="floating-add-icon" aria-hidden="true">
            +
          </span>
          <span>Add</span>
        </button>
      ) : null}

      {editorTransactionId === 'create' || editingTransaction ? (
        <TransactionEditorSheet
          key={editorTransactionId}
          mode={editorTransactionId === 'create' ? 'create' : 'edit'}
          categories={state.categories}
          initialTransaction={editingTransaction}
          recurringTemplate={
            editingTransaction?.recurringTemplateId
              ? state.recurringTemplates.find(
                  (template) => template.id === editingTransaction.recurringTemplateId,
                ) ?? null
              : null
          }
          onClose={closeEditor}
          onCreate={handleCreateTransaction}
          onUpdate={handleUpdateTransaction}
          onDelete={handleDeleteTransaction}
          onEditFutureRecurring={openRecurringEditor}
          onStopRecurring={(templateId) => {
            stopRecurringTemplate(templateId)
            showToast('Recurring stopped.')
          }}
        />
      ) : null}

      {editingRecurringTemplate ? (
        <RecurringEditorSheet
          key={editingRecurringTemplate.id}
          templateId={editingRecurringTemplate.id}
          onClose={closeRecurringEditor}
          onShowToast={showToast}
        />
      ) : null}

      {toast ? (
        <div key={toast.id} className="app-toast" role="status" aria-live="polite">
          {toast.message}
        </div>
      ) : null}

      {showPrivacyModal ? (
        <PrivacyFirstModal
          initialRemindersEnabled={state.settings.backupRemindersEnabled}
          onContinue={handleContinuePrivacyModal}
        />
      ) : null}

      <TabBar activeTab={activeTab} onChange={handleTabChange} />
    </div>
  )
}

function App() {
  return (
    <FinanceProvider>
      <FinanceWorkspace />
    </FinanceProvider>
  )
}

export default App
