import type { BackupPreferences, FinanceState } from '../domain/models'
import { toLocalDateKey } from '../utils/date'
import { downloadTextFile } from '../utils/download'
import {
  BACKUP_APP_NAME,
  BACKUP_SCHEMA_VERSION,
  type TallyBackupPayload,
} from './backup-models'

export type BackupDownloadResult =
  | { ok: true; exportedAt: string; fileName: string }
  | { ok: false; message: string }

function cloneItems<T extends object>(items: T[]): T[] {
  return items.map((item) => ({ ...item }))
}

function buildExportSettings(
  state: FinanceState,
  exportedAt: string,
  settingsPatch: Partial<BackupPreferences>,
) {
  return {
    ...state.settings,
    ...settingsPatch,
    lastBackupAt: exportedAt,
    changesSinceBackup: 0,
    lastReminderAt: null,
  }
}

export function buildBackupPayload(
  state: FinanceState,
  exportedAt = new Date().toISOString(),
  settingsPatch: Partial<BackupPreferences> = {},
): TallyBackupPayload {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    app: BACKUP_APP_NAME,
    data: {
      transactions: cloneItems(state.transactions),
      categories: cloneItems(state.categories),
      budgets: cloneItems(state.budgets),
      preferences: buildExportSettings(state, exportedAt, settingsPatch),
    },
  }
}

export function serializeBackupPayload(payload: TallyBackupPayload): string {
  return JSON.stringify(payload, null, 2)
}

export function createBackupFileName(exportedAt: string): string {
  return `tally-backup-${toLocalDateKey(new Date(exportedAt))}.json`
}

export function downloadBackupFile(
  state: FinanceState,
  settingsPatch: Partial<BackupPreferences> = {},
): BackupDownloadResult {
  const exportedAt = new Date().toISOString()
  const payload = buildBackupPayload(state, exportedAt, settingsPatch)
  const fileName = createBackupFileName(exportedAt)

  try {
    downloadTextFile(
      fileName,
      serializeBackupPayload(payload),
      'application/json;charset=utf-8',
    )

    return {
      ok: true,
      exportedAt,
      fileName,
    }
  } catch {
    return {
      ok: false,
      message: 'Backup could not be downloaded.',
    }
  }
}