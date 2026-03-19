import type {
  AppSettings,
  Budget,
  Category,
  FinanceState,
  Transaction,
} from '../domain/models'

export const BACKUP_SCHEMA_VERSION = 1 as const
export const BACKUP_APP_NAME = 'Tally' as const

export interface BackupPayloadData {
  transactions: Transaction[]
  categories: Category[]
  budgets: Budget[]
  preferences: AppSettings
}

export interface TallyBackupPayload {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION
  exportedAt: string
  app: typeof BACKUP_APP_NAME
  data: BackupPayloadData
}

export interface PreparedBackupRestore {
  payload: TallyBackupPayload
  nextState: FinanceState
}

export type BackupParseResult =
  | { ok: true; payload: TallyBackupPayload }
  | { ok: false; message: string }

export type PreparedBackupRestoreResult =
  | { ok: true; prepared: PreparedBackupRestore }
  | { ok: false; message: string }