import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppVersionInfo } from './app-version'
import {
  applyServiceWorkerUpdate,
  getCurrentVersionInfo,
  getServiceWorkerUpdateSnapshot,
  subscribeToServiceWorkerUpdates,
} from './register-service-worker'

const UPDATE_DISMISS_KEY = 'tally:update-dismissed'
const UPDATE_SYNC_CHANNEL = 'tally-update-prompts'
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 6

interface DismissedUpdateRecord {
  version: string
  dismissedAt: number
}

interface ServiceWorkerUpdateState {
  updateAvailable: boolean
  needsReload: boolean
  isApplyingUpdate: boolean
  currentVersionInfo: AppVersionInfo
  availableVersionInfo: AppVersionInfo | null
  promptVisible: boolean
  isIosStandalone: boolean
  dismiss: () => void
  applyUpdate: () => Promise<void>
}

function readDismissedUpdate(): DismissedUpdateRecord | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(UPDATE_DISMISS_KEY)

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DismissedUpdateRecord>

    if (
      typeof parsed.version !== 'string' ||
      typeof parsed.dismissedAt !== 'number'
    ) {
      return null
    }

    return {
      version: parsed.version,
      dismissedAt: parsed.dismissedAt,
    }
  } catch {
    return null
  }
}

function writeDismissedUpdate(record: DismissedUpdateRecord) {
  if (typeof window === 'undefined') {
    return
  }

  const serialized = JSON.stringify(record)
  window.localStorage.setItem(UPDATE_DISMISS_KEY, serialized)

  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(UPDATE_SYNC_CHANNEL)
    channel.postMessage(record)
    channel.close()
  }
}

function isDismissedForVersion(
  dismissedUpdate: DismissedUpdateRecord | null,
  version: string | null,
) {
  if (!dismissedUpdate || !version) {
    return false
  }

  return (
    dismissedUpdate.version === version &&
    Date.now() - dismissedUpdate.dismissedAt < DISMISS_COOLDOWN_MS
  )
}

function detectIosStandalone() {
  if (typeof window === 'undefined') {
    return false
  }

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean
  }
  const platform = window.navigator.userAgent.toLowerCase()
  const isIos = /iphone|ipad|ipod/.test(platform)

  return isIos && navigatorWithStandalone.standalone === true
}

export function useServiceWorkerUpdate(): ServiceWorkerUpdateState {
  const [snapshot, setSnapshot] = useState(() => getServiceWorkerUpdateSnapshot())
  const [dismissedUpdate, setDismissedUpdate] = useState<DismissedUpdateRecord | null>(
    () => readDismissedUpdate(),
  )

  useEffect(() => subscribeToServiceWorkerUpdates(setSnapshot), [])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== UPDATE_DISMISS_KEY) {
        return
      }

      setDismissedUpdate(readDismissedUpdate())
    }

    window.addEventListener('storage', handleStorage)

    if (typeof BroadcastChannel === 'undefined') {
      return () => {
        window.removeEventListener('storage', handleStorage)
      }
    }

    const channel = new BroadcastChannel(UPDATE_SYNC_CHANNEL)
    channel.addEventListener('message', (event) => {
      const value = event.data as DismissedUpdateRecord

      if (
        typeof value?.version === 'string' &&
        typeof value?.dismissedAt === 'number'
      ) {
        setDismissedUpdate(value)
      }
    })

    return () => {
      window.removeEventListener('storage', handleStorage)
      channel.close()
    }
  }, [])

  const availableVersionInfo =
    snapshot.availableVersionInfo ??
    (snapshot.updateAvailable ? getCurrentVersionInfo() : null)

  const availableVersion = availableVersionInfo?.version ?? null

  useEffect(() => {
    if (!availableVersion) {
      return
    }

    if (!isDismissedForVersion(dismissedUpdate, availableVersion)) {
      return
    }

    if (dismissedUpdate?.version !== availableVersion) {
      setDismissedUpdate(null)
    }
  }, [availableVersion, dismissedUpdate])

  const dismiss = useCallback(() => {
    if (!availableVersion) {
      return
    }

    const nextRecord = {
      version: availableVersion,
      dismissedAt: Date.now(),
    }
    setDismissedUpdate(nextRecord)
    writeDismissedUpdate(nextRecord)
  }, [availableVersion])

  const applyUpdate = useCallback(async () => {
    await applyServiceWorkerUpdate()
  }, [])

  const promptVisible = useMemo(
    () =>
      snapshot.updateAvailable &&
      !isDismissedForVersion(dismissedUpdate, availableVersion),
    [availableVersion, dismissedUpdate, snapshot.updateAvailable],
  )

  return {
    updateAvailable: snapshot.updateAvailable,
    needsReload: snapshot.needsReload,
    isApplyingUpdate: snapshot.isApplyingUpdate,
    currentVersionInfo: snapshot.currentVersionInfo,
    availableVersionInfo,
    promptVisible,
    isIosStandalone: detectIosStandalone(),
    dismiss,
    applyUpdate,
  }
}
