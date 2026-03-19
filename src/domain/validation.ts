import type {
  AppSettings,
  Budget,
  Category,
  CategoryKind,
  FinanceState,
  SyncQueueItem,
  SyncStatus,
  ThemeMode,
  Transaction,
  TransactionType,
} from './models'

const legacyBackupPreferenceDefaults = {
  hasSeenPrivacyModal: true,
  backupRemindersEnabled: true,
  lastBackupAt: null,
  changesSinceBackup: 0,
  lastReminderAt: null,
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0
}

function isTransactionType(value: unknown): value is TransactionType {
  return value === 'income' || value === 'expense'
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light'
}

function isSyncStatus(value: unknown): value is SyncStatus {
  return value === 'synced' || value === 'pending' || value === 'failed'
}

function isCategoryKind(value: unknown): value is CategoryKind {
  return value === 'income' || value === 'expense' || value === 'both'
}

function hasBaseEntityFields(value: unknown): value is {
  id: string
  createdAt: string
  updatedAt: string
  syncStatus: SyncStatus
} & Record<string, unknown> {
  if (!isRecord(value)) {
    return false
  }

  return (
    isString(value.id) &&
    isString(value.createdAt) &&
    isString(value.updatedAt) &&
    isSyncStatus(value.syncStatus)
  )
}

function isCategory(value: unknown): value is Category {
  if (!hasBaseEntityFields(value)) {
    return false
  }

  return (
    isString(value.name) &&
    isString(value.color) &&
    isCategoryKind(value.kind) &&
    typeof value.isDefault === 'boolean'
  )
}

function isTransaction(value: unknown): value is Transaction {
  if (!hasBaseEntityFields(value)) {
    return false
  }

  return (
    isTransactionType(value.type) &&
    isNumber(value.amount) &&
    isString(value.categoryId) &&
    isString(value.note) &&
    isString(value.occurredAt)
  )
}

function isBudget(value: unknown): value is Budget {
  if (!hasBaseEntityFields(value)) {
    return false
  }

  return (
    isString(value.categoryId) &&
    isString(value.monthKey) &&
    isNumber(value.limit) &&
    value.limit >= 0
  )
}

function isAppSettings(value: unknown): value is AppSettings {
  if (!isRecord(value)) {
    return false
  }

  return (
    isThemeMode(value.theme) &&
    isString(value.currency) &&
    value.currency.length === 3 &&
    isString(value.syncEndpoint) &&
    value.conflictPolicy === 'client-wins' &&
    typeof value.hasSeenPrivacyModal === 'boolean' &&
    typeof value.backupRemindersEnabled === 'boolean' &&
    (value.lastBackupAt === null || isString(value.lastBackupAt)) &&
    isNonNegativeNumber(value.changesSinceBackup) &&
    (value.lastReminderAt === null || isString(value.lastReminderAt))
  )
}

function parseAppSettings(
  value: unknown,
  useLegacyBackupDefaults: boolean,
): AppSettings | null {
  if (!isRecord(value)) {
    return null
  }

  if (
    !isThemeMode(value.theme) ||
    !isString(value.currency) ||
    value.currency.length !== 3 ||
    !isString(value.syncEndpoint) ||
    value.conflictPolicy !== 'client-wins'
  ) {
    return null
  }

  const hasSeenPrivacyModal =
    typeof value.hasSeenPrivacyModal === 'boolean'
      ? value.hasSeenPrivacyModal
      : useLegacyBackupDefaults
        ? legacyBackupPreferenceDefaults.hasSeenPrivacyModal
        : null
  const backupRemindersEnabled =
    typeof value.backupRemindersEnabled === 'boolean'
      ? value.backupRemindersEnabled
      : useLegacyBackupDefaults
        ? legacyBackupPreferenceDefaults.backupRemindersEnabled
        : null
  const lastBackupAt =
    value.lastBackupAt === null || isString(value.lastBackupAt)
      ? value.lastBackupAt
      : useLegacyBackupDefaults
        ? legacyBackupPreferenceDefaults.lastBackupAt
        : null
  const changesSinceBackup = isNonNegativeNumber(value.changesSinceBackup)
    ? value.changesSinceBackup
    : useLegacyBackupDefaults
      ? legacyBackupPreferenceDefaults.changesSinceBackup
      : null
  const lastReminderAt =
    value.lastReminderAt === null || isString(value.lastReminderAt)
      ? value.lastReminderAt
      : useLegacyBackupDefaults
        ? legacyBackupPreferenceDefaults.lastReminderAt
        : null

  if (
    hasSeenPrivacyModal === null ||
    backupRemindersEnabled === null ||
    changesSinceBackup === null
  ) {
    return null
  }

  return {
    theme: value.theme,
    currency: value.currency,
    syncEndpoint: value.syncEndpoint,
    conflictPolicy: value.conflictPolicy,
    hasSeenPrivacyModal,
    backupRemindersEnabled,
    lastBackupAt,
    changesSinceBackup,
    lastReminderAt,
  }
}

function isSyncQueueItem(value: unknown): value is SyncQueueItem {
  if (!isRecord(value)) {
    return false
  }

  const payloadIsValid =
    value.payload === null ||
    isCategory(value.payload) ||
    isTransaction(value.payload) ||
    isBudget(value.payload)

  return (
    isString(value.id) &&
    (value.entityType === 'transaction' ||
      value.entityType === 'category' ||
      value.entityType === 'budget') &&
    (value.action === 'upsert' || value.action === 'delete') &&
    isString(value.entityId) &&
    payloadIsValid &&
    isString(value.queuedAt) &&
    isNumber(value.attempts)
  )
}

export function isFinanceState(value: unknown): value is FinanceState {
  if (!isRecord(value)) {
    return false
  }

  return (
    Array.isArray(value.categories) &&
    value.categories.every(isCategory) &&
    Array.isArray(value.transactions) &&
    value.transactions.every(isTransaction) &&
    Array.isArray(value.budgets) &&
    value.budgets.every(isBudget) &&
    Array.isArray(value.syncQueue) &&
    value.syncQueue.every(isSyncQueueItem) &&
    isAppSettings(value.settings) &&
    (value.lastSyncedAt === null || isString(value.lastSyncedAt)) &&
    (value.lastSyncAttemptAt === null || isString(value.lastSyncAttemptAt)) &&
    (value.lastSyncError === null || isString(value.lastSyncError))
  )
}

export function parsePersistedFinanceState(value: unknown): FinanceState | null {
  if (!isRecord(value)) {
    return null
  }

  const settings = parseAppSettings(value.settings, true)

  if (!settings) {
    return null
  }

  if (
    !Array.isArray(value.categories) ||
    !value.categories.every(isCategory) ||
    !Array.isArray(value.transactions) ||
    !value.transactions.every(isTransaction) ||
    !Array.isArray(value.budgets) ||
    !value.budgets.every(isBudget) ||
    !Array.isArray(value.syncQueue) ||
    !value.syncQueue.every(isSyncQueueItem) ||
    !(value.lastSyncedAt === null || isString(value.lastSyncedAt)) ||
    !(value.lastSyncAttemptAt === null || isString(value.lastSyncAttemptAt)) ||
    !(value.lastSyncError === null || isString(value.lastSyncError))
  ) {
    return null
  }

  return {
    categories: value.categories,
    transactions: value.transactions,
    budgets: value.budgets,
    syncQueue: value.syncQueue,
    settings,
    lastSyncedAt: value.lastSyncedAt,
    lastSyncAttemptAt: value.lastSyncAttemptAt,
    lastSyncError: value.lastSyncError,
  }
}
