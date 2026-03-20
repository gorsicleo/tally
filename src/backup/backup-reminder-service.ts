import type {
  AppSettings,
  Budget,
  Category,
  RecurringTemplate,
  Transaction,
} from '../domain/models'
import { isSystemCategory } from '../domain/categories'

const DAY_IN_MS = 86_400_000
const HOUR_IN_MS = 3_600_000

export const BACKUP_REMINDER_STALE_DAYS = 7
export const BACKUP_REMINDER_CHANGE_THRESHOLD = 8
export const BACKUP_REMINDER_COOLDOWN_HOURS = 36

export type BackupReminderReason =
  | 'missing-backup'
  | 'stale-backup'
  | 'recent-changes'

interface BackupReminderStateLike {
  settings: Pick<
    AppSettings,
    | 'backupRemindersEnabled'
    | 'lastBackupAt'
    | 'changesSinceBackup'
    | 'lastReminderAt'
  >
  transactions: Transaction[]
  budgets: Budget[]
  categories: Category[]
  recurringTemplates: RecurringTemplate[]
}

export function hasMeaningfulBackupData(state: BackupReminderStateLike): boolean {
  return (
    state.transactions.length > 0 ||
    state.budgets.length > 0 ||
    state.categories.some((category) => !isSystemCategory(category)) ||
    state.recurringTemplates.length > 0
  )
}

function getTimestamp(value: string | null): number | null {
  if (!value) {
    return null
  }

  const timestamp = Date.parse(value)

  return Number.isNaN(timestamp) ? null : timestamp
}

export function evaluateBackupReminder(
  state: BackupReminderStateLike,
  now = new Date(),
): { shouldShow: boolean; reason: BackupReminderReason | null } {
  if (!state.settings.backupRemindersEnabled) {
    return { shouldShow: false, reason: null }
  }

  const nowTimestamp = now.getTime()
  const lastReminderTimestamp = getTimestamp(state.settings.lastReminderAt)

  if (
    lastReminderTimestamp !== null &&
    nowTimestamp - lastReminderTimestamp < BACKUP_REMINDER_COOLDOWN_HOURS * HOUR_IN_MS
  ) {
    return { shouldShow: false, reason: null }
  }

  if (!state.settings.lastBackupAt) {
    return hasMeaningfulBackupData(state)
      ? { shouldShow: true, reason: 'missing-backup' }
      : { shouldShow: false, reason: null }
  }

  const lastBackupTimestamp = getTimestamp(state.settings.lastBackupAt)

  if (
    lastBackupTimestamp !== null &&
    nowTimestamp - lastBackupTimestamp >= BACKUP_REMINDER_STALE_DAYS * DAY_IN_MS
  ) {
    return { shouldShow: true, reason: 'stale-backup' }
  }

  if (state.settings.changesSinceBackup >= BACKUP_REMINDER_CHANGE_THRESHOLD) {
    return { shouldShow: true, reason: 'recent-changes' }
  }

  return { shouldShow: false, reason: null }
}

export function formatBackupAge(lastBackupAt: string, now = new Date()): string {
  const elapsedMs = Math.max(0, now.getTime() - Date.parse(lastBackupAt))
  const elapsedDays = Math.floor(elapsedMs / DAY_IN_MS)

  if (elapsedDays <= 0) {
    return 'less than a day'
  }

  return `${elapsedDays} day${elapsedDays === 1 ? '' : 's'}`
}

export function getBackupReminderBody(
  lastBackupAt: string | null,
  now = new Date(),
): string {
  if (!lastBackupAt) {
    return 'You have not created a backup yet. A local backup helps protect the records kept on this device.'
  }

  return `Your last backup was ${formatBackupAge(lastBackupAt, now)} ago.`
}