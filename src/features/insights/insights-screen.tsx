import { useMemo, useState } from 'react'
import { formatCurrency, formatMonthLabel } from '../../domain/formatters'
import {
  getCategoryTotalsForMonthKeys,
  getMonthKey,
  getMonthlyTrend,
  getOverviewForMonthKeys,
  shiftMonthKey,
} from '../../domain/selectors'
import { useFinance } from '../../state/use-finance'
import {
  InsightsCategoryDonutChart,
  InsightsTrendChart,
} from './insights-charts'

type InsightRange = 'month' | '3m' | 'year'
type InsightView = 'bars' | 'charts'

function getMonthRange(endMonthKey: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    shiftMonthKey(endMonthKey, index - (count - 1)),
  )
}

function getPeriodDayCount(range: InsightRange): number {
  const today = new Date()

  if (range === 'month') {
    return today.getDate()
  }

  const startMonthOffset = range === '3m' ? -2 : -11
  const start = new Date(today.getFullYear(), today.getMonth() + startMonthOffset, 1)
  const diffInMs = today.getTime() - start.getTime()

  return Math.max(1, Math.floor(diffInMs / 86_400_000) + 1)
}

function formatSignedCurrency(value: number, currency: string): string {
  if (value > 0) {
    return `+${formatCurrency(value, currency)}`
  }

  return formatCurrency(value, currency)
}

