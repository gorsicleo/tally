import { useCallback, useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import {
  getCurrentAppVersionInfo,
  type AppVersionInfo,
} from './app-version'

declare global {
  interface Window {
    __tallyUpdateTestHooks?: {
      reset: () => void
      setReloadSuppressed: (suppressed: boolean) => void
      simulateUpdate: (input?: {
        availableVersionInfo?: Partial<AppVersionInfo> | null
        updateAvailable?: boolean
        needsReload?: boolean
        isApplyingUpdate?: boolean
        withMockWaitingWorker?: boolean
      }) => void
      dispatchControllerChange: () => void
      getState: () => {
        snapshot: ServiceWorkerUpdateSnapshot
        reloadRequestCount: number
        workerMessages: unknown[]
      }
    }
  }
}

interface BeforeInstallPromptEvent extends Event {
  platforms: string[]
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt: () => Promise<void>
}

let swRegistered = false

interface ServiceWorkerUpdateSnapshot {
  updateAvailable: boolean
  needsReload: boolean
  isApplyingUpdate: boolean
  currentVersionInfo: AppVersionInfo
  availableVersionInfo: AppVersionInfo | null
}

type ServiceWorkerUpdateListener = (
  snapshot: ServiceWorkerUpdateSnapshot,
) => void

const SERVICE_WORKER_MESSAGE_TYPES = {
  getVersionInfo: 'TALLY_GET_VERSION_INFO',
  skipWaiting: 'TALLY_SKIP_WAITING',
  versionInfo: 'TALLY_APP_VERSION_INFO',
} as const

const currentVersionInfo = getCurrentAppVersionInfo()

let serviceWorkerRegistration: ServiceWorkerRegistration | null = null
let waitingWorker: ServiceWorker | null = null
let activeWorker: ServiceWorker | null = null
let hadControllerBeforeRegistration = false
let controllerChangeHandled = false
let visibilityListenersRegistered = false
let reloadRequestCount = 0
let suppressReloadForTesting = false
let testWorkerMessages: unknown[] = []
const updateListeners = new Set<ServiceWorkerUpdateListener>()

let serviceWorkerUpdateSnapshot: ServiceWorkerUpdateSnapshot = {
  updateAvailable: false,
  needsReload: false,
  isApplyingUpdate: false,
  currentVersionInfo,
  availableVersionInfo: null,
}

function emitUpdateSnapshot() {
  for (const listener of updateListeners) {
    listener(serviceWorkerUpdateSnapshot)
  }
}

function hasServiceWorkerSupport() {
  return (
    typeof window !== 'undefined' &&
    typeof window.navigator !== 'undefined' &&
    'serviceWorker' in window.navigator &&
    window.navigator.serviceWorker !== undefined
  )
}

function setUpdateSnapshot(
  patch: Partial<ServiceWorkerUpdateSnapshot>,
) {
  serviceWorkerUpdateSnapshot = {
    ...serviceWorkerUpdateSnapshot,
    ...patch,
  }
  emitUpdateSnapshot()
}

function isVersionInfo(value: unknown): value is AppVersionInfo {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<AppVersionInfo>

  return (
    typeof candidate.version === 'string' &&
    Array.isArray(candidate.changelog) &&
    (candidate.severity === 'minor' ||
      candidate.severity === 'recommended-backup' ||
      candidate.severity === 'backup-required')
  )
}

function postMessageToWorker(
  worker: Pick<ServiceWorker, 'postMessage'> | null | undefined,
  message: unknown,
) {
  if (!worker || typeof worker.postMessage !== 'function') {
    return false
  }

  worker.postMessage(message)
  return true
}

function requestVersionInfo(worker: ServiceWorker | null) {
  postMessageToWorker(worker, {
    type: SERVICE_WORKER_MESSAGE_TYPES.getVersionInfo,
  })
}

function announceWaitingWorker(worker: ServiceWorker | null) {
  waitingWorker = worker

  if (!worker) {
    setUpdateSnapshot({
      updateAvailable: false,
      needsReload: false,
      availableVersionInfo: null,
    })
    return
  }

  setUpdateSnapshot({
    updateAvailable: true,
    needsReload: false,
  })
  requestVersionInfo(worker)
}

function inspectRegistration(registration: ServiceWorkerRegistration | null) {
  serviceWorkerRegistration = registration

  if (!registration) {
    return
  }

  activeWorker = registration.active ?? activeWorker

  if (registration.waiting) {
    announceWaitingWorker(registration.waiting)
    return
  }

  if (!registration.installing) {
    return
  }

  const installingWorker = registration.installing

  const handleInstallingStateChange = () => {
    if (
      installingWorker.state === 'installed' &&
      window.navigator.serviceWorker.controller
    ) {
      announceWaitingWorker(registration.waiting ?? installingWorker)
    }
  }

  installingWorker.addEventListener('statechange', handleInstallingStateChange)
}

function handleServiceWorkerMessage(event: MessageEvent) {
  const payload = event.data as {
    type?: string
    payload?: unknown
  }

  if (payload?.type !== SERVICE_WORKER_MESSAGE_TYPES.versionInfo) {
    return
  }

  if (!isVersionInfo(payload.payload)) {
    return
  }

  setUpdateSnapshot({
    availableVersionInfo: payload.payload,
  })
}

function handleControllerChange() {
  if (controllerChangeHandled) {
    return
  }

  // A first-time install can claim clients and become the initial controller.
  // That first acquisition is not an app update and should not show reload UX.
  if (
    !serviceWorkerUpdateSnapshot.isApplyingUpdate &&
    !hadControllerBeforeRegistration
  ) {
    hadControllerBeforeRegistration = true

    if (serviceWorkerRegistration?.active) {
      activeWorker = serviceWorkerRegistration.active
      requestVersionInfo(activeWorker)
    }

    return
  }

  controllerChangeHandled = true

  if (serviceWorkerUpdateSnapshot.isApplyingUpdate) {
    requestReload()
    return
  }

  if (serviceWorkerRegistration?.active) {
    activeWorker = serviceWorkerRegistration.active
    requestVersionInfo(activeWorker)
  }

  setUpdateSnapshot({
    updateAvailable: true,
    needsReload: true,
  })
}

function requestReload() {
  reloadRequestCount += 1
  window.dispatchEvent(
    new CustomEvent('tally:update-reload-requested', {
      detail: { count: reloadRequestCount },
    }),
  )

  if (suppressReloadForTesting) {
    return
  }

  window.location.reload()
}

function registerUpdateCheckTriggers() {
  if (visibilityListenersRegistered) {
    return
  }

  visibilityListenersRegistered = true

  const checkForUpdates = () => {
    void serviceWorkerRegistration?.update()
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdates()
    }
  })
  window.addEventListener('online', checkForUpdates)
}

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !hasServiceWorkerSupport()) {
    return
  }

  if (swRegistered) {
    return
  }

  hadControllerBeforeRegistration =
    window.navigator.serviceWorker.controller !== null

  swRegistered = true

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      inspectRegistration(registration ?? null)
      registerUpdateCheckTriggers()
    },
    onNeedRefresh() {
      inspectRegistration(serviceWorkerRegistration)
    },
    onRegisterError(error: unknown) {
      console.error('Service worker registration failed:', error)
    },
  })

  window.navigator.serviceWorker.addEventListener(
    'controllerchange',
    handleControllerChange,
  )
  window.navigator.serviceWorker.addEventListener(
    'message',
    handleServiceWorkerMessage,
  )

  ensureTestingHooks()
}

