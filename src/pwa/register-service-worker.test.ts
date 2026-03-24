import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMockServiceWorker,
  createMockServiceWorkerRegistration,
  installMockServiceWorkerContainer,
} from '../test/update-test-utils'

const registerSwState = vi.hoisted(() => ({
  register: vi.fn(),
}))

vi.mock('virtual:pwa-register', () => ({
  registerSW: registerSwState.register,
}))

describe('registerServiceWorker', () => {
  beforeEach(() => {
    vi.resetModules()
    registerSwState.register.mockReset()
    window.localStorage.clear()
    installMockServiceWorkerContainer({ controller: {} as ServiceWorker })
    vi.stubGlobal('BroadcastChannel', undefined)
  })

  it('does nothing when service workers are not supported', async () => {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    })

    const module = await import('./register-service-worker')
    module.resetServiceWorkerUpdateStateForTests()

    module.registerServiceWorker()

    expect(registerSwState.register).not.toHaveBeenCalled()
  })

  it('does not report an update when registration has no waiting worker', async () => {
    const registration = createMockServiceWorkerRegistration()
    registerSwState.register.mockImplementation((options: { onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration) => void }) => {
      options.onRegisteredSW?.(
        '/sw.js',
        registration as unknown as ServiceWorkerRegistration,
      )
      return vi.fn()
    })

    const module = await import('./register-service-worker')
    module.resetServiceWorkerUpdateStateForTests()
    module.registerServiceWorker()

    expect(module.getServiceWorkerUpdateSnapshot().updateAvailable).toBe(false)
  })

  it('publishes waiting worker updates and sends skipWaiting on apply', async () => {
    const waitingWorker = createMockServiceWorker()
    const registration = createMockServiceWorkerRegistration({
      waiting: waitingWorker as unknown as ServiceWorker,
    })
    registerSwState.register.mockImplementation((options: { onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration) => void }) => {
      options.onRegisteredSW?.(
        '/sw.js',
        registration as unknown as ServiceWorkerRegistration,
      )
      return vi.fn()
    })

    const module = await import('./register-service-worker')
    module.resetServiceWorkerUpdateStateForTests()
    const updates: ReturnType<typeof module.getServiceWorkerUpdateSnapshot>[] = []
    module.subscribeToServiceWorkerUpdates((snapshot) => {
      updates.push(snapshot)
    })

    module.registerServiceWorker()

    expect(module.getServiceWorkerUpdateSnapshot().updateAvailable).toBe(true)

    await module.applyServiceWorkerUpdate()

    expect(waitingWorker.postMessage).toHaveBeenCalledWith({
      type: 'TALLY_SKIP_WAITING',
    })
    expect(updates.at(-1)?.isApplyingUpdate).toBe(true)
  })

  it('detects an installing worker that becomes installed after initial render', async () => {
    const installingWorker = createMockServiceWorker({ state: 'installing' })
    const registration = createMockServiceWorkerRegistration({
      installing: installingWorker as unknown as ServiceWorker,
    })
    registerSwState.register.mockImplementation((options: { onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration) => void }) => {
      options.onRegisteredSW?.(
        '/sw.js',
        registration as unknown as ServiceWorkerRegistration,
      )
      return vi.fn()
    })

    const module = await import('./register-service-worker')
    module.resetServiceWorkerUpdateStateForTests()
    module.registerServiceWorker()

    expect(module.getServiceWorkerUpdateSnapshot().updateAvailable).toBe(false)

    ;(installingWorker as { state: ServiceWorkerState }).state = 'installed'
    ;(registration as { waiting: ServiceWorker | null }).waiting =
      installingWorker as unknown as ServiceWorker
    installingWorker.dispatchStateChange()

    expect(module.getServiceWorkerUpdateSnapshot().updateAvailable).toBe(true)
  })

  it('ignores update application when the waiting worker cannot receive messages', async () => {
    const waitingWorker = { postMessage: undefined } as unknown as ServiceWorker
    const registration = createMockServiceWorkerRegistration({ waiting: waitingWorker })
    registerSwState.register.mockImplementation((options: { onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration) => void }) => {
      options.onRegisteredSW?.(
        '/sw.js',
        registration as unknown as ServiceWorkerRegistration,
      )
      return vi.fn()
    })

    const module = await import('./register-service-worker')
    module.resetServiceWorkerUpdateStateForTests()
    module.registerServiceWorker()

    await expect(module.applyServiceWorkerUpdate()).resolves.toBeUndefined()
    expect(module.getServiceWorkerUpdateSnapshot().isApplyingUpdate).toBe(false)
  })

  it('does not send duplicate skipWaiting messages when update is already applying', async () => {
    const waitingWorker = createMockServiceWorker()
    const registration = createMockServiceWorkerRegistration({
      waiting: waitingWorker as unknown as ServiceWorker,
    })
    registerSwState.register.mockImplementation((options: { onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration) => void }) => {
      options.onRegisteredSW?.(
        '/sw.js',
        registration as unknown as ServiceWorkerRegistration,
      )
      return vi.fn()
    })

    const module = await import('./register-service-worker')
    module.resetServiceWorkerUpdateStateForTests()
    module.registerServiceWorker()

    await module.applyServiceWorkerUpdate()
    await module.applyServiceWorkerUpdate()

    expect(
      waitingWorker.postMessage.mock.calls.filter(
        (call) => {
          const message = call[0]

          return (
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          message.type === 'TALLY_SKIP_WAITING'
          )
        },
      ),
    ).toHaveLength(1)
  })

  it('does not force a reload when another tab activates the new worker first', async () => {
    const activeWorker = createMockServiceWorker()
    const registration = createMockServiceWorkerRegistration({
      active: activeWorker as unknown as ServiceWorker,
    })
    registerSwState.register.mockImplementation((options: { onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration) => void }) => {
      options.onRegisteredSW?.(
        '/sw.js',
        registration as unknown as ServiceWorkerRegistration,
      )
      return vi.fn()
    })

    const reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        reload: reloadSpy,
      },
    })

    const module = await import('./register-service-worker')
    module.resetServiceWorkerUpdateStateForTests()
    module.registerServiceWorker()

    ;(window.navigator.serviceWorker as Navigator['serviceWorker'] & {
      dispatch: (type: string, payload?: unknown) => void
    }).dispatch('controllerchange')

    expect(reloadSpy).not.toHaveBeenCalled()
    expect(module.getServiceWorkerUpdateSnapshot().needsReload).toBe(true)
    expect(module.getServiceWorkerUpdateSnapshot().updateAvailable).toBe(true)
  })

  it('reloads only after controllerchange when the user started the update flow', async () => {
    const waitingWorker = createMockServiceWorker()
    const registration = createMockServiceWorkerRegistration({
      waiting: waitingWorker as unknown as ServiceWorker,
    })
    registerSwState.register.mockImplementation((options: { onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration) => void }) => {
      options.onRegisteredSW?.(
        '/sw.js',
        registration as unknown as ServiceWorkerRegistration,
      )
      return vi.fn()
    })

    const reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        reload: reloadSpy,
      },
    })

    const module = await import('./register-service-worker')
    module.resetServiceWorkerUpdateStateForTests()
    module.registerServiceWorker()

    await module.applyServiceWorkerUpdate()
    ;(window.navigator.serviceWorker as Navigator['serviceWorker'] & {
      dispatch: (type: string, payload?: unknown) => void
    }).dispatch('controllerchange')

    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('requests reload immediately when a later prompt is in reload-ready state', async () => {
    const reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        reload: reloadSpy,
      },
    })

    const module = await import('./register-service-worker')
    module.resetServiceWorkerUpdateStateForTests()
    module.simulateServiceWorkerUpdateForTests({ needsReload: true })

    await module.applyServiceWorkerUpdate()

    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('does not register twice when called repeatedly', async () => {
    const registration = createMockServiceWorkerRegistration()
    registerSwState.register.mockImplementation((options: { onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration) => void }) => {
      options.onRegisteredSW?.(
        '/sw.js',
        registration as unknown as ServiceWorkerRegistration,
      )
      return vi.fn()
    })

    const module = await import('./register-service-worker')
    module.resetServiceWorkerUpdateStateForTests()
    module.registerServiceWorker()
    module.registerServiceWorker()

    expect(registerSwState.register).toHaveBeenCalledTimes(1)
  })
})
