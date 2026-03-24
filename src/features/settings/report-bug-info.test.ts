import { describe, expect, it } from 'vitest'
import {
  buildBugReportInfoText,
  collectBugReportInfo,
  detectPwaInstalled,
  detectPlatformFamily,
  summarizeBrowser,
} from './report-bug-info'

describe('report-bug-info', () => {
  it('builds a readable diagnostics block when full metadata is available', () => {
    const text = buildBugReportInfoText({
      appName: 'Tally',
      version: '1.2.3',
      buildIdentifier: 'minor',
      installedPwa: true,
      platform: 'Android',
      browser: 'Chrome 125.0',
      theme: 'dark',
      locale: 'en-US',
      online: true,
      viewport: '390x844 (mobile)',
      timestamp: '2026-03-24T10:20:30.000Z',
    })

    expect(text).toContain('App: Tally')
    expect(text).toContain('Version: 1.2.3')
    expect(text).toContain('Installed PWA: yes')
    expect(text).toContain('Online: yes')
    expect(text).toContain('Viewport: 390x844 (mobile)')
  })

  it('falls back to unknown for optional metadata', () => {
    const text = buildBugReportInfoText({
      appName: 'Tally',
      version: null,
      buildIdentifier: null,
      installedPwa: null,
      platform: null,
      browser: null,
      theme: null,
      locale: null,
      online: null,
      viewport: null,
      timestamp: '2026-03-24T10:20:30.000Z',
    })

    expect(text).toContain('Version: unknown')
    expect(text).toContain('Build: unknown')
    expect(text).toContain('Installed PWA: unknown')
    expect(text).toContain('Theme: unknown')
  })

  it('formats installed and online flags as yes or no', () => {
    const installedNo = buildBugReportInfoText({
      appName: 'Tally',
      version: '1.0.0',
      buildIdentifier: 'minor',
      installedPwa: false,
      platform: 'Linux',
      browser: 'Firefox 120',
      theme: 'light',
      locale: 'en-US',
      online: false,
      viewport: '1280x900 (desktop)',
      timestamp: '2026-03-24T10:20:30.000Z',
    })

    expect(installedNo).toContain('Installed PWA: no')
    expect(installedNo).toContain('Online: no')
  })

  it('does not include transaction or budget content in diagnostics output', () => {
    const text = buildBugReportInfoText({
      appName: 'Tally',
      version: '1.0.0',
      buildIdentifier: 'minor',
      installedPwa: false,
      platform: 'Linux',
      browser: 'Chrome 120',
      theme: 'light',
      locale: 'en-US',
      online: true,
      viewport: '1280x900 (desktop)',
      timestamp: '2026-03-24T10:20:30.000Z',
    })

    expect(text.toLowerCase()).not.toContain('transaction')
    expect(text.toLowerCase()).not.toContain('budget')
    expect(text.toLowerCase()).not.toContain('category')
  })

  it('detects platform and browser summaries from common user agents', () => {
    expect(
      detectPlatformFamily(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
      ),
    ).toBe('iOS')
    expect(summarizeBrowser('Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36')).toBe(
      'Chrome 125.0.0.0',
    )
    expect(
      summarizeBrowser('Mozilla/5.0 (Macintosh) Version/17.2 Safari/605.1.15'),
    ).toBe('Safari 17.2')
  })

  it('detects installed PWA from display mode or iOS standalone flag', () => {
    const displayModeInstalled = detectPwaInstalled({
      navigatorObject: { userAgent: 'Mozilla/5.0' },
      matchMedia: () => ({ matches: true } as MediaQueryList),
    })

    const iosInstalled = detectPwaInstalled({
      navigatorObject: {
        userAgent: 'Mozilla/5.0 (iPhone)',
        standalone: true,
      },
      matchMedia: () => ({ matches: false } as MediaQueryList),
    })

    const notInstalled = detectPwaInstalled({
      navigatorObject: { userAgent: 'Mozilla/5.0', standalone: false },
      matchMedia: () => ({ matches: false } as MediaQueryList),
    })

    expect(displayModeInstalled).toBe(true)
    expect(iosInstalled).toBe(true)
    expect(notInstalled).toBe(false)
  })

  it('collects diagnostics even when optional browser APIs are missing', () => {
    const info = collectBugReportInfo({
      timestamp: new Date('2026-03-24T10:20:30.000Z'),
      windowObject: {
        innerWidth: 390,
        innerHeight: 844,
        matchMedia: () => ({ matches: false } as MediaQueryList),
      },
      navigatorObject: {
        userAgent: 'Mozilla/5.0 (Linux) Chrome/126.0.0.0 Safari/537.36',
        language: 'en-US',
        onLine: true,
      },
      documentObject: {
        documentElement: {
          getAttribute: () => null,
        },
      },
    })

    expect(info.version).toBeTypeOf('string')
    expect(info.theme).toBeNull()
    expect(info.locale).toBe('en-US')
    expect(info.viewport).toBe('390x844 (mobile)')
    expect(info.online).toBe(true)
  })
})
