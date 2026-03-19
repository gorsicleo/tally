import { useCallback, useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

interface BeforeInstallPromptEvent extends Event {
  platforms: string[]
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt: () => Promise<void>
}

let swRegistered = false

export function registerServiceWorker(): void {
  if (typeof window === 'undefined') {
    return
  }

  if (swRegistered) {
    return
  }

  swRegistered = true

  registerSW({
    immediate: true,
    onRegisterError(error: unknown) {
      console.error('Service worker registration failed:', error)
    },
  })
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