export function getCurrentVersionInfo() {
  return currentVersionInfo
}

export function getServiceWorkerUpdateSnapshot() {
  return serviceWorkerUpdateSnapshot
}

export function subscribeToServiceWorkerUpdates(
  listener: ServiceWorkerUpdateListener,
) {
  updateListeners.add(listener)
  listener(serviceWorkerUpdateSnapshot)

  return () => {
    updateListeners.delete(listener)
  }
}

export async function applyServiceWorkerUpdate() {
  if (serviceWorkerUpdateSnapshot.isApplyingUpdate) {
    return
  }

  if (serviceWorkerUpdateSnapshot.needsReload) {
    requestReload()
    return
  }

  const nextWaitingWorker = serviceWorkerRegistration?.waiting ?? waitingWorker

  if (!nextWaitingWorker) {
    return
  }

  if (typeof nextWaitingWorker.postMessage !== 'function') {
    return
  }

  controllerChangeHandled = false
  setUpdateSnapshot({ isApplyingUpdate: true })
  nextWaitingWorker.postMessage({
    type: SERVICE_WORKER_MESSAGE_TYPES.skipWaiting,
  })
}

export function resetServiceWorkerUpdateStateForTests() {
  serviceWorkerRegistration = null
  waitingWorker = null
  activeWorker = null
  hadControllerBeforeRegistration = false
  controllerChangeHandled = false
  visibilityListenersRegistered = false
  reloadRequestCount = 0
  suppressReloadForTesting = false
  testWorkerMessages = []
  swRegistered = false
  updateListeners.clear()
  serviceWorkerUpdateSnapshot = {
    updateAvailable: false,
    needsReload: false,
    isApplyingUpdate: false,
    currentVersionInfo,
    availableVersionInfo: null,
  }
}

