import {
  getRecurringFrequencyLabel,
  getRecurringTemplateLabel,
} from '../../domain/recurring'
import { formatLongDateLabel } from '../../domain/formatters'
import type { Category, RecurringTemplate } from '../../domain/models'
import { formatSensitiveCurrency } from '../privacy/sensitive-data'

interface SettingsRecurringSectionProps {
  activeRecurringTemplates: RecurringTemplate[]
  categories: Category[]
  currency: string
  hideSensitiveValues: boolean
  onBack: () => void
  onOpenRecurringEditor: (templateId: string) => void
}

export function SettingsRecurringSection({
  activeRecurringTemplates,
  categories,
  currency,
  hideSensitiveValues,
  onBack,
  onOpenRecurringEditor,
}: SettingsRecurringSectionProps) {
  return (
    <section className="panel settings-list-panel">
      <div className="settings-categories-header">
        <button
          type="button"
          className="ghost-button compact"
          onClick={onBack}
        >
          Back
        </button>

        <div>
          <p className="eyebrow">RECURRING</p>
          <h3>Recurring transactions</h3>
          <p>Manage future occurrences without changing past records.</p>
        </div>

        <span className="micro-badge subtle">
          {activeRecurringTemplates.length} active
        </span>
      </div>

      {activeRecurringTemplates.length === 0 ? (
        <p className="empty-state">
          Recurring items you create will appear here for future editing.
        </p>
      ) : (
        <div className="settings-group-list settings-category-list-panel">
          {activeRecurringTemplates.map((template) => {
            const category = categories.find(
              (entry) => entry.id === template.categoryId,
            )

            return (
              <button
                key={template.id}
                type="button"
                className="settings-category-row"
                onClick={() => onOpenRecurringEditor(template.id)}
              >
                <div className="settings-category-main">
                  <span
                    className="chip-dot"
                    aria-hidden="true"
                    style={{ backgroundColor: category?.color ?? 'var(--accent)' }}
                  />

                  <div className="settings-category-info">
                    <strong>
                      {getRecurringTemplateLabel(template, category?.name)}
                    </strong>
                    <span className="settings-category-kind">
                      {getRecurringFrequencyLabel(template)} · due {formatLongDateLabel(template.nextDueDate)}
                    </span>
                  </div>
                </div>

                <div className="settings-category-meta recurring-settings-meta">
                  <span className="micro-badge subtle">{template.type}</span>
                  <strong className="settings-row-value">
                    {formatSensitiveCurrency(
                      template.amount,
                      currency,
                      hideSensitiveValues,
                    )}
                  </strong>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
