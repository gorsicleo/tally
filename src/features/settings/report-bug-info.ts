import { getCurrentAppVersionInfo } from '../../pwa/app-version'

export const GITHUB_ISSUE_CHOOSER_URL = 'https://github.com/gorsicleo/tally/issues/new/choose'
export const GITHUB_PROJECT_URL = 'https://github.com/gorsicleo/tally'

export interface BugReportInfo {
  appName: string
  version: string | null
  installedPwa: boolean | null
  platform: string | null
  browser: string | null
  theme: string | null
  locale: string | null
  online: boolean | null
  viewport: string | null
  updateSeverity: string | null
  timestamp: string
}

interface BugReportInfoOptions {
  timestamp?: Date
  windowObject?: {
    innerWidth: number
    innerHeight: number
    matchMedia?: (query: string) => MediaQueryList
  }
  navigatorObject?: {
    userAgent?: string
    language?: string
    onLine?: boolean
    standalone?: boolean
  }
  documentObject?: {
    documentElement: {
      getAttribute: (name: string) => string | null
    }
  }
}

interface PwaInstallDetectionInput {
  navigatorObject?: {
    userAgent?: string
    standalone?: boolean
  }
  matchMedia?: (query: string) => MediaQueryList
}

function toYesNoUnknown(value: boolean | null): string {
  if (value === null) {
    return 'unknown'
  }

  return value ? 'yes' : 'no'
}

function normalizeValue(value: string | null | undefined): string {
  if (!value) {
    return 'unknown'
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : 'unknown'
}

function getBrowserVersion(userAgent: string, token: RegExp): string | null {
  const match = userAgent.match(token)
  return match?.[1] ?? null
}

export function detectPwaInstalled(input: PwaInstallDetectionInput = {}): boolean | null {
  const navigatorObject = input.navigatorObject
  const matchMedia = input.matchMedia

  if (typeof matchMedia !== 'function' && typeof navigatorObject?.standalone !== 'boolean') {
    return null
  }

  const standaloneMode =
    typeof matchMedia === 'function' &&
    matchMedia('(display-mode: standalone)').matches

  if (standaloneMode) {
    return true
  }

  return navigatorObject?.standalone === true
}

export function detectPlatformFamily(
  userAgent: string,
): string {
  const ua = userAgent.toLowerCase()

  if (/android/.test(ua)) {
    return 'Android'
  }

  if (/iphone|ipad|ipod/.test(ua)) {
    return 'iOS'
  }

  if (/windows/.test(ua)) {
    return 'Windows'
  }

  if (/mac os x|macintosh/.test(ua)) {
    return 'macOS'
  }

  if (/cros/.test(ua)) {
    return 'ChromeOS'
  }

  if (/linux/.test(ua)) {
    return 'Linux'
  }

  return 'Unknown'
}

export function summarizeBrowser(userAgent: string): string {
  const edgeVersion = getBrowserVersion(userAgent, /Edg\/([\d.]+)/)

  if (edgeVersion) {
    return `Edge ${edgeVersion}`
  }

  const operaVersion = getBrowserVersion(userAgent, /OPR\/([\d.]+)/)

  if (operaVersion) {
    return `Opera ${operaVersion}`
  }

  const firefoxVersion =
    getBrowserVersion(userAgent, /Firefox\/([\d.]+)/) ??
    getBrowserVersion(userAgent, /FxiOS\/([\d.]+)/)

  if (firefoxVersion) {
    return `Firefox ${firefoxVersion}`
  }

  const chromeVersion =
    getBrowserVersion(userAgent, /Chrome\/([\d.]+)/) ??
    getBrowserVersion(userAgent, /CriOS\/([\d.]+)/)

  if (chromeVersion) {
    return `Chrome ${chromeVersion}`
  }

  const safariVersion = getBrowserVersion(userAgent, /Version\/([\d.]+).*Safari/)

  if (safariVersion) {
    return `Safari ${safariVersion}`
  }

  return 'Unknown'
}

function getViewportSummary(windowObject?: {
  innerWidth: number
  innerHeight: number
}): string | null {
  if (!windowObject) {
    return null
  }

  const width = windowObject.innerWidth
  const height = windowObject.innerHeight

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null
  }

  const category = width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop'
  return `${width}x${height} (${category})`
}

function getTheme(documentObject?: {
  documentElement: {
    getAttribute: (name: string) => string | null
  }
}): string | null {
  const themeValue = documentObject?.documentElement.getAttribute('data-theme')

  if (!themeValue) {
    return null
  }

  const normalized = themeValue.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function getVersionOrNull(): string | null {
  try {
    const version = getCurrentAppVersionInfo().version.trim()
    return version.length > 0 ? version : null
  } catch {
    return null
  }
}

export function collectBugReportInfo(options: BugReportInfoOptions = {}): BugReportInfo {
  const defaultWindow = typeof window !== 'undefined'
    ? {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        matchMedia:
          typeof window.matchMedia === 'function'
            ? window.matchMedia.bind(window)
            : undefined,
      }
    : undefined
  const defaultNavigator = typeof navigator !== 'undefined'
    ? {
        userAgent: navigator.userAgent,
        language: navigator.language,
        onLine: navigator.onLine,
        standalone: (navigator as Navigator & { standalone?: boolean }).standalone,
      }
    : undefined
  const defaultDocument = typeof document !== 'undefined'
    ? {
        documentElement: {
          getAttribute: (name: string) => document.documentElement.getAttribute(name),
        },
      }
    : undefined

  const windowObject = options.windowObject ?? defaultWindow
  const navigatorObject = options.navigatorObject ?? defaultNavigator
  const documentObject = options.documentObject ?? defaultDocument

  const userAgent = navigatorObject?.userAgent ?? ''
  const installedPwa = detectPwaInstalled({
    navigatorObject,
    matchMedia: windowObject?.matchMedia,
  })

  return {
    appName: 'Tally',
    version: getVersionOrNull(),
    installedPwa,
    platform: userAgent ? detectPlatformFamily(userAgent) : null,
    browser: userAgent ? summarizeBrowser(userAgent) : null,
    theme: getTheme(documentObject),
    locale: navigatorObject?.language ?? null,
    online: typeof navigatorObject?.onLine === 'boolean' ? navigatorObject.onLine : null,
    viewport: getViewportSummary(windowObject),
    updateSeverity: typeof __APP_UPDATE_SEVERITY__ === 'string' ? __APP_UPDATE_SEVERITY__ : null,
    timestamp: (options.timestamp ?? new Date()).toISOString(),
  }
}

export function buildBugReportInfoText(info: BugReportInfo): string {
  return [
    `App: ${normalizeValue(info.appName)}`,
    `Version: ${normalizeValue(info.version)}`,
    `Update severity: ${normalizeValue(info.updateSeverity)}`,
    `Installed PWA: ${toYesNoUnknown(info.installedPwa)}`,
    `Platform: ${normalizeValue(info.platform)}`,
    `Browser: ${normalizeValue(info.browser)}`,
    `Theme: ${normalizeValue(info.theme)}`,
    `Locale: ${normalizeValue(info.locale)}`,
    `Online: ${toYesNoUnknown(info.online)}`,
    `Viewport: ${normalizeValue(info.viewport)}`,
    `Timestamp: ${normalizeValue(info.timestamp)}`,
  ].join('\n')
}

export function buildCurrentBugReportInfoText(now?: Date): string {
  const info = collectBugReportInfo({ timestamp: now })
  return buildBugReportInfoText(info)
}
