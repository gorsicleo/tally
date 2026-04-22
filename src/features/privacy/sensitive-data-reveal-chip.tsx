import { useState } from 'react'

interface SensitiveDataRevealChipProps {
  isRevealedForSession: boolean
  onReveal: () => Promise<string | null>
}

export function SensitiveDataRevealChip({
  isRevealedForSession,
  onReveal,
}: SensitiveDataRevealChipProps) {
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <button
        type="button"
        className={`sensitive-data-reveal-chip ${isRevealedForSession ? 'revealed' : ''}`.trim()}
        onClick={() => {
          if (isRevealedForSession || isBusy) {
            return
          }

          setIsBusy(true)
          setError(null)

          void onReveal().then((message) => {
            if (message) {
              setError(message)
            }
          }).finally(() => {
            setIsBusy(false)
          })
        }}
        aria-live="polite"
        aria-label={
          isRevealedForSession
            ? 'Sensitive values are visible for this session'
            : 'Sensitive values are hidden. Tap to reveal for this session'
        }
      >
        {isRevealedForSession
          ? 'Values visible for this session'
          : isBusy
            ? 'Checking device authentication...'
            : 'Sensitive values hidden • Tap to reveal'}
      </button>

      {error ? <p className="support-copy">{error}</p> : null}
    </div>
  )
}
