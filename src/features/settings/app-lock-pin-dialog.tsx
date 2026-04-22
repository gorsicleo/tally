import { useEffect, useMemo, useState } from 'react'
import { APP_LOCK_PIN_MIN_LENGTH, validateNumericPin } from '../privacy/app-lock'

export type AppLockPinDialogMode = 'setup' | 'change' | 'remove'

interface AppLockPinDialogProps {
  mode: AppLockPinDialogMode
  onCancel: () => void
  onSetup: (pin: string) => Promise<string | null>
  onChangePin: (currentPin: string, nextPin: string) => Promise<string | null>
  onRemove: (currentPin: string) => Promise<string | null>
}

function getDialogCopy(mode: AppLockPinDialogMode) {
  if (mode === 'setup') {
    return {
      eyebrow: 'SECURITY',
      title: 'Create a PIN',
      description: `Use at least ${APP_LOCK_PIN_MIN_LENGTH} digits. You will need this PIN to unlock Tally on launch.`,
      submitLabel: 'Save PIN',
    }
  }

  if (mode === 'change') {
    return {
      eyebrow: 'SECURITY',
      title: 'Change PIN',
      description: 'Enter your current PIN, then choose a new one.',
      submitLabel: 'Update PIN',
    }
  }

  return {
    eyebrow: 'SECURITY',
    title: 'Remove app lock',
    description: 'Enter your current PIN to remove launch protection from this device.',
    submitLabel: 'Remove app lock',
  }
}

export function AppLockPinDialog({
  mode,
  onCancel,
  onSetup,
  onChangePin,
  onRemove,
}: AppLockPinDialogProps) {
  const [currentPin, setCurrentPin] = useState('')
  const [nextPin, setNextPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const copy = useMemo(() => getDialogCopy(mode), [mode])

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

  const normalizePin = (value: string) => value.replace(/\D+/g, '')

  const validateSetupOrChange = () => {
    const nextPinError = validateNumericPin(nextPin)

    if (nextPinError) {
      return nextPinError
    }

    if (nextPin !== confirmPin) {
      return 'PIN confirmation does not match.'
    }

    return null
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isBusy) {
      return
    }

    let nextError: string | null = null

    if (mode === 'setup' || mode === 'change') {
      nextError = validateSetupOrChange()
    }

    if (mode !== 'setup' && currentPin.length === 0) {
      nextError = 'Current PIN is required.'
    }

    if (nextError) {
      setError(nextError)
      return
    }

    setIsBusy(true)
    setError(null)

    try {
      const actionError =
        mode === 'setup'
          ? await onSetup(nextPin)
          : mode === 'change'
            ? await onChangePin(currentPin, nextPin)
            : await onRemove(currentPin)

      if (actionError) {
        setError(actionError)
        return
      }

      onCancel()
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => (!isBusy ? onCancel() : null)}>
      <section
        className="panel modal-panel security-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-lock-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">{copy.eyebrow}</p>
        <h3 id="app-lock-dialog-title">{copy.title}</h3>
        <p className="support-copy">{copy.description}</p>

        <form className="field-grid" onSubmit={handleSubmit}>
          {mode !== 'setup' ? (
            <label>
              Current PIN
              <input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                pattern="[0-9]*"
                value={currentPin}
                onChange={(event) => {
                  setCurrentPin(normalizePin(event.target.value))
                  setError(null)
                }}
                disabled={isBusy}
                required
              />
            </label>
          ) : null}

          {mode !== 'remove' ? (
            <>
              <label>
                {mode === 'setup' ? 'New PIN' : 'New PIN'}
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete={mode === 'setup' ? 'new-password' : 'off'}
                  pattern="[0-9]*"
                  value={nextPin}
                  onChange={(event) => {
                    setNextPin(normalizePin(event.target.value))
                    setError(null)
                  }}
                  disabled={isBusy}
                  required
                />
              </label>

              <label>
                Confirm PIN
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]*"
                  value={confirmPin}
                  onChange={(event) => {
                    setConfirmPin(normalizePin(event.target.value))
                    setError(null)
                  }}
                  disabled={isBusy}
                  required
                />
              </label>
            </>
          ) : null}

          {error ? <p className="inline-error">{error}</p> : null}

          <div className="backup-modal-actions">
            <button type="button" className="ghost-button" onClick={onCancel} disabled={isBusy}>
              Cancel
            </button>
            <button type="submit" className="submit-button" disabled={isBusy}>
              {isBusy ? 'Working...' : copy.submitLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}