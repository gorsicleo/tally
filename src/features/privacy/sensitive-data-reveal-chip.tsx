interface SensitiveDataRevealChipProps {
  isRevealedForSession: boolean
  onReveal: () => void
}

export function SensitiveDataRevealChip({
  isRevealedForSession,
  onReveal,
}: SensitiveDataRevealChipProps) {
  return (
    <button
      type="button"
      className={`sensitive-data-reveal-chip ${isRevealedForSession ? 'revealed' : ''}`.trim()}
      onClick={() => {
        if (!isRevealedForSession) {
          onReveal()
        }
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
        : 'Sensitive values hidden • Tap to reveal'}
    </button>
  )
}
