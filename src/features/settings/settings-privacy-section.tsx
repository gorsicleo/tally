interface SettingsPrivacySectionProps {
  hideSensitiveData: boolean
  lockAppOnLaunch: boolean
  hasAppLockPin: boolean
  isDeviceAuthSupported: boolean
  hasDeviceAuthCredential: boolean
  isRecoveryCodesConfigured: boolean
  recoveryCodesRemaining: number
  onHideSensitiveDataChange: (hidden: boolean) => void
  onLockAppOnLaunchChange: (enabled: boolean) => void
  onSetupDeviceAuthentication: () => void
  onRemoveDeviceAuthentication: () => void
  onGenerateRecoveryCodes: () => void
  onRegenerateRecoveryCodes: () => void
  onChangePin: () => void
}

export function SettingsPrivacySection({
  hideSensitiveData,
  lockAppOnLaunch,
  hasAppLockPin,
  isDeviceAuthSupported,
  hasDeviceAuthCredential,
  isRecoveryCodesConfigured,
  recoveryCodesRemaining,
  onHideSensitiveDataChange,
  onLockAppOnLaunchChange,
  onSetupDeviceAuthentication,
  onRemoveDeviceAuthentication,
  onGenerateRecoveryCodes,
  onRegenerateRecoveryCodes,
  onChangePin,
}: SettingsPrivacySectionProps) {
  return (
    <div className="settings-group">
      <p className="settings-group-title">Privacy & Security</p>

      <div className="settings-group-list">
        <div className="settings-list-row settings-control-row">
          <div className="settings-row-copy">
            <span className="settings-row-label">Hide sensitive data</span>
            <span className="settings-row-caption">
              {hideSensitiveData ? 'On' : 'Off'}
            </span>
          </div>
          <div className="settings-inline-switch" role="group" aria-label="Hide sensitive data">
            <button
              type="button"
              className={hideSensitiveData ? 'active' : ''}
              onClick={() => onHideSensitiveDataChange(true)}
            >
              On
            </button>
            <button
              type="button"
              className={!hideSensitiveData ? 'active' : ''}
              onClick={() => onHideSensitiveDataChange(false)}
            >
              Off
            </button>
          </div>
        </div>

        <div className="settings-list-row settings-control-row">
          <div className="settings-row-copy">
            <span className="settings-row-label">Lock app on launch</span>
            <span className="settings-row-caption">
              {lockAppOnLaunch ? 'On' : 'Off'}
            </span>
          </div>
          <div className="settings-inline-switch" role="group" aria-label="Lock app on launch">
            <button
              type="button"
              className={lockAppOnLaunch ? 'active' : ''}
              onClick={() => onLockAppOnLaunchChange(true)}
            >
              On
            </button>
            <button
              type="button"
              className={!lockAppOnLaunch ? 'active' : ''}
              onClick={() => onLockAppOnLaunchChange(false)}
            >
              Off
            </button>
          </div>
        </div>

        {lockAppOnLaunch && hasAppLockPin ? (
          <>
            {isDeviceAuthSupported ? (
              <button
                type="button"
                className="settings-list-row settings-action-row"
                onClick={hasDeviceAuthCredential ? onRemoveDeviceAuthentication : onSetupDeviceAuthentication}
              >
                <div className="settings-row-copy">
                  <span className="settings-row-label">Device authentication</span>
                  <span className="settings-row-caption">
                    {hasDeviceAuthCredential
                      ? 'Remove device authentication'
                      : 'Set up device authentication'}
                  </span>
                </div>
              </button>
            ) : (
              <div className="settings-list-row">
                <div className="settings-row-copy">
                  <span className="settings-row-label">Device authentication</span>
                  <span className="settings-row-caption">Not available on this browser</span>
                </div>
              </div>
            )}

            <button
              type="button"
              className="settings-list-row settings-action-row"
              onClick={onChangePin}
            >
              <div className="settings-row-copy">
                <span className="settings-row-label">Change PIN</span>
                <span className="settings-row-caption">Update the PIN used to unlock Tally</span>
              </div>
            </button>

            <button
              type="button"
              className="settings-list-row settings-action-row"
              onClick={isRecoveryCodesConfigured ? onRegenerateRecoveryCodes : onGenerateRecoveryCodes}
            >
              <div className="settings-row-copy">
                <span className="settings-row-label">Recovery codes</span>
                <span className="settings-row-caption">
                  {isRecoveryCodesConfigured
                    ? `${recoveryCodesRemaining} codes remaining • Regenerate`
                    : 'Generate one-time recovery codes'}
                </span>
              </div>
            </button>

            <p className="support-copy">
              Recovery codes are one-time fallback keys if PIN or device authentication is unavailable.
              Regenerating codes invalidates all previous codes.
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}
