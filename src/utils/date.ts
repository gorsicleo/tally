function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

const LOCAL_NOON_SUFFIX = 'T12:00:00'

export function createLocalNoonDate(isoDate: string): Date {
  return new Date(`${isoDate}${LOCAL_NOON_SUFFIX}`)
}

function parseLocalDateKey(isoDate: string): {
  year: number
  month: number
  day: number
} {
  const [year, month, day] = isoDate.split('-').map(Number)

  return { year, month, day }
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
}

export function getTodayLocalDate(): string {
  return toLocalDateKey(new Date())
}

export function shiftLocalDateKey(isoDate: string, dayOffset: number): string {
  const shiftedDate = createLocalNoonDate(isoDate)
  shiftedDate.setDate(shiftedDate.getDate() + dayOffset)

  return toLocalDateKey(shiftedDate)
}

export function shiftLocalMonthKey(
  isoDate: string,
  monthOffset: number,
  preferredDay?: number,
): string {
  const { year, month, day } = parseLocalDateKey(isoDate)
  const shiftedDate = new Date(year, month - 1 + monthOffset, 1)
  const targetYear = shiftedDate.getFullYear()
  const targetMonth = shiftedDate.getMonth() + 1
  const targetDay = Math.min(
    preferredDay ?? day,
    getDaysInMonth(targetYear, targetMonth),
  )

  return `${targetYear}-${padDatePart(targetMonth)}-${padDatePart(targetDay)}`
}

export function compareLocalDateKeys(left: string, right: string): number {
  return left.localeCompare(right)
}

export function sortLocalDateKeys(dates: string[]): string[] {
  return [...dates].sort(compareLocalDateKeys)
}
