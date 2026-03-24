import { createLocalNoonDate } from '../utils/date'

const currencyFormatters = new Map<string, Intl.NumberFormat>()

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const longDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const compactDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  year: 'numeric',
})

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  const upperCurrency = currency.toUpperCase()
  const cachedFormatter = currencyFormatters.get(upperCurrency)

  if (cachedFormatter) {
    return cachedFormatter
  }

  let formatter: Intl.NumberFormat

  try {
    formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: upperCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  } catch {
    formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  currencyFormatters.set(upperCurrency, formatter)

  return formatter
}

export function formatCurrency(value: number, currency = 'USD'): string {
  return getCurrencyFormatter(currency).format(value)
}

export function formatDateLabel(isoDate: string): string {
  return dateFormatter.format(createLocalNoonDate(isoDate))
}

export function formatLongDateLabel(isoDate: string): string {
  return longDateFormatter.format(createLocalNoonDate(isoDate))
}

export function formatCompactDateLabel(isoDate: string): string {
  return compactDateFormatter.format(createLocalNoonDate(isoDate))
}

export function formatDateTimeLabel(value: string | null): string {
  if (!value) {
    return 'Never'
  }

  return dateTimeFormatter.format(new Date(value))
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)

  return monthFormatter.format(new Date(year, month - 1, 1))
}
