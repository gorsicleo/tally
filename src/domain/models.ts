export type TransactionType = 'income' | 'expense'
export type ThemeMode = 'dark' | 'light'
export type SyncStatus = 'synced' | 'pending' | 'failed'
export type CategoryKind = TransactionType | 'both'
export type SyncEntityType = 'transaction' | 'category' | 'budget'
export type SyncAction = 'upsert' | 'delete'
export type ConflictPolicy = 'client-wins'

export interface BackupPreferences {
  hasSeenPrivacyModal: boolean
  backupRemindersEnabled: boolean
  lastBackupAt: string | null
  changesSinceBackup: number
  lastReminderAt: string | null
}

export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
  syncStatus: SyncStatus
}

export interface Category extends BaseEntity {
  name: string
  color: string
  kind: CategoryKind
  isDefault: boolean
}

export interface Transaction extends BaseEntity {
  id: string
  type: TransactionType
  amount: number
  categoryId: string
  note: string
  occurredAt: string
}

export interface Budget extends BaseEntity {
  categoryId: string
  monthKey: string
  limit: number
}

export interface SyncQueueItem {
  id: string
  entityType: SyncEntityType
  action: SyncAction
  entityId: string
  payload: Category | Transaction | Budget | null
  queuedAt: string
  attempts: number
}

export interface AppSettings extends BackupPreferences {
  theme: ThemeMode
  currency: string
  syncEndpoint: string
  conflictPolicy: ConflictPolicy
}

export interface FinanceState {
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  syncQueue: SyncQueueItem[]
  settings: AppSettings
  lastSyncedAt: string | null
  lastSyncAttemptAt: string | null
  lastSyncError: string | null
}
