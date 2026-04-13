import type { ThemeMode } from '../../domain/models'

interface SettingsGeneralSectionProps {
  currency: string
  currencyOptions: string[]
  theme: ThemeMode
  hideOverspendingBudgetsInHome: boolean
  onCurrencyChange: (currency: string) => void
  onThemeChange: (theme: ThemeMode) => void
  onHideOverspendingBudgetsInHomeChange: (hidden: boolean) => void
}

export function SettingsGeneralSection({
  currency,
  currencyOptions,
  theme,
  hideOverspendingBudgetsInHome,
  onCurrencyChange,
  onThemeChange,
  onHideOverspendingBudgetsInHomeChange,
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

        <div className="settings-list-row settings-control-row">
          <div className="settings-row-copy">
            <span className="settings-row-label">Hide budgets on home tab</span>
            <span className="settings-row-caption">
              {hideOverspendingBudgetsInHome ? 'On' : 'Off'}
            </span>
          </div>
          <div className="settings-inline-switch" role="group" aria-label="Overspending budgets on home tab">
            <button
              type="button"
              className={hideOverspendingBudgetsInHome ? 'active' : ''}
              onClick={() => onHideOverspendingBudgetsInHomeChange(true)}
            >
              On
            </button>
            <button
              type="button"
              className={!hideOverspendingBudgetsInHome ? 'active' : ''}
              onClick={() => onHideOverspendingBudgetsInHomeChange(false)}
            >
              Off
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
