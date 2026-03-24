import type { FinanceState } from '../domain/models'
import { parsePersistedFinanceState } from '../domain/validation'
import {
  BACKUP_APP_NAME,
  BACKUP_SCHEMA_VERSION,
  type BackupParseResult,
  type PreparedBackupRestoreResult,
  type TallyBackupPayload,
} from './backup-models'

type SupportedBackupSchemaVersion = 1 | typeof BACKUP_SCHEMA_VERSION

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
    recurringTemplates: cloneItems(payload.data.recurringTemplates),
    settings: {
      ...payload.data.preferences,
      lastBackupAt: payload.data.preferences.lastBackupAt ?? payload.exportedAt,
      changesSinceBackup: 0,
      lastReminderAt: null,
    },
  }
}

function isSupportedBackupSchemaVersion(
  value: unknown,
): value is SupportedBackupSchemaVersion {
  return value === 1 || value === BACKUP_SCHEMA_VERSION
}

export function validateBackupPayload(value: unknown): BackupParseResult {
  if (!isRecord(value)) {
    return { ok: false, message: 'This backup file is not valid.' }
  }

  if (!isSupportedBackupSchemaVersion(value.schemaVersion)) {
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

  if (
    value.schemaVersion === BACKUP_SCHEMA_VERSION &&
    !Array.isArray(value.data.recurringTemplates)
  ) {
    return { ok: false, message: 'This backup file is not valid.' }
  }

  const candidateState = parsePersistedFinanceState({
    categories: value.data.categories,
    transactions: value.data.transactions,
    budgets: value.data.budgets,
    recurringTemplates:
      value.schemaVersion === BACKUP_SCHEMA_VERSION
        ? value.data.recurringTemplates
        : [],
    settings: value.data.preferences,
  })

  if (!candidateState) {
    return { ok: false, message: 'This backup file is not valid.' }
  }

  const payload: TallyBackupPayload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: value.exportedAt,
    app: BACKUP_APP_NAME,
    data: {
      transactions: cloneItems(candidateState.transactions),
      categories: cloneItems(candidateState.categories),
      budgets: cloneItems(candidateState.budgets),
      recurringTemplates: cloneItems(candidateState.recurringTemplates),
      preferences: { ...candidateState.settings },
    },
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