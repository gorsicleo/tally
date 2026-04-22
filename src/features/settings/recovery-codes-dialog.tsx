import { useEffect, useState } from 'react'

interface RecoveryCodesDialogProps {
  codes: string[]
  onClose: () => void
}

export function RecoveryCodesDialog({ codes, onClose }: RecoveryCodesDialogProps) {
  const [isConfirmed, setIsConfirmed] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isConfirmed) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isConfirmed, onClose])

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="panel modal-panel security-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-codes-title"
      >
        <p className="eyebrow">SECURITY</p>
        <h3 id="recovery-codes-title">Save your recovery codes</h3>
        <p className="support-copy">
          These codes are shown only once. Store them in a safe place.
        </p>

        <div className="field-grid">
          {codes.map((code) => (
            <code key={code} className="micro-badge">
              {code}
            </code>
          ))}
        </div>

        <label className="backup-checkbox-row">
          <input
            type="checkbox"
            checked={isConfirmed}
            onChange={(event) => {
              setIsConfirmed(event.target.checked)
            }}
          />
          <span>I saved these recovery codes.</span>
        </label>

        <div className="backup-modal-actions">
          <button
            type="button"
            className="submit-button"
            onClick={onClose}
            disabled={!isConfirmed}
          >
            Done
          </button>
        </div>
      </section>
    </div>
  )
}
