import { vi } from 'vitest'

export interface MockServiceWorker {
  state: ServiceWorkerState
  postMessage: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  dispatchStateChange: () => void
}

export interface MockServiceWorkerRegistration {
  waiting: ServiceWorker | null
  installing: ServiceWorker | null
  active: ServiceWorker | null
  update: ReturnType<typeof vi.fn>
}

export interface MockServiceWorkerContainer {
  controller: ServiceWorker | null
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  dispatch: (type: string, payload?: unknown) => void
}

export class MockBroadcastChannel {
  static channels = new Map<string, Set<MockBroadcastChannel>>()

  readonly name: string
  readonly postMessage = vi.fn((payload: unknown) => {
    for (const channel of MockBroadcastChannel.channels.get(this.name) ?? []) {
      if (channel === this || channel.isClosed) {
        continue
      }

      channel.dispatchMessage(payload)
    }
  })
  readonly addEventListener = vi.fn((type: string, listener: EventListener) => {
    const current = this.listeners.get(type) ?? []
    current.push(listener)
    this.listeners.set(type, current)
  })
  readonly removeEventListener = vi.fn((type: string, listener: EventListener) => {
    const current = this.listeners.get(type) ?? []
    this.listeners.set(
      type,
      current.filter((candidate) => candidate !== listener),
    )
  })
  readonly close = vi.fn(() => {
    this.isClosed = true
    MockBroadcastChannel.channels.get(this.name)?.delete(this)
  })

  private readonly listeners = new Map<string, EventListener[]>()
  private isClosed = false

  constructor(name: string) {
    this.name = name

    const current = MockBroadcastChannel.channels.get(name) ?? new Set()
    current.add(this)
    MockBroadcastChannel.channels.set(name, current)
  }

  dispatchMessage(payload: unknown) {
    const event = new MessageEvent('message', { data: payload })

    for (const listener of this.listeners.get('message') ?? []) {
      listener(event)
    }
  }

  static reset() {
    MockBroadcastChannel.channels.clear()
  }
}

export function createMockServiceWorker(
  overrides: Partial<MockServiceWorker> = {},
): MockServiceWorker {
  const listeners = new Map<string, EventListener[]>()

  const worker: MockServiceWorker = {
    state: 'installed',
    postMessage: vi.fn(),
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      const current = listeners.get(type) ?? []
      current.push(listener)
      listeners.set(type, current)
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      const current = listeners.get(type) ?? []
      listeners.set(
        type,
        current.filter((candidate) => candidate !== listener),
      )
    }),
    dispatchStateChange: () => {
      for (const listener of listeners.get('statechange') ?? []) {
        listener(new Event('statechange'))
      }
    },
    ...overrides,
  }

  return worker
}

export function createMockServiceWorkerRegistration(
  overrides: Partial<MockServiceWorkerRegistration> = {},
): MockServiceWorkerRegistration {
  return {
    waiting: null,
    installing: null,
    active: null,
    update: vi.fn(async () => undefined),
    ...overrides,
  }
}

export function installMockServiceWorkerContainer(
  overrides: Partial<MockServiceWorkerContainer> = {},
): MockServiceWorkerContainer {
  const listeners = new Map<string, EventListener[]>()

  const container: MockServiceWorkerContainer = {
    controller: null,
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      const current = listeners.get(type) ?? []
      current.push(listener)
      listeners.set(type, current)
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      const current = listeners.get(type) ?? []
      listeners.set(
        type,
        current.filter((candidate) => candidate !== listener),
      )
    }),
    dispatch: (type: string, payload?: unknown) => {
      const event = new MessageEvent(type, { data: payload })

      for (const listener of listeners.get(type) ?? []) {
        listener(event)
      }
    },
    ...overrides,
  }

  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: container,
  })

  return container
}
