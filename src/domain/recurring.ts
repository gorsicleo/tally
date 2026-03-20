import type {
  Category,
  RecurringTemplate,
  RecurringFrequency,
} from './models'
import {
  compareLocalDateKeys,
  getTodayLocalDate,
  shiftLocalDateKey,
  shiftLocalMonthKey,
  sortLocalDateKeys,
} from '../utils/date'

const MAX_DUE_OCCURRENCES = 120

export interface DueRecurringOccurrence {
  templateId: string
  occurrenceDate: string
}

export interface DueRecurringGroup {
  template: RecurringTemplate
  category: Category | null
  title: string
  frequencyLabel: string
  occurrences: DueRecurringOccurrence[]
}

function normalizeRecurringIntervalDays(
  frequency: RecurringFrequency,
  intervalDays: number | null,
): number | null {
  if (frequency === 'monthly') {
    return null
  }

  return intervalDays && intervalDays > 0 ? Math.floor(intervalDays) : 1
}

export function isRecurringIntervalValid(
  frequency: RecurringFrequency,
  intervalDays: number | null,
): boolean {
  return frequency === 'monthly'
    ? true
    : Boolean(intervalDays && Number.isFinite(intervalDays) && intervalDays >= 1)
}

export function getRecurringTemplateLabel(
  template: Pick<RecurringTemplate, 'note' | 'type'>,
  categoryName?: string | null,
): string {
  const note = template.note.trim()

  if (note) {
    return note
  }

  if (categoryName) {
    return categoryName
  }

  return template.type === 'expense' ? 'Expense' : 'Income'
}

export function getRecurringFrequencyLabel(
  template: Pick<RecurringTemplate, 'frequency' | 'intervalDays'>,
): string {
  if (template.frequency === 'monthly') {
    return 'Monthly'
  }

  const intervalDays = normalizeRecurringIntervalDays(
    template.frequency,
    template.intervalDays,
  )

  return `Every ${intervalDays} day${intervalDays === 1 ? '' : 's'}`
}

export function getNextRecurringDate(
  template: Pick<RecurringTemplate, 'frequency' | 'intervalDays' | 'startDate'>,
  occurrenceDate: string,
): string {
  if (template.frequency === 'monthly') {
    const preferredDay = Number(template.startDate.slice(-2))

    return shiftLocalMonthKey(occurrenceDate, 1, preferredDay)
  }

  return shiftLocalDateKey(
    occurrenceDate,
    normalizeRecurringIntervalDays(template.frequency, template.intervalDays) ?? 1,
  )
}

export function getDueRecurringOccurrences(
  template: Pick<
    RecurringTemplate,
    'id' | 'active' | 'frequency' | 'intervalDays' | 'startDate' | 'nextDueDate'
  >,
  today = getTodayLocalDate(),
): DueRecurringOccurrence[] {
  if (!template.active || compareLocalDateKeys(template.nextDueDate, today) > 0) {
    return []
  }

  const occurrences: DueRecurringOccurrence[] = []
  let occurrenceDate = template.nextDueDate

  while (
    occurrences.length < MAX_DUE_OCCURRENCES &&
    compareLocalDateKeys(occurrenceDate, today) <= 0
  ) {
    occurrences.push({
      templateId: template.id,
      occurrenceDate,
    })

    occurrenceDate = getNextRecurringDate(template, occurrenceDate)
  }

  return occurrences
}

export function getProcessibleRecurringDates(
  template: Pick<
    RecurringTemplate,
    'id' | 'active' | 'frequency' | 'intervalDays' | 'startDate' | 'nextDueDate'
  >,
  requestedDates: string[],
  today = getTodayLocalDate(),
): string[] {
  const dueDates = getDueRecurringOccurrences(template, today).map(
    (occurrence) => occurrence.occurrenceDate,
  )
  const uniqueDates = sortLocalDateKeys([...new Set(requestedDates)])

  if (uniqueDates.length === 0 || uniqueDates.length > dueDates.length) {
    return []
  }

  return uniqueDates.every((date, index) => date === dueDates[index])
    ? uniqueDates
    : []
}

export function advanceRecurringNextDueDate(
  template: Pick<RecurringTemplate, 'frequency' | 'intervalDays' | 'startDate' | 'nextDueDate'>,
  processedCount: number,
): string {
  let nextDueDate = template.nextDueDate

  for (let index = 0; index < processedCount; index += 1) {
    nextDueDate = getNextRecurringDate(template, nextDueDate)
  }

  return nextDueDate
}

export function getDueRecurringGroups(
  templates: RecurringTemplate[],
  categories: Category[],
  today = getTodayLocalDate(),
): DueRecurringGroup[] {
  const categoriesById = new Map(categories.map((category) => [category.id, category]))

  return templates
    .filter((template) => template.active)
    .map((template) => {
      const category = categoriesById.get(template.categoryId) ?? null
      const occurrences = getDueRecurringOccurrences(template, today)

      return {
        template,
        category,
        title: getRecurringTemplateLabel(template, category?.name),
        frequencyLabel: getRecurringFrequencyLabel(template),
        occurrences,
      }
    })
    .filter((group) => group.occurrences.length > 0)
    .sort((left, right) => {
      const firstDateComparison = compareLocalDateKeys(
        left.occurrences[0].occurrenceDate,
        right.occurrences[0].occurrenceDate,
      )

      if (firstDateComparison !== 0) {
        return firstDateComparison
      }

      return left.title.localeCompare(right.title)
    })
}