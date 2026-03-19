import { useState } from 'react'

interface PrivacyFirstModalProps {
  initialRemindersEnabled: boolean
  onContinue: (remindersEnabled: boolean) => Promise<void> | void
  onCreateBackup: (remindersEnabled: boolean) => Promise<void> | void
}

interface BackupReminderCardProps {
  body: string
  onCreateBackup: () => Promise<void> | void
  onLater: () => void
}

interface RestoreBackupDialogProps {
  fileName: string
  exportedAtLabel: string
  onCancel: () => void
  onConfirm: () => Promise<void> | void
}

export function PrivacyFirstModal({
  initialRemindersEnabled,
  onContinue,
  onCreateBackup,
}: PrivacyFirstModalProps) {
  const [remindersEnabled, setRemindersEnabled] = useState(initialRemindersEnabled)
  const [isBusy, setIsBusy] = useState(false)

  const runAction = async (
    action: (reminders: boolean) => Promise<void> | void,
  ) => {
    setIsBusy(true)

    try {
      await action(remindersEnabled)
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="panel modal-panel backup-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-first-title"
      >
        <p className="eyebrow">PRIVATE</p>
        <h2 id="privacy-first-title">Private by default</h2>

        <div className="backup-modal-copy">
          <p>
            Your records are stored only on this device and do not leave it unless
            you export a backup.
          </p>
          <p>Create backups regularly to protect your data.</p>
          <p>Clearing browser or app data can remove the records kept here.</p>
        </div>

        <label className="backup-checkbox-row">
          <input
            type="checkbox"
            checked={remindersEnabled}
            onChange={(event) => setRemindersEnabled(event.target.checked)}
          />
          <span>Remind me to create backups</span>
        </label>

        <div className="backup-modal-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              void runAction(onCreateBackup)
            }}
            disabled={isBusy}
          >
            Create first backup
          </button>

          <button
            type="button"
            className="submit-button"
            onClick={() => {
              void runAction(onContinue)
            }}
            disabled={isBusy}
          >
            {isBusy ? 'Working...' : 'Continue'}
          </button>
        </div>
      </section>
    </div>
  )
}

export function BackupReminderCard({
  body,
  onCreateBackup,
  onLater,
}: BackupReminderCardProps) {
  const [isBusy, setIsBusy] = useState(false)

  const handleCreateBackup = async () => {
    setIsBusy(true)

    try {
      await onCreateBackup()
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <section className="panel backup-reminder-card" aria-label="Backup reminder">
      <div className="backup-reminder-copy">
        <p className="eyebrow">REMINDER</p>
        <h3>Backup reminder</h3>
        <p>{body}</p>
      </div>

      <div className="backup-reminder-actions">
        <button
          type="button"
          className="ghost-button compact"
          onClick={onLater}
          disabled={isBusy}
        >
          Later
        </button>
        <button
          type="button"
          className="submit-button compact"
          onClick={() => {
            void handleCreateBackup()
          }}
          disabled={isBusy}
        >
          {isBusy ? 'Working...' : 'Create backup'}
        </button>
      </div>
    </section>
  )
}

export function RestoreBackupDialog({
  fileName,
  exportedAtLabel,
  onCancel,
  onConfirm,
}: RestoreBackupDialogProps) {
  const [isBusy, setIsBusy] = useState(false)

  const handleConfirm = async () => {
    setIsBusy(true)

    try {
      await onConfirm()
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="panel modal-panel backup-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-backup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">BACKUP</p>
        <h3 id="restore-backup-title">Restore backup?</h3>

        <div className="backup-modal-copy">
          <p>Restoring a backup will replace your current local data on this device.</p>
          <p>
            <strong>{fileName}</strong>
            <span className="backup-modal-meta">Exported {exportedAtLabel}</span>
          </p>
        </div>

        <div className="backup-modal-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </button>

          <button
            type="button"
            className="submit-button"
            onClick={() => {
              void handleConfirm()
            }}
            disabled={isBusy}
          >
            {isBusy ? 'Restoring...' : 'Restore'}
          </button>
        </div>
      </section>
    </div>
  )
}