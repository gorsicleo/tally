import { useId, useMemo } from 'react'
import { formatCurrency, formatMonthLabel } from '../../domain/formatters'
import type { CategoryTotal, MonthlyTrendPoint } from '../../domain/selectors'

const LINE_CHART_WIDTH = 320
const LINE_CHART_HEIGHT = 148
const LINE_CHART_PADDING = {
  top: 14,
  right: 10,
  bottom: 12,
  left: 10,
}
const DONUT_SIZE = 184
const DONUT_STROKE_WIDTH = 20
const MAX_PRIMARY_CATEGORY_SLICES = 4

interface TrendPoint {
  monthKey: string
  value: number
  x: number
  y: number
}

interface DonutSlice {
  id: string
  name: string
  color: string
  total: number
  share: number
}

interface DonutSliceRenderData extends DonutSlice {
  strokeDasharray: string
  strokeDashoffset: number
}

interface InsightsTrendChartProps {
  trend: MonthlyTrendPoint[]
  currency: string
  currentMonthKey: string
}

interface InsightsCategoryDonutChartProps {
  categories: CategoryTotal[]
  total: number
  currency: string
}

function buildTrendPoints(trend: MonthlyTrendPoint[]): TrendPoint[] {
  if (trend.length === 0) {
    return []
  }

  const maxValue = Math.max(1, ...trend.map((entry) => entry.expense))
  const innerWidth =
    LINE_CHART_WIDTH - LINE_CHART_PADDING.left - LINE_CHART_PADDING.right
  const innerHeight =
    LINE_CHART_HEIGHT - LINE_CHART_PADDING.top - LINE_CHART_PADDING.bottom

  return trend.map((entry, index) => {
    const progress = trend.length === 1 ? 0.5 : index / (trend.length - 1)

    return {
      monthKey: entry.monthKey,
      value: entry.expense,
      x: LINE_CHART_PADDING.left + innerWidth * progress,
      y:
        LINE_CHART_PADDING.top +
        innerHeight -
        (entry.expense / maxValue) * innerHeight,
    }
  })
}

function createSmoothPath(points: TrendPoint[]): string {
  if (points.length === 0) {
    return ''
  }

  if (points.length === 1) {
    const point = points[0]
    return `M ${point.x} ${point.y}`
  }

  let path = `M ${points[0].x} ${points[0].y}`

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const controlX = (current.x + next.x) / 2

    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`
  }

  return path
}

function createAreaPath(points: TrendPoint[]): string {
  if (points.length === 0) {
    return ''
  }

  const baseY = LINE_CHART_HEIGHT - LINE_CHART_PADDING.bottom
  const linePath = createSmoothPath(points)
  const lastPoint = points[points.length - 1]

  return `${linePath} L ${lastPoint.x} ${baseY} L ${points[0].x} ${baseY} Z`
}

function getHighlightedPointIndexes(points: TrendPoint[]): number[] {
  if (points.length === 0) {
    return []
  }

  let peakIndex = 0

  points.forEach((point, index) => {
    if (point.value >= points[peakIndex].value) {
      peakIndex = index
    }
  })

  return [...new Set([0, peakIndex, points.length - 1])]
}

function buildDonutSlices(
  categories: CategoryTotal[],
  total: number,
): DonutSlice[] {
  if (total <= 0) {
    return []
  }

  const visibleCategories = categories.slice(0, MAX_PRIMARY_CATEGORY_SLICES)
  const otherTotal = categories
    .slice(MAX_PRIMARY_CATEGORY_SLICES)
    .reduce((sum, entry) => sum + entry.total, 0)
  const slices = visibleCategories.map((entry) => ({
    id: entry.categoryId,
    name: entry.name,
    color: entry.color,
    total: entry.total,
    share: entry.total / total,
  }))

  if (otherTotal > 0) {
    slices.push({
      id: 'other',
      name: 'Other',
      color: 'var(--text-muted)',
      total: otherTotal,
      share: otherTotal / total,
    })
  }

  return slices
}

function getDirectionSymbol(delta: number): string {
  if (delta > 0) {
    return '↑'
  }

  if (delta < 0) {
    return '↓'
  }

  return '•'
}

export function InsightsTrendChart({
  trend,
  currency,
  currentMonthKey,
}: InsightsTrendChartProps) {
  const strokeGradientId = useId().replaceAll(':', '')
  const fillGradientId = useId().replaceAll(':', '')
  const points = useMemo(() => buildTrendPoints(trend), [trend])
  const linePath = useMemo(() => createSmoothPath(points), [points])
  const areaPath = useMemo(() => createAreaPath(points), [points])
  const highlightedPointIndexes = useMemo(
    () => getHighlightedPointIndexes(points),
    [points],
  )
  const latestPoint = points[points.length - 1] ?? null
  const previousPoint = points[points.length - 2] ?? null
  const latestDelta = latestPoint && previousPoint
    ? latestPoint.value - previousPoint.value
    : 0
  const peakPoint = useMemo(() => {
    return points.reduce<TrendPoint | null>((peak, point) => {
      if (!peak || point.value >= peak.value) {
        return point
      }

      return peak
    }, null)
  }, [points])

  return (
    <div className="insights-chart-surface insights-line-chart-surface">
      <svg
        className="insights-line-chart-svg"
        viewBox={`0 0 ${LINE_CHART_WIDTH} ${LINE_CHART_HEIGHT}`}
        role="img"
        aria-label="Monthly spending trend chart"
      >
        <defs>
          <linearGradient id={strokeGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-strong)" />
          </linearGradient>
          <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent-strong)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.28, 0.68].map((ratio) => {
          const y =
            LINE_CHART_PADDING.top +
            (LINE_CHART_HEIGHT - LINE_CHART_PADDING.top - LINE_CHART_PADDING.bottom) * ratio

          return (
            <line
              key={ratio}
              className="insights-line-grid"
              x1={LINE_CHART_PADDING.left}
              x2={LINE_CHART_WIDTH - LINE_CHART_PADDING.right}
              y1={y}
              y2={y}
            />
          )
        })}

        {areaPath ? (
          <path
            className="insights-line-area"
            d={areaPath}
            fill={`url(#${fillGradientId})`}
          />
        ) : null}

        {linePath ? (
          <path
            className="insights-line-path"
            d={linePath}
            stroke={`url(#${strokeGradientId})`}
            pathLength={1}
          />
        ) : null}

        {highlightedPointIndexes.map((index) => {
          const point = points[index]
          const isPeak = peakPoint?.monthKey === point.monthKey
          const isCurrent = point.monthKey === currentMonthKey

          return (
            <circle
              key={point.monthKey}
              className={`insights-line-dot ${isPeak ? 'peak' : ''} ${isCurrent ? 'current' : ''}`.trim()}
              cx={point.x}
              cy={point.y}
              r={isCurrent ? 4.2 : 3.4}
            />
          )
        })}
      </svg>

      <div className="insights-chart-caption">
        <div className="insights-chart-caption-item">
          <span>Latest</span>
          <strong className={`insights-chart-caption-value ${latestDelta > 0 ? 'up' : latestDelta < 0 ? 'down' : 'flat'}`.trim()}>
            {latestPoint ? `${formatCurrency(latestPoint.value, currency)} ${getDirectionSymbol(latestDelta)}` : '—'}
          </strong>
        </div>

        <div className="insights-chart-caption-item">
          <span>Peak</span>
          <strong>
            {peakPoint ? formatMonthLabel(peakPoint.monthKey) : '—'}
          </strong>
        </div>
      </div>
    </div>
  )
}