export function setReloadSuppressedForTests(suppressed: boolean) {
  suppressReloadForTesting = suppressed
}

export function simulateServiceWorkerUpdateForTests(input?: {
  availableVersionInfo?: Partial<AppVersionInfo> | null
  updateAvailable?: boolean
  needsReload?: boolean
  isApplyingUpdate?: boolean
  waitingWorkerOverride?: ServiceWorker | null
  withMockWaitingWorker?: boolean
}) {
  const availableVersionInfo = input?.availableVersionInfo
  waitingWorker =
    input?.waitingWorkerOverride ??
    (input?.withMockWaitingWorker
      ? ({
          postMessage(message: unknown) {
            testWorkerMessages.push(message)
          },
        } as ServiceWorker)
      : waitingWorker)
  setUpdateSnapshot({
    updateAvailable: input?.updateAvailable ?? true,
    needsReload: input?.needsReload ?? false,
    isApplyingUpdate: input?.isApplyingUpdate ?? false,
    availableVersionInfo:
      availableVersionInfo === undefined
        ? currentVersionInfo
        : availableVersionInfo === null
          ? null
          : ({
              version: availableVersionInfo.version ?? currentVersionInfo.version,
              changelog:
                Array.isArray(availableVersionInfo.changelog)
                  ? availableVersionInfo.changelog.filter(
                      (entry): entry is string => typeof entry === 'string',
                    )
                  : currentVersionInfo.changelog,
              severity:
                availableVersionInfo.severity ?? currentVersionInfo.severity,
            } as AppVersionInfo),
  })
}

export function dispatchControllerChangeForTests() {
  handleControllerChange()
}

function ensureTestingHooks() {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return
  }

  if (window.__tallyUpdateTestHooks) {
    return
  }

  window.__tallyUpdateTestHooks = {
    reset: resetServiceWorkerUpdateStateForTests,
    setReloadSuppressed: setReloadSuppressedForTests,
    simulateUpdate: simulateServiceWorkerUpdateForTests,
    dispatchControllerChange: dispatchControllerChangeForTests,
    getState: () => ({
      snapshot: getServiceWorkerUpdateSnapshot(),
      reloadRequestCount,
      workerMessages: [...testWorkerMessages],
    }),
  }
}

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null)

  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    )
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)')

    const updateInstalledState = () => {
      const iosStandalone =
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true

      setIsInstalled(mediaQuery.matches || iosStandalone)
    }

    const handleBeforeInstallPrompt: EventListener = (event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }

    const handleInstalled = () => {
      setIsInstalled(true)
      setPromptEvent(null)
    }

    updateInstalledState()

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    mediaQuery.addEventListener?.('change', updateInstalledState)

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      )
      window.removeEventListener('appinstalled', handleInstalled)
      mediaQuery.removeEventListener?.('change', updateInstalledState)
    }
  }, [])

  const install = useCallback(async () => {
    if (!promptEvent) {
      return
    }

    await promptEvent.prompt()
    const choice = await promptEvent.userChoice

    if (choice.outcome === 'accepted') {
      setIsInstalled(true)
    }

    setPromptEvent(null)
  }, [promptEvent])

  return {
    canInstall: Boolean(promptEvent) && !isInstalled,
    isInstalled,
    install,
  }
}