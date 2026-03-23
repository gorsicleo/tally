import type { ChangeEvent, RefObject } from 'react'

interface BackupMessage {
  tone: 'default' | 'error'
  text: string
}

interface SettingsBackupSectionProps {
  lastBackupLabel: string
  backupRemindersEnabled: boolean
  backupMessage: BackupMessage | null
  importInputRef: RefObject<HTMLInputElement | null>
  onToggleBackupReminders: (enabled: boolean) => void
  onCreateBackup: () => void
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
}

export function SettingsBackupSection({
  lastBackupLabel,
  backupRemindersEnabled,
  backupMessage,
  importInputRef,
  onToggleBackupReminders,
  onCreateBackup,
  onImport,
}: SettingsBackupSectionProps) {
  return (
    <div className="settings-group">
      <p className="settings-group-title">Backup &amp; Restore</p>

      <div className="settings-group-list">
        <div className="settings-list-row">
          <span className="settings-row-label">Last backup</span>
          <span className="settings-row-value">{lastBackupLabel}</span>
        </div>

        <div className="settings-list-row settings-backup-toggle-row">
          <div className="settings-row-copy">
            <span className="settings-row-label">Backup reminders</span>
            <span className="settings-row-caption">
              {backupRemindersEnabled ? 'On' : 'Off'}
            </span>
          </div>

          <div className="settings-inline-switch" role="group" aria-label="Backup reminders">
            <button
              type="button"
              className={backupRemindersEnabled ? 'active' : ''}
              onClick={() => {
                onToggleBackupReminders(true)
              }}
            >
              On
            </button>
            <button
              type="button"
              className={!backupRemindersEnabled ? 'active' : ''}
              onClick={() => {
                onToggleBackupReminders(false)
              }}
            >
              Off
            </button>
          </div>
        </div>
      </div>

      <div className="settings-backup-actions">
        <button
          type="button"
          className="submit-button compact"
          onClick={onCreateBackup}
        >
          Create backup
        </button>

        <button
          type="button"
          className="ghost-button compact"
          onClick={() => importInputRef.current?.click()}
        >
          Restore backup
        </button>
      </div>

      <input
        ref={importInputRef}
        className="settings-import-input"
        type="file"
        aria-label="Restore backup file"
        accept=".json,application/json"
        onChange={onImport}
      />

      <p className="support-copy settings-backup-help">
        Backup files contain sensitive financial data. Store them securely.
      </p>

      {backupMessage ? (
        <p className={backupMessage.tone === 'error' ? 'inline-error' : 'support-copy'}>
          {backupMessage.text}
        </p>
      ) : null}
    </div>
  )
}
