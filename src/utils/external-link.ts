export function openExternalUrl(
  url: string,
  windowObject?: {
    open: (url?: string | URL, target?: string, features?: string) => Window | null
    location: {
      assign: (url: string) => void
    }
  },
): boolean {
  const targetWindow = windowObject ?? (typeof window !== 'undefined' ? window : undefined)

  if (!targetWindow) {
    return false
  }

  try {
    const popup = targetWindow.open(url, '_blank', 'noopener,noreferrer')

    if (popup) {
      return true
    }

    targetWindow.location.assign(url)
    return true
  } catch {
    return false
  }
}
