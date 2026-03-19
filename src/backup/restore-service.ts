import type { FinanceState } from '../domain/models'
import { isFinanceState } from '../domain/validation'
import {
  BACKUP_APP_NAME,
  BACKUP_SCHEMA_VERSION,
  type BackupParseResult,
  type PreparedBackupRestoreResult,
  type TallyBackupPayload,
} from './backup-models'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function cloneItems<T extends object>(items: T[]): T[] {
  return items.map((item) => ({ ...item }))
}

function buildRestoredState(payload: TallyBackupPayload): FinanceState {
  return {
    categories: cloneItems(payload.data.categories),
    transactions: cloneItems(payload.data.transactions),
    budgets: cloneItems(payload.data.budgets),
    syncQueue: [],
    settings: {
      ...payload.data.preferences,
      lastBackupAt: payload.data.preferences.lastBackupAt ?? payload.exportedAt,
      changesSinceBackup: 0,
      lastReminderAt: null,
    },
    lastSyncedAt: null,
    lastSyncAttemptAt: null,
    lastSyncError: null,
  }
}

export function validateBackupPayload(value: unknown): BackupParseResult {
  if (!isRecord(value)) {
    return { ok: false, message: 'This backup file is not valid.' }
  }

  if (value.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      message: 'This backup file uses an unsupported version.',
    }
  }

  if (value.app !== BACKUP_APP_NAME || !isIsoTimestamp(value.exportedAt) || !isRecord(value.data)) {
    return { ok: false, message: 'This backup file is not valid.' }
  }

  if (
    !Array.isArray(value.data.transactions) ||
    !Array.isArray(value.data.categories) ||
    !Array.isArray(value.data.budgets) ||
    !isRecord(value.data.preferences)
  ) {
    return { ok: false, message: 'This backup file is not valid.' }
  }

  const payload: TallyBackupPayload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: value.exportedAt,
    app: BACKUP_APP_NAME,
    data: {
      transactions: value.data.transactions,
      categories: value.data.categories,
      budgets: value.data.budgets,
      preferences:
        value.data.preferences as unknown as TallyBackupPayload['data']['preferences'],
    },
  }

  const candidateState = buildRestoredState(payload)

  if (!isFinanceState(candidateState)) {
    return { ok: false, message: 'This backup file is not valid.' }
  }

  return { ok: true, payload }
}

export function prepareBackupRestore(rawJson: string): PreparedBackupRestoreResult {
  let parsedJson: unknown

  try {
    parsedJson = JSON.parse(rawJson)
  } catch {
    return { ok: false, message: 'This backup file is not valid.' }
  }

  const validationResult = validateBackupPayload(parsedJson)

  if (!validationResult.ok) {
    return validationResult
  }

  return {
    ok: true,
    prepared: {
      payload: validationResult.payload,
      nextState: buildRestoredState(validationResult.payload),
    },
  }
}

export async function prepareBackupRestoreFile(
  file: File,
): Promise<PreparedBackupRestoreResult> {
  try {
    return prepareBackupRestore(await file.text())
  } catch {
    return { ok: false, message: 'This backup file is not valid.' }
  }
}