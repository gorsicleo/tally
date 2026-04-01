import { useEffect, useRef, useState } from 'react'

interface ReportBugDialogProps {
  appVersion: string | null
  onCancel: () => void
  onCopyAppInfo: () => Promise<void>
  onOpenGithubIssue: () => Promise<void>
}

export function ReportBugDialog({
  appVersion,
  onCancel,
  onCopyAppInfo,
  onOpenGithubIssue,
}: ReportBugDialogProps) {
  const [isCopying, setIsCopying] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const openingLockRef = useRef(false)
  const resetTimeoutRef = useRef<number | null>(null)
  const isMountedRef = useRef(true)
  const busyRef = useRef(false)

  useEffect(() => {
    busyRef.current = isCopying || isOpening
  }, [isCopying, isOpening])

  const handleCancel = () => {
    if (isCopying || isOpening) {
      return
    }

    onCancel()
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      isMountedRef.current = false

      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current)
      }

      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel])

  const handleCopy = async () => {
    if (isCopying || isOpening) {
      return
    }

    busyRef.current = true
    setIsCopying(true)

    try {
      await onCopyAppInfo()
    } finally {
      if (isMountedRef.current) {
        setIsCopying(false)
      }
      busyRef.current = false
    }
  }

  const handleOpenIssue = async () => {
    if (isCopying || isOpening || openingLockRef.current) {
      return
    }

    busyRef.current = true
    openingLockRef.current = true
    setIsOpening(true)

    try {
      await onOpenGithubIssue()
    } finally {
      if (!isMountedRef.current) {
        openingLockRef.current = false
        busyRef.current = false
      } else {
        resetTimeoutRef.current = window.setTimeout(() => {
          openingLockRef.current = false
          busyRef.current = false

          if (isMountedRef.current) {
            setIsOpening(false)
          }

          resetTimeoutRef.current = null
        }, 250)
      }
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={handleCancel}>
      <section
        className="panel modal-panel report-bug-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-bug-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">HELP</p>
        <h3 id="report-bug-title">Report a bug</h3>

        <div className="report-bug-copy">
          <p>
            Bug reports are filed on GitHub. You can copy app details first to make
            reporting easier.
          </p>
          {appVersion ? (
            <p className="support-copy">App version: {appVersion}</p>
          ) : null}
        </div>

        <div className="backup-modal-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              void handleCopy()
            }}
            disabled={isCopying || isOpening}
          >
            {isCopying ? 'Copying...' : 'Copy app info'}
          </button>

          <button
            type="button"
            className="submit-button"
            onClick={() => {
              void handleOpenIssue()
            }}
            disabled={isCopying || isOpening}
          >
            {isOpening ? 'Opening...' : 'Open GitHub issue'}
          </button>

          <button
            type="button"
            className="ghost-button"
            onClick={handleCancel}
            disabled={isCopying || isOpening}
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  )
}
