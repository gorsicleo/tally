export type TransactionType = 'income' | 'expense'
export type ThemeMode = 'dark' | 'light' | 'auto'
export type CategoryKind = TransactionType | 'both'
export type RecurringFrequency = 'monthly' | 'custom'
export type CategorySystem = 'uncategorized' | null
export type FinancialGoalType =
  | 'house'
  | 'car'
  | 'emergencyFund'
  | 'vacation'
  | 'education'
  | 'custom'
export type FinancialGoalPriority = 'low' | 'medium' | 'high'
export type FinancialGoalStatus = 'active' | 'archived'

export interface AppLockPinVerifier {
  version: 1
  algorithm: 'PBKDF2'
  hash: 'SHA-256'
  iterations: number
  saltHex: string
  verifierHex: string
}

export type DeviceAuthTransport = 'usb' | 'nfc' | 'ble' | 'internal' | 'hybrid'

export interface DeviceAuthCredential {
  version: 1
  credentialId: string
  createdAt: string
  transports?: readonly DeviceAuthTransport[]
}

export interface RecoveryCodeVerifier {
  id: string
  verifierHex: string
  usedAt: string | null
}

export interface RecoveryCodeSet {
  version: 1
  hash: 'SHA-256'
  saltHex: string
  generatedAt: string
  verifiers: RecoveryCodeVerifier[]
}

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
  recurring?: boolean
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

export interface FinancialGoal extends BaseEntity {
  name: string
  description: string
  type: FinancialGoalType
  targetAmount: number
  currentAmount: number
  targetDate: string | null
  priority: FinancialGoalPriority
  status: FinancialGoalStatus
}

export interface AppSettings extends BackupPreferences {
  theme: ThemeMode
  currency: string
  hideOverspendingBudgetsInHome?: boolean
  hideSensitiveData?: boolean
  lockAppOnLaunch?: boolean
  appLockPinVerifier?: AppLockPinVerifier | null
  deviceAuthCredential?: DeviceAuthCredential | null
  recoveryCodeSet?: RecoveryCodeSet | null
}

export interface FinanceState {
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  recurringTemplates: RecurringTemplate[]
  financialGoals: FinancialGoal[]
  settings: AppSettings
}
