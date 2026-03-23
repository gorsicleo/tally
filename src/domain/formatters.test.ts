import { describe, expect, it } from 'vitest'
import {
  formatCompactDateLabel,
  formatCurrency,
  formatDateLabel,
  formatDateTimeLabel,
  formatLongDateLabel,
  formatMonthLabel,
} from './formatters'

describe('formatters', () => {
  it('formats currency and falls back safely for unknown currency codes', () => {
    expect(formatCurrency(12.5, 'USD')).toContain('12.50')
    expect(formatCurrency(12.5, 'invalid-currency')).toContain('12.50')
  })

  it('formats date labels for different display variants', () => {
    expect(formatDateLabel('2026-03-20')).toMatch(/2026/)
    expect(formatLongDateLabel('2026-03-20')).toMatch(/2026/)
    expect(formatCompactDateLabel('2026-03-20')).toMatch(/20/)
  })

  it('formats null datetime as Never', () => {
    expect(formatDateTimeLabel(null)).toBe('Never')
  })

  it('formats month keys into readable month labels', () => {
    expect(formatMonthLabel('2026-03')).toMatch(/2026/)
  })
})