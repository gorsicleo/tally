import type { AppUpdateSeverity, AppVersionInfo } from './app-version'

export const MAX_CHANGELOG_ITEMS = 3

export interface UpdateDisplayInfo {
  version: string | null
  changelog: string[]
  severity: AppUpdateSeverity
}

export interface UpdateSeverityDecision {
  requiresBackup: boolean
  allowsProceedWithoutBackup: boolean
  requiresWarningStep: boolean
}

export function normalizeUpdateSeverity(value: unknown): AppUpdateSeverity {
  if (
    value === 'minor' ||
    value === 'recommended-backup' ||
    value === 'backup-required'
  ) {
    return value
  }

  return 'recommended-backup'
}

export function getCondensedChangelog(changelog: unknown): string[] {
  if (!Array.isArray(changelog)) {
    return []
  }

  return changelog
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, MAX_CHANGELOG_ITEMS)
}

export function getUpdateSeverityDecision(
  severity: unknown,
): UpdateSeverityDecision {
  const normalizedSeverity = normalizeUpdateSeverity(severity)

  if (normalizedSeverity === 'minor') {
    return {
      requiresBackup: false,
      allowsProceedWithoutBackup: true,
      requiresWarningStep: false,
    }
  }

  if (normalizedSeverity === 'recommended-backup') {
    return {
      requiresBackup: false,
      allowsProceedWithoutBackup: true,
      requiresWarningStep: true,
    }
  }

  return {
    requiresBackup: true,
    allowsProceedWithoutBackup: false,
    requiresWarningStep: true,
  }
}

export function getUpdateDisplayInfo(
  versionInfo: Partial<AppVersionInfo> | null | undefined,
): UpdateDisplayInfo {
  return {
    version:
      typeof versionInfo?.version === 'string' && versionInfo.version.trim().length > 0
        ? versionInfo.version.trim()
        : null,
    changelog: getCondensedChangelog(versionInfo?.changelog),
    severity: normalizeUpdateSeverity(versionInfo?.severity),
  }
}
