import { formatCurrency } from '../../domain/formatters'

export const SENSITIVE_DATA_MASK = '••••'

export function shouldHideSensitiveValues(
  hideSensitiveData: boolean | undefined,
  sensitiveDataRevealedForSession: boolean,
): boolean {
  return hideSensitiveData === true && !sensitiveDataRevealedForSession
}

export function formatSensitiveCurrency(
  value: number,
  currency: string,
  hideSensitiveValuesNow: boolean,
): string {
  if (hideSensitiveValuesNow) {
    return SENSITIVE_DATA_MASK
  }

  return formatCurrency(value, currency)
}
