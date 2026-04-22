import { useEffect, useState } from 'react'

interface RecoveryCodesPinDialogProps {
  onCancel: () => void
  onConfirm: (pin: string) => Promise<string | null>
}

export function RecoveryCodesPinDialog({ onCancel, onConfirm }: RecoveryCodesPinDialogProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isBusy, onCancel])

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => (!isBusy ? onCancel() : null)}>
      <section
        className="panel modal-panel security-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-codes-pin-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">SECURITY</p>
        <h3 id="recovery-codes-pin-title">Regenerate recovery codes</h3>
        <p className="support-copy">Enter your current PIN to invalidate old recovery codes and create new ones.</p>

        <form
          className="field-grid"
          onSubmit={(event) => {
            event.preventDefault()

            if (isBusy) {
              return
            }

            setIsBusy(true)
            setError(null)

            void onConfirm(pin).then((nextError) => {
              if (nextError) {
                setError(nextError)
                return
              }

              onCancel()
            }).finally(() => {
              setIsBusy(false)
            })
          }}
        >
          <label>
            Current PIN
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              pattern="[0-9]*"
              value={pin}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D+/g, ''))
                setError(null)
              }}
              disabled={isBusy}
              required
            />
          </label>

          {error ? <p className="inline-error">{error}</p> : null}

          <div className="backup-modal-actions">
            <button type="button" className="ghost-button" onClick={onCancel} disabled={isBusy}>
              Cancel
            </button>
            <button type="submit" className="submit-button" disabled={isBusy || pin.length === 0}>
              {isBusy ? 'Working...' : 'Regenerate'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
