import { useMemo, useState } from 'react'
import {
  formatCurrency,
  formatLongDateLabel,
} from '../../domain/formatters'
import { getDueRecurringGroups } from '../../domain/recurring'
import { useFinance } from '../../state/use-finance'

interface RecurringDueSectionProps {
  currency: string
  onOpenRecurringEditor: (templateId: string) => void
  onShowToast: (message: string) => void
}

export function RecurringDueSection({
  currency,
  onOpenRecurringEditor,
  onShowToast,
}: RecurringDueSectionProps) {
  const {
    state,
    addRecurringOccurrences,
    skipRecurringOccurrences,
    stopRecurringTemplate,
  } = useFinance()
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null)
  const dueGroups = useMemo(
    () => getDueRecurringGroups(state.recurringTemplates, state.categories),
    [state.categories, state.recurringTemplates],
  )

  if (dueGroups.length === 0) {
    return null
  }

  return (
    <section className="panel recurring-due-panel">
      <div className="section-heading-row recurring-due-heading">
        <div>
          <p className="eyebrow">Recurring due</p>
          <p>Confirm the next entries yourself when you are ready.</p>
        </div>
      </div>

      <div className="recurring-due-list">
        {dueGroups.map((group) => {
          const isExpanded = expandedTemplateId === group.template.id
          const dueCount = group.occurrences.length
          const firstOccurrence = group.occurrences[0]
          const allOccurrenceDates = group.occurrences.map(
            (occurrence) => occurrence.occurrenceDate,
          )

          return (
            <article className="recurring-due-card" key={group.template.id}>
              <div className="recurring-due-card-head">
                <div>
                  <strong>
                    {group.title} {formatCurrency(group.template.amount, currency)}
                  </strong>
                  <p>
                    {group.frequencyLabel} · {dueCount} due
                  </p>
                </div>
                <span className="micro-badge subtle">{group.template.type}</span>
              </div>

              <p className="recurring-due-summary">
                First due {formatLongDateLabel(firstOccurrence.occurrenceDate)}
              </p>

              <div className="recurring-due-actions">
                <button
                  type="button"
                  className="submit-button compact"
                  onClick={() => {
                    addRecurringOccurrences({
                      templateId: group.template.id,
                      occurrenceDates: allOccurrenceDates,
                    })
                    onShowToast(
                      `Added ${dueCount} recurring occurrence${dueCount === 1 ? '' : 's'}.`,
                    )
                  }}
                >
                  Add all
                </button>

                <button
                  type="button"
                  className="ghost-button compact"
                  onClick={() => {
                    setExpandedTemplateId(isExpanded ? null : group.template.id)
                  }}
                >
                  {isExpanded ? 'Hide review' : 'Review'}
                </button>
              </div>

              {isExpanded ? (
                <div className="recurring-due-review">
                  <div className="recurring-due-manage-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onOpenRecurringEditor(group.template.id)}
                    >
                      Edit recurring
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        skipRecurringOccurrences({
                          templateId: group.template.id,
                          occurrenceDates: allOccurrenceDates,
                        })
                        onShowToast(
                          `Skipped ${dueCount} recurring occurrence${dueCount === 1 ? '' : 's'}.`,
                        )
                      }}
                    >
                      Skip all
                    </button>
                    <button
                      type="button"
                      className="text-button recurring-stop-button"
                      onClick={() => {
                        const confirmed = window.confirm(
                          'Stop recurring for future occurrences?',
                        )

                        if (!confirmed) {
                          return
                        }

                        stopRecurringTemplate(group.template.id)
                        onShowToast('Recurring stopped.')
                      }}
                    >
                      Stop recurring
                    </button>
                  </div>

                  <div className="recurring-due-occurrence-list">
                    {group.occurrences.map((occurrence, index) => {
                      const isFirstActionable = index === 0

                      return (
                        <div className="recurring-due-occurrence-row" key={occurrence.occurrenceDate}>
                          <div className="recurring-due-occurrence-copy">
                            <strong>{formatLongDateLabel(occurrence.occurrenceDate)}</strong>
                            <span>
                              {isFirstActionable
                                ? 'Ready to confirm now.'
                                : 'Handle earlier due dates first, or use Add all.'}
                            </span>
                          </div>

                          {isFirstActionable ? (
                            <div className="recurring-due-occurrence-actions">
                              <button
                                type="button"
                                className="ghost-button compact"
                                onClick={() => {
                                  skipRecurringOccurrences({
                                    templateId: group.template.id,
                                    occurrenceDates: [occurrence.occurrenceDate],
                                  })
                                  onShowToast('Skipped recurring occurrence.')
                                }}
                              >
                                Skip occurrence
                              </button>
                              <button
                                type="button"
                                className="submit-button compact"
                                onClick={() => {
                                  addRecurringOccurrences({
                                    templateId: group.template.id,
                                    occurrenceDates: [occurrence.occurrenceDate],
                                  })
                                  onShowToast('Added recurring occurrence.')
                                }}
                              >
                                Add occurrence
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}