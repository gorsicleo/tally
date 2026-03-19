function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
}

export function getTodayLocalDate(): string {
  return toLocalDateKey(new Date())
}

export function shiftLocalDateKey(isoDate: string, dayOffset: number): string {
  const shiftedDate = new Date(`${isoDate}T12:00:00`)
  shiftedDate.setDate(shiftedDate.getDate() + dayOffset)

  return toLocalDateKey(shiftedDate)
}
