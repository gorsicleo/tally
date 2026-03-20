import { describe, expect, it } from 'vitest'
import {
  advanceRecurringNextDueDate,
  getDueRecurringOccurrences,
  getNextRecurringDate,
  getProcessibleRecurringDates,
} from './recurring'

describe('recurring date math', () => {
  it('advances monthly schedules with month-end clamping while preserving the original anchor day', () => {
    const template = {
      id: 'rec-rent',
      active: true,
      frequency: 'monthly' as const,
      intervalDays: null,
      startDate: '2026-01-31',
      nextDueDate: '2026-01-31',
    }

    expect(getNextRecurringDate(template, '2026-01-31')).toBe('2026-02-28')
    expect(getNextRecurringDate(template, '2026-02-28')).toBe('2026-03-31')
  })

  it('advances custom schedules by the configured day interval', () => {
    const template = {
      id: 'rec-subscription',
      active: true,
      frequency: 'custom' as const,
      intervalDays: 10,
      startDate: '2026-03-01',
      nextDueDate: '2026-03-01',
    }

    expect(getNextRecurringDate(template, '2026-03-01')).toBe('2026-03-11')
  })
})

describe('due occurrence generation', () => {
  it('returns all due occurrences for missed monthly periods', () => {
    const template = {
      id: 'rec-rent',
      active: true,
      frequency: 'monthly' as const,
      intervalDays: null,
      startDate: '2026-01-05',
      nextDueDate: '2026-01-05',
    }

    expect(getDueRecurringOccurrences(template, '2026-03-20')).toEqual([
      { templateId: 'rec-rent', occurrenceDate: '2026-01-05' },
      { templateId: 'rec-rent', occurrenceDate: '2026-02-05' },
      { templateId: 'rec-rent', occurrenceDate: '2026-03-05' },
    ])
  })

  it('only allows processing a contiguous prefix of due occurrences', () => {
    const template = {
      id: 'rec-rent',
      active: true,
      frequency: 'monthly' as const,
      intervalDays: null,
      startDate: '2026-01-05',
      nextDueDate: '2026-01-05',
    }

    expect(
      getProcessibleRecurringDates(
        template,
        ['2026-01-05', '2026-02-05'],
        '2026-03-20',
      ),
    ).toEqual(['2026-01-05', '2026-02-05'])

    expect(
      getProcessibleRecurringDates(
        template,
        ['2026-02-05'],
        '2026-03-20',
      ),
    ).toEqual([])
  })

  it('advances next due dates by the number of processed occurrences', () => {
    const template = {
      id: 'rec-streaming',
      active: true,
      frequency: 'custom' as const,
      intervalDays: 7,
      startDate: '2026-03-01',
      nextDueDate: '2026-03-01',
    }

    expect(advanceRecurringNextDueDate(template, 3)).toBe('2026-03-22')
  })
})