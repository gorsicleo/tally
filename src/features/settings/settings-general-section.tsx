import type { ThemeMode } from '../../domain/models'

interface SettingsGeneralSectionProps {
  currency: string
  currencyOptions: string[]
  theme: ThemeMode
  onCurrencyChange: (currency: string) => void
  onThemeChange: (theme: ThemeMode) => void
}

export function SettingsGeneralSection({
  currency,
  currencyOptions,
  theme,
  onCurrencyChange,
  onThemeChange,
}: SettingsGeneralSectionProps) {
  return (
    <div className="settings-group">
      <p className="settings-group-title">General</p>

      <div className="settings-group-list">
        <label className="settings-list-row settings-control-row">
          <span className="settings-row-label">Currency</span>
          <select
            value={currency}
            onChange={(event) => onCurrencyChange(event.target.value)}
          >
            {currencyOptions.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>

        <div className="settings-list-row settings-control-row">
          <span className="settings-row-label">Theme</span>
          <div className="settings-inline-switch" role="group" aria-label="Theme">
            <button
              type="button"
              className={theme === 'auto' ? 'active' : ''}
              onClick={() => onThemeChange('auto')}
            >
              Auto
            </button>
            <button
              type="button"
              className={theme === 'light' ? 'active' : ''}
              onClick={() => onThemeChange('light')}
            >
              Light
            </button>
            <button
              type="button"
              className={theme === 'dark' ? 'active' : ''}
              onClick={() => onThemeChange('dark')}
            >
              Dark
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