export function InsightsCategoryDonutChart({
  categories,
  total,
  currency,
}: InsightsCategoryDonutChartProps) {
  const slices = useMemo(() => buildDonutSlices(categories, total), [categories, total])
  const radius = (DONUT_SIZE - DONUT_STROKE_WIDTH) / 2
  const circumference = 2 * Math.PI * radius
  const renderedSlices = useMemo<DonutSliceRenderData[]>(() => {
    return slices.reduce<{
      accumulatedLength: number
      items: DonutSliceRenderData[]
    }>(
      (result, slice) => {
        const dashLength = slice.share * circumference
        const strokeDasharray = `${dashLength} ${circumference - dashLength}`
        const item: DonutSliceRenderData = {
          ...slice,
          strokeDasharray,
          strokeDashoffset: -result.accumulatedLength,
        }

        return {
          accumulatedLength: result.accumulatedLength + dashLength,
          items: [...result.items, item],
        }
      },
      {
        accumulatedLength: 0,
        items: [],
      },
    ).items
  }, [circumference, slices])

  return (
    <div className="insights-donut-shell">
      <div className="insights-donut-chart-wrap">
        <svg
          className="insights-donut-chart"
          viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
          role="img"
          aria-label="Top spending categories donut chart"
        >
          <circle
            className="insights-donut-track"
            cx={DONUT_SIZE / 2}
            cy={DONUT_SIZE / 2}
            r={radius}
          />

          <g transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}>
            {renderedSlices.map((slice, index) => {
              return (
                <circle
                  key={slice.id}
                  className="insights-donut-slice"
                  cx={DONUT_SIZE / 2}
                  cy={DONUT_SIZE / 2}
                  r={radius}
                  stroke={slice.color}
                  strokeDasharray={slice.strokeDasharray}
                  strokeDashoffset={slice.strokeDashoffset}
                  style={{ animationDelay: `${Math.min(0.24, index * 0.05)}s` }}
                />
              )
            })}
          </g>
        </svg>

        <div className="insights-donut-center" aria-hidden="true">
          <strong className="insights-donut-total">{formatCurrency(total, currency)}</strong>
          <span className="insights-donut-label">Total</span>
        </div>
      </div>

      <div className="insights-donut-list">
        {slices.map((slice) => (
          <div className="insights-donut-row" key={slice.id}>
            <div className="insights-donut-row-main">
              <span
                className="insights-donut-dot"
                aria-hidden="true"
                style={{ backgroundColor: slice.color }}
              />
              <div className="insights-donut-row-copy">
                <span className="insights-donut-row-name">{slice.name}</span>
                <span className="insights-donut-row-share">
                  {Math.round(slice.share * 100)}% of spend
                </span>
              </div>
            </div>

            <strong>{formatCurrency(slice.total, currency)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}