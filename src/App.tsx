import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  downloadBackupFile,
} from './backup/backup-service'
import {
  evaluateBackupReminder,
  getBackupReminderBody,
} from './backup/backup-reminder-service'
import { formatMonthLabel } from './domain/formatters'
import { getMonthKey, getSyncSummary } from './domain/selectors'
import {
  BackupReminderCard,
  PrivacyFirstModal,
} from './features/backup/backup-ui'
import { BudgetsScreen } from './features/budgets/budgets-screen'
import { HomeScreen } from './features/home/home-screen'
import { InsightsScreen } from './features/insights/insights-screen'
import { useInstallPrompt } from './pwa/register-service-worker'
import { AppHeader } from './features/shell/app-header'
import { TabBar, type AppTab } from './features/shell/tab-bar'
import { SettingsScreen } from './features/settings/settings-screen'
import { TransactionEditorSheet } from './features/transactions/transaction-editor-sheet'
import { TransactionsScreen } from './features/transactions/transactions-screen'
import { FinanceProvider } from './state/finance-context'
import { useFinance } from './state/use-finance'
import type { BackupPreferences, Transaction } from './domain/models'
import type { AddTransactionInput, UpdateTransactionInput } from './state/finance-store'

const tabMeta: Record<AppTab, { title: string; subtitle: string }> = {
  home: {
    title: 'This month, at a glance',
    subtitle: 'See where you stand now and record the next spend.',
  },
  transactions: {
    title: 'Records',
    subtitle: 'Search, filter, and edit your history.',
  },
  insights: {
    title: 'Insights',
    subtitle: 'Understand spending with breakdowns and trend views.',
  },
  budgets: {
    title: 'Budgets',
    subtitle: 'Use category budgets as your guardrails.',
  },
  settings: {
    title: 'App settings',
    subtitle: 'Manage sync, categories, theme, currency, and more.',
  },
}

function FinanceWorkspace() {
  const {
    state,
    isLoaded,
    isOnline,
    isSyncing,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    updateBackupSettings,
  } = useFinance()
  const { canInstall, install, isInstalled } = useInstallPrompt()
  const [activeTab, setActiveTab] = useState<AppTab>('home')
  const [editorTransactionId, setEditorTransactionId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const [isBackupReminderVisible, setIsBackupReminderVisible] = useState(false)
  const toastTimeoutRef = useRef<number | null>(null)
  const reminderTimeoutRef = useRef<number | null>(null)
  const hasShownBackupReminderInSession = useRef(false)
  const syncSummary = useMemo(() => getSyncSummary(state), [state])
  const currentMonthLabel = useMemo(() => formatMonthLabel(getMonthKey()), [])
  const backupReminderDecision = useMemo(
    () => evaluateBackupReminder(state),
    [state],
  )
  const backupReminderBody = useMemo(
    () => getBackupReminderBody(state.settings.lastBackupAt),
    [state.settings.lastBackupAt],
  )

  const syncLabel = isSyncing
    ? 'Syncing'
    : !isOnline
      ? syncSummary.pending > 0
        ? `${syncSummary.pending} queued offline`
        : 'Offline'
      : syncSummary.failed > 0
        ? `${syncSummary.failed} failed`
        : syncSummary.pending > 0
          ? `${syncSummary.pending} pending`
          : 'Synced'

  const handleTabChange = (tab: AppTab) => {
    setActiveTab(tab)
  }

  const activeMeta =
    activeTab === 'insights' || activeTab === 'budgets'
      ? { title: tabMeta[activeTab].title, subtitle: currentMonthLabel }
      : activeTab === 'settings'
        ? { title: 'Settings', subtitle: 'General, data, sync, and advanced options' }
      : tabMeta[activeTab]
  const headerStatusMode = activeTab === 'settings' ? 'full' : !isOnline ? 'offline-only' : 'hidden'
  const headerVariant =
    activeTab === 'insights' || activeTab === 'budgets' || activeTab === 'settings'
      ? 'compact'
      : 'default'
  const editingTransaction = editorTransactionId
    ? state.transactions.find((transaction) => transaction.id === editorTransactionId) ?? null
    : null

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

  const handleCreateFirstBackup = useCallback(
    async (remindersEnabled: boolean) => {
      await createBackup({
        hasSeenPrivacyModal: true,
        backupRemindersEnabled: remindersEnabled,
      })
    },
    [createBackup],
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

  const handleCreateTransaction = (input: AddTransactionInput) => {
    addTransaction(input)
    showToast('Saved')
  }

  const handleUpdateTransaction = (input: UpdateTransactionInput) => {
    updateTransaction(input)
    showToast('Saved')
  }

  const handleDeleteTransaction = (transactionId: string) => {
    deleteTransaction(transactionId)
    showToast('Deleted')
  }

  const openQuickAdd = () => {
    setEditorTransactionId('create')
  }

  const openTransactionEditor = (transaction: Transaction) => {
    setEditorTransactionId(transaction.id)
  }

  const closeEditor = () => {
    setEditorTransactionId(null)
  }

  const showPrivacyModal = isLoaded && !state.settings.hasSeenPrivacyModal
  const showBackupReminder =
    isLoaded &&
    !showPrivacyModal &&
    activeTab !== 'settings' &&
    editorTransactionId === null &&
    isBackupReminderVisible &&
    state.settings.backupRemindersEnabled

  let screen = (
    <HomeScreen
      onNavigate={handleTabChange}
      onEditTransaction={openTransactionEditor}
    />
  )

  if (activeTab === 'transactions') {
    screen = <TransactionsScreen onEditTransaction={openTransactionEditor} />
  }

  if (activeTab === 'insights') {
    screen = <InsightsScreen />
  }

  if (activeTab === 'budgets') {
    screen = <BudgetsScreen />
  }

  if (activeTab === 'settings') {
    screen = (
      <SettingsScreen
        canInstall={canInstall}
        isInstalled={isInstalled}
        onCreateBackup={() => createBackup()}
        onInstall={() => {
          void install()
        }}
        onShowToast={showToast}
      />
    )
  }

  return (
    <div className="app-shell">
      <div className="backdrop glow-1" aria-hidden="true" />
      <div className="backdrop glow-2" aria-hidden="true" />

      <AppHeader
        key={activeTab}
        title={activeMeta.title}
        subtitle={activeMeta.subtitle}
        syncLabel={syncLabel}
        isOnline={isOnline}
        isSyncing={isSyncing}
        statusMode={headerStatusMode}
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
          screen
        ) : (
          <section className="panel loading-panel">
            <p className="eyebrow">LOADING</p>
            <h2>Opening your offline ledger...</h2>
            <p>IndexedDB data and sync metadata are being restored.</p>
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
          onClose={closeEditor}
          onCreate={handleCreateTransaction}
          onUpdate={handleUpdateTransaction}
          onDelete={handleDeleteTransaction}
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
          onCreateBackup={handleCreateFirstBackup}
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
