/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string
declare const __APP_CHANGELOG__: readonly string[]
declare const __APP_UPDATE_SEVERITY__: 'minor' | 'recommended-backup' | 'backup-required'