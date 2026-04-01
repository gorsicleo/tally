import { createRequire } from 'node:module'
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

export default defineConfig(() => {
  const appVersion = process.env.VITE_APP_VERSION ?? packageJson.version ?? 'dev'
  const appChangelog =
    process.env.VITE_APP_CHANGELOG
      ?.split('|')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0) ?? defaultChangelog
  const appUpdateSeverity = parseSeverity(process.env.VITE_APP_UPDATE_SEVERITY)

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