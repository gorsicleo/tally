import { useEffect, useMemo, useState } from 'react'
import { useServiceWorkerUpdate } from '../../pwa/use-service-worker-update'
import {
  MAX_CHANGELOG_ITEMS,
  getUpdateDisplayInfo,
  getUpdateSeverityDecision,
} from '../../pwa/update-prompt-state'

interface UpdateManagerProps {
  onCreateBackup: () => Promise<boolean>
}

type UpdateFlowStep = 'prompt' | 'confirm-recommended' | 'require-backup'

export function UpdateManager({ onCreateBackup }: UpdateManagerProps) {
  const {
    availableVersionInfo,
    isApplyingUpdate,
    isIosStandalone,
    needsReload,
    promptVisible,
    applyUpdate,
    dismiss,
  } = useServiceWorkerUpdate()
  const [step, setStep] = useState<UpdateFlowStep>('prompt')
  const [hasCompletedRequiredBackup, setHasCompletedRequiredBackup] =
    useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isChangelogExpanded, setIsChangelogExpanded] = useState(false)

  const versionKey = availableVersionInfo?.version ?? 'no-update'

  useEffect(() => {
    setStep('prompt')
    setHasCompletedRequiredBackup(false)
    setIsBackingUp(false)
    setIsChangelogExpanded(false)
  }, [versionKey])

  const changelog = useMemo(() => {
    if (!Array.isArray(availableVersionInfo?.changelog)) {
      return []
    }

    return availableVersionInfo.changelog
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  }, [availableVersionInfo])
  const visibleChangelog = useMemo(
    () =>
      isChangelogExpanded
        ? changelog
        : changelog.slice(0, MAX_CHANGELOG_ITEMS),
    [changelog, isChangelogExpanded],
  )
  const canExpandChangelog = useMemo(
    () => changelog.length > MAX_CHANGELOG_ITEMS,
    [changelog],
  )

  if (!promptVisible || !availableVersionInfo) {
    return null
  }

  const handleCreateBackup = async () => {
    setIsBackingUp(true)

    try {
      const didCreateBackup = await onCreateBackup()

      if (didCreateBackup) {
        setHasCompletedRequiredBackup(true)
      }
    } finally {
      setIsBackingUp(false)
    }
  }

  const displayInfo = getUpdateDisplayInfo(availableVersionInfo)
  const severityDecision = getUpdateSeverityDecision(displayInfo.severity)
  const updateLabel = needsReload ? 'Reload' : 'Update'

  const handlePrimaryAction = () => {
    if (needsReload) {
      if (severityDecision.requiresBackup && !hasCompletedRequiredBackup) {
        setStep('require-backup')
        return
      }

      void applyUpdate()
      return
    }

    if (!severityDecision.requiresWarningStep) {
      void applyUpdate()
      return
    }

    if (!severityDecision.requiresBackup) {
      setStep('confirm-recommended')
      return
    }

    setStep('require-backup')
  }

  const handleDismiss = () => {
    setStep('prompt')
    dismiss()
  }

  const renderPromptBody = () => {
    if (step === 'confirm-recommended') {
      return (
        <>
          <div className="backup-modal-copy">
            <p>We recommend backing up your data before updating.</p>
            <p>You can continue without a backup, but a fresh backup is safer before larger app changes.</p>
          </div>

          <div className="backup-modal-actions update-modal-actions">
            <button type="button" className="ghost-button" onClick={handleDismiss}>
              Later
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                void handleCreateBackup()
              }}
              disabled={isBackingUp || isApplyingUpdate}
            >
              {isBackingUp ? 'Creating backup...' : 'Create backup'}
            </button>
            <button
              type="button"
              className="submit-button"
              onClick={() => {
                void applyUpdate()
              }}
              disabled={isApplyingUpdate}
            >
              {isApplyingUpdate ? 'Updating...' : hasCompletedRequiredBackup ? 'Update now' : 'Update anyway'}
            </button>
          </div>
        </>
      )
    }

    if (step === 'require-backup') {
      return (
        <>
          <div className="backup-modal-copy">
            <p><strong>Backup required before updating.</strong></p>
            <p>Create a local backup first, then finish installing the new version.</p>
          </div>

          <div className="backup-modal-actions update-modal-actions">
            <button type="button" className="ghost-button" onClick={handleDismiss}>
              Later
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                void handleCreateBackup()
              }}
              disabled={isBackingUp || isApplyingUpdate}
            >
              {isBackingUp ? 'Creating backup...' : 'Create backup'}
            </button>
            <button
              type="button"
              className="submit-button"
              onClick={() => {
                void applyUpdate()
              }}
              disabled={!hasCompletedRequiredBackup || isApplyingUpdate}
            >
              {isApplyingUpdate ? 'Updating...' : updateLabel}
            </button>
          </div>
        </>
      )
    }

    return (
      <>
        <div className="backup-modal-copy">
          <p>
            {needsReload
              ? 'A newer version is active and this tab can reload when you are ready.'
              : 'A newer version of Tally is ready to install on this device.'}
          </p>
          {displayInfo.version ? (
            <p className="support-copy">Version {displayInfo.version}</p>
          ) : null}
          {changelog.length > 0 ? (
            <div className="update-changelog-block">
              <div
                id="update-changelog-region"
                className="update-changelog-scroll"
                data-expanded={isChangelogExpanded}
              >
                <ul className="update-changelog-list">
                  {visibleChangelog.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </div>
              {canExpandChangelog ? (
                <button
                  type="button"
                  className="text-button update-changelog-toggle"
                  aria-controls="update-changelog-region"
                  aria-expanded={isChangelogExpanded}
                  onClick={() => {
                    setIsChangelogExpanded((current) => !current)
                  }}
                >
                  {isChangelogExpanded ? 'Show less' : 'Show more'}
                </button>
              ) : null}
            </div>
          ) : null}
          {severityDecision.requiresWarningStep && !needsReload ? (
            <p className="support-copy">
              {!severityDecision.requiresBackup
                ? 'This release is safer with a fresh backup.'
                : 'This release requires a backup before installing.'}
            </p>
          ) : null}
          {isIosStandalone ? (
            <p className="support-copy">
              Installed iPhone and iPad apps can apply updates later than Safari. If the version does not change immediately, close and reopen the app.
            </p>
          ) : null}
        </div>

        <div className="backup-modal-actions update-modal-actions">
          <button type="button" className="ghost-button" onClick={handleDismiss}>
            Later
          </button>
          <button
            type="button"
            className="submit-button"
            onClick={handlePrimaryAction}
            disabled={isApplyingUpdate}
          >
            {isApplyingUpdate ? 'Updating...' : updateLabel}
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="panel modal-panel backup-modal-panel update-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-available-title"
      >
        <p className="eyebrow">UPDATE</p>
        <h2 id="update-available-title">Update available</h2>
        {renderPromptBody()}
      </section>
    </div>
  )
}
