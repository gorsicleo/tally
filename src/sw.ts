/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { 
  cleanupOutdatedCaches, 
  precacheAndRoute, 
  createHandlerBoundToURL 
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST)

const handler = createHandlerBoundToURL('/index.html')
const navigationRoute = new NavigationRoute(handler)
registerRoute(navigationRoute)

registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    ['style', 'script', 'worker', 'font'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: 'tally-static-runtime',
  }),
)

registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    request.destination === 'image',
  new CacheFirst({
    cacheName: 'tally-images',
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
    cacheName: 'tally-api',
    networkTimeoutSeconds: 4,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 Days
      }),
    ],
  }),
)