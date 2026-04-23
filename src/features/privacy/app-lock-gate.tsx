import { useCallback, useEffect, useMemo, useState } from 'react'

interface AppLockGateProps {
  cooldownUntil: number | null
  canUseDeviceAuthentication: boolean
  canUseRecoveryCodes: boolean
  onUnlock: (pin: string) => Promise<string | null>
  onUnlockWithDeviceAuthentication: () => Promise<string | null>
  onUnlockWithRecoveryCode: (code: string) => Promise<string | null>
}

function formatCooldownLabel(cooldownUntil: number | null, now: number): string | null {
  if (cooldownUntil === null || cooldownUntil <= now) {
    return null
  }

  const remainingSeconds = Math.max(1, Math.ceil((cooldownUntil - now) / 1000))

  return `Try again in ${remainingSeconds}s.`
}

export function AppLockGate({
  cooldownUntil,
  canUseDeviceAuthentication,
  canUseRecoveryCodes,
  onUnlock,
  onUnlockWithDeviceAuthentication,
  onUnlockWithRecoveryCode,
}: AppLockGateProps) {
  const [pin, setPin] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [unlockMode, setUnlockMode] = useState<'device' | 'pin' | 'recovery'>(
    canUseDeviceAuthentication ? 'device' : 'pin',
  )
  const [hasAttemptedDeviceAuth, setHasAttemptedDeviceAuth] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyMode, setBusyMode] = useState<'pin' | 'device' | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const cooldownLabel = useMemo(() => formatCooldownLabel(cooldownUntil, now), [cooldownUntil, now])
  const isCoolingDown = cooldownLabel !== null
  const isBusy = busyMode !== null

  useEffect(() => {
    if (!canUseDeviceAuthentication) {
      setUnlockMode('pin')
    }
  }, [canUseDeviceAuthentication])

  useEffect(() => {
    if (!isCoolingDown) {
      return
    }

    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 250)

    return () => {
      window.clearInterval(interval)
    }
  }, [isCoolingDown])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isBusy || isCoolingDown) {
      return
    }

    setBusyMode('pin')
    setError(null)

    try {
      const nextError = await onUnlock(pin)

      if (nextError) {
        setError(nextError)
        return
      }

      setPin('')
    } finally {
      setBusyMode(null)
    }
  }

  const handleDeviceAuth = useCallback(async (fallbackToPinOnFailure = false) => {
    if (isBusy) {
      return
    }

    setBusyMode('device')
    setError(null)

    try {
      const nextError = await onUnlockWithDeviceAuthentication()

      if (nextError) {
        if (fallbackToPinOnFailure) {
          setUnlockMode('pin')
        }
        setError(nextError)
      }
    } finally {
      setBusyMode(null)
    }
  }, [isBusy, onUnlockWithDeviceAuthentication])

  useEffect(() => {
    if (!canUseDeviceAuthentication || unlockMode !== 'device' || hasAttemptedDeviceAuth || isBusy) {
      return
    }

    setHasAttemptedDeviceAuth(true)
    void handleDeviceAuth(true)
  }, [canUseDeviceAuthentication, handleDeviceAuth, hasAttemptedDeviceAuth, isBusy, unlockMode])

  const handleRecoveryCodeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isBusy) {
      return
    }

    setBusyMode('pin')
    setError(null)

    try {
      const nextError = await onUnlockWithRecoveryCode(recoveryCode)

      if (nextError) {
        setError(nextError)
        return
      }

      setRecoveryCode('')
    } finally {
      setBusyMode(null)
    }
  }

  return (
    <section className="panel unlock-gate-panel" aria-labelledby="unlock-gate-title">
      <p className="eyebrow">SECURITY</p>
      <h1 id="unlock-gate-title">Unlock Tally</h1>
      <p className="unlock-gate-copy">
        {canUseDeviceAuthentication && unlockMode === 'device'
          ? 'Use device authentication to open Tally.'
          : 'Enter your PIN to open Tally on this device.'}
      </p>

      {canUseDeviceAuthentication && unlockMode === 'device' ? (
        <div className="field-grid unlock-gate-form">
          <p className="support-copy">
            {busyMode === 'device'
              ? 'Checking device authentication...'
              : 'Preparing device authentication...'}
          </p>

          {canUseRecoveryCodes ? (
            <div className="unlock-gate-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setUnlockMode('recovery')
                  setError(null)
                }}
                disabled={isBusy}
              >
                Use recovery code
              </button>
            </div>
          ) : null}

          {error ? <p className="inline-error">{error}</p> : null}
        </div>
      ) : unlockMode === 'recovery' ? (
        <form className="field-grid unlock-gate-form" onSubmit={handleRecoveryCodeSubmit}>
          <label>
            Recovery code
            <input
              type="text"
              autoComplete="one-time-code"
              value={recoveryCode}
              onChange={(event) => {
                setRecoveryCode(event.target.value.toUpperCase())
                setError(null)
              }}
              placeholder="XXXX-XXXX"
              disabled={isBusy || isCoolingDown}
              required
            />
          </label>

          {error ? <p className="inline-error">{error}</p> : null}
          {cooldownLabel ? <p className="support-copy">{cooldownLabel}</p> : null}

          <div className="unlock-gate-actions">
            <button
              type="submit"
              className="submit-button"
              disabled={isBusy || isCoolingDown || recoveryCode.trim().length === 0}
            >
              {busyMode === 'pin' ? 'Checking code...' : 'Unlock with recovery code'}
            </button>
          </div>

          <div className="unlock-gate-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setUnlockMode('pin')
                setError(null)
              }}
              disabled={isBusy}
            >
              Use PIN instead
            </button>
          </div>
        </form>
      ) : (
        <form className="field-grid unlock-gate-form" onSubmit={handleSubmit}>
          <label>
            PIN
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
              placeholder="Enter PIN"
              disabled={isBusy || isCoolingDown}
              required
            />
          </label>

          {error ? <p className="inline-error">{error}</p> : null}
          {cooldownLabel ? <p className="support-copy">{cooldownLabel}</p> : null}

          <div className="unlock-gate-actions">
            <button
              type="submit"
              className="submit-button"
              disabled={isBusy || isCoolingDown || pin.length === 0}
            >
              {busyMode === 'pin' ? 'Unlocking...' : 'Unlock'}
            </button>
          </div>

          {canUseDeviceAuthentication ? (
            <div className="unlock-gate-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                    setUnlockMode('device')
                  setError(null)
                }}
                disabled={isBusy}
              >
                Unlock with device authentication
              </button>
            </div>
          ) : null}

            {canUseRecoveryCodes ? (
              <div className="unlock-gate-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setUnlockMode('recovery')
                    setError(null)
                  }}
                  disabled={isBusy}
                >
                  Use recovery code
                </button>
              </div>
            ) : null}
        </form>
      )}
    </section>
  )
}