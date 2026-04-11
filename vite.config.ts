import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const require = createRequire(import.meta.url)
const packageJson = require('./package.json') as { version?: string }

type AppUpdateSeverity = 'minor' | 'recommended-backup' | 'backup-required'

const CHANGESET_DIR = '.changeset'
const nonFragmentChangesetFiles = new Set(['README.md', 'config.json'])
const severityPriority: Record<AppUpdateSeverity, number> = {
  minor: 0,
  'recommended-backup': 1,
  'backup-required': 2,
}
const fallbackChangelog = ['No changelog available']

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

function stripSeverityMarker(entry: string): {
  text: string
  severity: AppUpdateSeverity | null
} {
  const match = entry.match(/^\[severity:(minor|recommended-backup|backup-required)\]\s*/i)

  if (!match) {
    return {
      text: entry,
      severity: null,
    }
  }

  return {
    text: entry.replace(match[0], '').trim(),
    severity: parseSeverity(match[1].toLowerCase()),
  }
}

function parseChangesetBody(markdown: string): string {
  const frontmatterFence = /^---\s*$/m
  const firstFenceMatch = frontmatterFence.exec(markdown)

  if (!firstFenceMatch) {
    return markdown.trim()
  }

  const afterFirstFence = markdown.slice(firstFenceMatch.index + firstFenceMatch[0].length)
  const secondFenceMatch = frontmatterFence.exec(afterFirstFence)

  if (!secondFenceMatch) {
    return markdown.trim()
  }

  return afterFirstFence.slice(secondFenceMatch.index + secondFenceMatch[0].length).trim()
}

function getChangesetMetadata(): {
  changelog: string[]
  severity: AppUpdateSeverity
} {
  try {
    const changesetFiles = readdirSync(CHANGESET_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter(
        (name) => name.endsWith('.md') && !nonFragmentChangesetFiles.has(name),
      )
      .sort((left, right) => left.localeCompare(right))

    const changelogEntries: string[] = []
    let highestSeverity: AppUpdateSeverity = 'minor'
    let hasSeverityMarker = false

    for (const fileName of changesetFiles) {
      const markdown = readFileSync(join(CHANGESET_DIR, fileName), 'utf8')
      const body = parseChangesetBody(markdown)

      const bodyLines = body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => line.replace(/^[-*]\s+/, '').trim())
        .filter((line) => line.length > 0)

      for (const line of bodyLines) {
        const { text, severity } = stripSeverityMarker(line)

        if (severity) {
          hasSeverityMarker = true

          if (severityPriority[severity] > severityPriority[highestSeverity]) {
            highestSeverity = severity
          }
        }

        if (text.length > 0) {
          changelogEntries.push(text)
        }
      }
    }

    return {
      changelog: changelogEntries.length > 0 ? changelogEntries : fallbackChangelog,
      severity: hasSeverityMarker ? highestSeverity : 'recommended-backup',
    }
  } catch {
    return {
      changelog: fallbackChangelog,
      severity: 'recommended-backup',
    }
  }
}

export default defineConfig(() => {
  const changesetMetadata = getChangesetMetadata()
  const appVersion = process.env.VITE_APP_VERSION ?? packageJson.version ?? 'dev'
  const appChangelog =
    process.env.VITE_APP_CHANGELOG
      ?.split('|')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0) ?? changesetMetadata.changelog
  const appUpdateSeverity = process.env.VITE_APP_UPDATE_SEVERITY
    ? parseSeverity(process.env.VITE_APP_UPDATE_SEVERITY)
    : changesetMetadata.severity

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