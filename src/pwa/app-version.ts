export type AppUpdateSeverity =
  | 'minor'
  | 'recommended-backup'
  | 'backup-required'

export interface AppVersionInfo {
  version: string
  changelog: string[]
  severity: AppUpdateSeverity
}

function normalizeChangelog(entries: readonly string[]): string[] {
  return entries
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

export function getCurrentAppVersionInfo(): AppVersionInfo {
  return {
    version: __APP_VERSION__,
    changelog: normalizeChangelog(__APP_CHANGELOG__),
    severity: __APP_UPDATE_SEVERITY__,
  }
}
