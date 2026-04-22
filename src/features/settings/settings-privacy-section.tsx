interface SettingsPrivacySectionProps {
  hideSensitiveData: boolean
  onHideSensitiveDataChange: (hidden: boolean) => void
}

export function SettingsPrivacySection({
  hideSensitiveData,
  onHideSensitiveDataChange,
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
      </div>
    </div>
  )
}