export function InsightsScreen() {
  const { state } = useFinance()
  const monthKey = useMemo(() => getMonthKey(), [])
  const [range, setRange] = useState<InsightRange>('month')
  const [view, setView] = useState<InsightView>('bars')
  const currency = state.settings.currency
  const summaryMonthKeys = useMemo(() => {
    if (range === 'month') {
      return [monthKey]
    }

    return getMonthRange(monthKey, range === '3m' ? 3 : 12)
  }, [monthKey, range])
  const previousMonthKeys = useMemo(() => {
    if (range === 'month') {
      return [shiftMonthKey(monthKey, -1)]
    }

    const periodLength = range === '3m' ? 3 : 12
    return getMonthRange(shiftMonthKey(monthKey, -periodLength), periodLength)
  }, [monthKey, range])
  const chartPointCount = range === 'month' ? 6 : range === '3m' ? 3 : 12
  const trend = useMemo(() => getMonthlyTrend(state, chartPointCount), [state, chartPointCount])
  const currentOverview = useMemo(
    () => getOverviewForMonthKeys(state, summaryMonthKeys),
    [state, summaryMonthKeys],
  )
  const previousOverview = useMemo(
    () => getOverviewForMonthKeys(state, previousMonthKeys),
    [state, previousMonthKeys],
  )
  const categoryTotals = useMemo(
    () => getCategoryTotalsForMonthKeys(state, summaryMonthKeys),
    [state, summaryMonthKeys],
  )
  const topCategories = categoryTotals.slice(0, 4)
  const biggestTrendValue = useMemo(
    () => Math.max(1, ...trend.map((entry) => entry.expense)),
    [trend],
  )
  const biggestCategoryValue = useMemo(
    () => Math.max(1, ...topCategories.map((entry) => entry.total)),
    [topCategories],
  )
  const deltaExpense = currentOverview.expense - previousOverview.expense
  const averageDailySpend = currentOverview.expense / getPeriodDayCount(range)
  const peakMonth = useMemo(
    () => trend.reduce((max, entry) => (entry.expense > max.expense ? entry : max), trend[0]),
    [trend],
  )
  const leadingCategory = categoryTotals[0] ?? null
  const hasTrendData = trend.some((entry) => entry.expense > 0)
  const hasCategoryData = categoryTotals.length > 0 && currentOverview.expense > 0
  const summaryLabel =
    range === 'month'
      ? 'spent this month'
      : range === '3m'
        ? 'spent in the last 3 months'
        : 'spent in the last 12 months'
  const comparisonLabel =
    range === 'month'
      ? 'vs last month'
      : range === '3m'
        ? 'vs previous 3 months'
        : 'vs previous 12 months'

  return (
    <div className="screen-stack insights-screen">
      <section className="panel insights-summary-card">
        <div className="insights-summary-controls">
          <div className="insights-range-switch" role="tablist" aria-label="Insights range">
            {(
              [
                ['month', 'Month'],
                ['3m', '3M'],
                ['year', 'Year'],
              ] as const
            ).map(([entry, label]) => (
              <button
                key={entry}
                type="button"
                className={`insights-range-button ${range === entry ? 'active' : ''}`.trim()}
                onClick={() => setRange(entry)}
                role="tab"
                aria-selected={range === entry}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="insights-view-toggle">
            <span className="insights-switch-label">View</span>
            <div className="insights-view-switch" role="group" aria-label="Insights chart mode">
              {(
                [
                  ['bars', 'Bars'],
                  ['charts', 'Charts'],
                ] as const
              ).map(([entry, label]) => (
                <button
                  key={entry}
                  type="button"
                  className={`insights-view-button ${view === entry ? 'active' : ''}`.trim()}
                  aria-pressed={view === entry}
                  onClick={() => setView(entry)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="insights-hero">
          <span className="insights-period-label">
            {range === 'month' ? formatMonthLabel(monthKey) : summaryLabel}
          </span>
          <strong className="insights-hero-value">
            {formatCurrency(currentOverview.expense, currency)}
          </strong>
          <p>{summaryLabel}</p>
        </div>

        <div className="insights-secondary-stats">
          <article className="insight-stat-card">
            <span>{comparisonLabel}</span>
            <strong className={deltaExpense > 0 ? 'expense' : deltaExpense < 0 ? 'income' : ''}>
              {formatSignedCurrency(deltaExpense, currency)}
            </strong>
          </article>

          <article className="insight-stat-card">
            <span>Average daily</span>
            <strong>{formatCurrency(averageDailySpend, currency)}</strong>
          </article>
        </div>
      </section>

      <div className="insights-grid">
        <section className="panel insights-trend-panel">
          <div className="insights-panel-heading">
            <div className="insights-panel-copy">
              <h3>Monthly spending</h3>
              <p className="insights-chart-kicker">
                {hasTrendData && peakMonth
                  ? `Highest spending landed in ${formatMonthLabel(peakMonth.monthKey)}.`
                  : 'Add a few expense records to reveal your trend.'}
              </p>
            </div>
            <span>{trend.length} months</span>
          </div>

          {view === 'bars' ? (
            <div className="insights-trend-list">
              {trend.map((entry) => (
                <div className="insights-trend-row" key={entry.monthKey}>
                  <span className="insights-trend-label">{formatMonthLabel(entry.monthKey)}</span>

                  <div className="insights-trend-track" aria-hidden="true">
                    <span
                      className={`insights-trend-fill ${entry.monthKey === monthKey ? 'current' : ''}`.trim()}
                      style={{ width: `${(entry.expense / biggestTrendValue) * 100}%` }}
                    />
                  </div>

                  <strong className="insights-trend-amount">
                    {formatCurrency(entry.expense, currency)}
                  </strong>
                </div>
              ))}
            </div>
          ) : hasTrendData ? (
            <InsightsTrendChart
              trend={trend}
              currency={currency}
              currentMonthKey={monthKey}
            />
          ) : (
            <p className="empty-state">Add a few expense records to reveal your trend.</p>
          )}

          {peakMonth && hasTrendData ? (
            <p className="insights-footnote">
              Highest spending: {formatMonthLabel(peakMonth.monthKey)}
            </p>
          ) : null}
        </section>

        <section className="panel insights-categories-panel">
          <div className="insights-panel-heading">
            <div className="insights-panel-copy">
              <h3>Top categories</h3>
              <p className="insights-chart-kicker">
                {leadingCategory
                  ? `${leadingCategory.name} leads this ${range === 'month' ? 'month' : 'period'}.`
                  : 'Your spending mix will appear after a few expense records.'}
              </p>
            </div>
            <span>{range === 'month' ? 'This month' : summaryLabel}</span>
          </div>

          {topCategories.length === 0 ? (
            <p className="empty-state">Your spending mix will appear after a few records.</p>
          ) : view === 'bars' ? (
            <div className="insights-categories-list">
              {topCategories.map((entry) => (
                <div className="insights-category-row" key={entry.categoryId}>
                  <div className="insights-category-head">
                    <span>{entry.name}</span>
                    <strong>{formatCurrency(entry.total, currency)}</strong>
                  </div>

                  <div className="insights-category-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${(entry.total / biggestCategoryValue) * 100}%`,
                        backgroundColor: entry.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : hasCategoryData ? (
            <InsightsCategoryDonutChart
              categories={categoryTotals}
              total={currentOverview.expense}
              currency={currency}
            />
          ) : (
            <p className="empty-state">Your spending mix will appear after a few expense records.</p>
          )}
        </section>
      </div>
    </div>
  )
}
