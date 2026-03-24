export type TransactionType = 'income' | 'expense'
export type ThemeMode = 'dark' | 'light' | 'auto'
export type CategoryKind = TransactionType | 'both'
export type RecurringFrequency = 'monthly' | 'custom'
export type CategorySystem = 'uncategorized' | null

export interface BackupPreferences {
  hasSeenPrivacyModal: boolean
  backupRemindersEnabled: boolean
  lastBackupAt: string | null
  backupReminderBaselineAt: string | null
  changesSinceBackup: number
  lastReminderAt: string | null
}

export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}

export interface Category extends BaseEntity {
  name: string
  color: string
  kind: CategoryKind
  system: CategorySystem
}

export interface Transaction extends BaseEntity {
  id: string
  type: TransactionType
  amount: number
  categoryId: string
  note: string
  occurredAt: string
  recurringTemplateId: string | null
  recurringOccurrenceDate: string | null
}

export interface Budget extends BaseEntity {
  name: string
  categoryIds: string[]
  monthKey: string
  limit: number
}

export interface RecurringTemplate extends BaseEntity {
  type: TransactionType
  amount: number
  categoryId: string
  note: string
  frequency: RecurringFrequency
  intervalDays: number | null
  startDate: string
  nextDueDate: string
  active: boolean
}

export interface AppSettings extends BackupPreferences {
  theme: ThemeMode
  currency: string
}

export interface FinanceState {
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  recurringTemplates: RecurringTemplate[]
  settings: AppSettings
}
