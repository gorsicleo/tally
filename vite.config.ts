import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const require = createRequire(import.meta.url)
const packageJson = require('./package.json') as { version?: string }
const defaultChangelog = [
  'Improved offline update reliability.',
  'Safer cache cleanup between versions.',
  'New in-app update prompt with backup guidance.',
]

const severityWeight = {
  minor: 1,
  'recommended-backup': 2,
  'backup-required': 3,
} as const

interface ParsedChangelogInfo {
  entries: string[]
  severityFromEntries?: 'minor' | 'recommended-backup' | 'backup-required'
}

function parseSeverity(value: string | undefined) {
  if (
    value === 'minor' ||
    value === 'recommended-backup' ||
    value === 'backup-required'
  ) {
    return value
  }

  return 'recommended-backup'
}

function parseSeverityMarker(entry: string) {
  const match = entry.match(
    /^\[severity:(minor|recommended-backup|backup-required)\]\s*/i,
  )

  if (!match) {
    return {
      cleanedEntry: entry,
    }
  }

  return {
    cleanedEntry: entry.replace(match[0], '').trim(),
    severity: parseSeverity(match[1].toLowerCase()),
  }
}

function getLatestReleaseEntriesFromChangelog(): ParsedChangelogInfo {
  const changelogPath = path.resolve(process.cwd(), 'CHANGELOG.md')

  if (!existsSync(changelogPath)) {
    return { entries: [] }
  }

  const fileContent = readFileSync(changelogPath, 'utf8')
  const lines = fileContent.split('\n')

  const releaseStartIndex = lines.findIndex((line) => /^##\s+\[?\d+\.\d+\.\d+\]?/.test(line.trim()))

  if (releaseStartIndex < 0) {
    return { entries: [] }
  }

  const releaseEndIndex = lines
    .slice(releaseStartIndex + 1)
    .findIndex((line) => /^##\s+/.test(line.trim()))

  const releaseBlock = lines.slice(
    releaseStartIndex + 1,
    releaseEndIndex < 0 ? lines.length : releaseStartIndex + 1 + releaseEndIndex,
  )

  const parsedEntries = releaseBlock
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0)
    .map(parseSeverityMarker)

  const severityFromEntries = parsedEntries
    .map((entry) => entry.severity)
    .filter((severity): severity is 'minor' | 'recommended-backup' | 'backup-required' => Boolean(severity))
    .sort((left, right) => severityWeight[right] - severityWeight[left])[0]

  return {
    entries: parsedEntries.map((entry) => entry.cleanedEntry).filter((entry) => entry.length > 0),
    severityFromEntries,
  }
}

export default defineConfig(() => {
  const appVersion = process.env.VITE_APP_VERSION ?? packageJson.version ?? 'dev'
  const latestReleaseInfo = getLatestReleaseEntriesFromChangelog()
  const appChangelog =
    process.env.VITE_APP_CHANGELOG
      ?.split('|')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0) ??
    (latestReleaseInfo.entries.length > 0
      ? latestReleaseInfo.entries.slice(0, 3)
      : defaultChangelog)
  const appUpdateSeverity = parseSeverity(
    process.env.VITE_APP_UPDATE_SEVERITY ?? latestReleaseInfo.severityFromEntries,
  )

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __APP_CHANGELOG__: JSON.stringify(appChangelog),
      __APP_UPDATE_SEVERITY__: JSON.stringify(appUpdateSeverity),
    },
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        registerType: 'prompt',
        injectRegister: false,
        devOptions: {
          enabled: true,
          type: 'module',
        },
        includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
        manifest: {
          name: 'Tally',
          short_name: 'Tally',
          description:
            'Tally is a mobile-first finance tracker for categories, income, and expenses.',
          theme_color: '#0f766e',
          background_color: '#0f766e',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
      }),
    ],
    test: {
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['e2e/**'],
      environment: 'jsdom',
      setupFiles: ['./src/test/setup-tests.ts'],
      css: true,
      restoreMocks: true,
      clearMocks: true,
    },
  }
})