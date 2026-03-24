/// <reference lib="webworker" />

import { cacheNames, clientsClaim, setCacheNameDetails } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { getCurrentAppVersionInfo } from './pwa/app-version'

declare let self: ServiceWorkerGlobalScope

const APP_VERSION_INFO = getCurrentAppVersionInfo()
const CACHE_PREFIX = 'tally'

setCacheNameDetails({
  prefix: CACHE_PREFIX,
  suffix: APP_VERSION_INFO.version,
  precache: 'precache',
  runtime: 'runtime',
})

clientsClaim()
cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST)

const runtimeCacheNames = {
  static: `${CACHE_PREFIX}-static-runtime-${APP_VERSION_INFO.version}`,
  images: `${CACHE_PREFIX}-images-${APP_VERSION_INFO.version}`,
  api: `${CACHE_PREFIX}-api-${APP_VERSION_INFO.version}`,
}

const currentCaches = new Set([
  cacheNames.precache,
  cacheNames.runtime,
  runtimeCacheNames.static,
  runtimeCacheNames.images,
  runtimeCacheNames.api,
])

// Updates stay user-driven until the app explicitly asks the waiting worker to activate.
self.addEventListener('message', (event) => {
  const payload = event.data as { type?: string } | undefined

  if (payload?.type === 'TALLY_SKIP_WAITING') {
    void self.skipWaiting()
    return
  }

  if (payload?.type === 'TALLY_GET_VERSION_INFO' && event.source) {
    if ('postMessage' in event.source) {
      event.source.postMessage({
        type: 'TALLY_APP_VERSION_INFO',
        payload: APP_VERSION_INFO,
      })
    }
  }
})

// Old versioned caches are removed once the new worker is activated.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys()

      await Promise.all(
        cacheKeys.map((cacheKey) => {
          if (!cacheKey.startsWith(`${CACHE_PREFIX}-`)) {
            return Promise.resolve(false)
          }

          if (currentCaches.has(cacheKey)) {
            return Promise.resolve(false)
          }

          return caches.delete(cacheKey)
        }),
      )
    })(),
  )
})

const handler = createHandlerBoundToURL('/index.html')
const navigationRoute = new NavigationRoute(handler)
registerRoute(navigationRoute)

registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    ['style', 'script', 'worker', 'font'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: runtimeCacheNames.static,
  }),
)

registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    request.destination === 'image',
  new CacheFirst({
    cacheName: runtimeCacheNames.images,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
      }),
    ],
  }),
)

registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    request.method === 'GET' &&
    url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: runtimeCacheNames.api,
    networkTimeoutSeconds: 4,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 Days
      }),
    ],
  }),
)