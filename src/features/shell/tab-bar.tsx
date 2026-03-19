import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export type AppTab =
  | 'home'
  | 'transactions'
  | 'insights'
  | 'budgets'
  | 'settings'

interface TabBarProps {
  activeTab: AppTab
  onChange: (tab: AppTab) => void
}

const tabs: Array<{ id: AppTab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'transactions', label: 'Records' },
  { id: 'insights', label: 'Insights' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'settings', label: 'Settings' },
]

const DRAG_HIT_PADDING = 18

function TabIcon({ tab }: { tab: AppTab }) {
  switch (tab) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 10.5 12 4l8 6.5v8.3a1.2 1.2 0 0 1-1.2 1.2h-4.3v-5.4H9.5V20H5.2A1.2 1.2 0 0 1 4 18.8Z" />
        </svg>
      )
    case 'transactions':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 6.5h14" />
          <path d="M5 12h14" />
          <path d="M5 17.5h9" />
        </svg>
      )
    case 'insights':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 18V11" />
          <path d="M12 18V6" />
          <path d="M18 18v-8" />
        </svg>
      )
    case 'budgets':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.5 8.5h15" />
          <rect x="4.5" y="5.5" width="15" height="13" rx="2.5" />
          <path d="M15.5 13h2.8" />
        </svg>
      )
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2Z" />
          <path d="m19.4 15.1 1.1 1.9-1.8 3.1-2.2-.2a7.8 7.8 0 0 1-1.6.9l-.8 2.1H9.9l-.8-2.1a7.8 7.8 0 0 1-1.6-.9l-2.2.2L3.5 17l1.1-1.9a8.2 8.2 0 0 1 0-2.2L3.5 11l1.8-3.1 2.2.2c.5-.4 1-.7 1.6-.9l.8-2.1h4.2l.8 2.1c.6.2 1.1.5 1.6.9l2.2-.2 1.8 3.1-1.1 1.9c.1.7.1 1.5 0 2.2Z" />
        </svg>
      )
    default:
      return null
  }
}

export function TabBar({ activeTab, onChange }: TabBarProps) {
  const innerRef = useRef<HTMLDivElement | null>(null)
  const buttonRefs = useRef<Record<AppTab, HTMLButtonElement | null>>({
    home: null,
    transactions: null,
    insights: null,
    budgets: null,
    settings: null,
  })
  const [indicator, setIndicator] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    opacity: 0,
  })
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const syncIndicator = () => {
      const container = innerRef.current
      const button = buttonRefs.current[activeTab]

      if (!container || !button) {
        return
      }

      const containerRect = container.getBoundingClientRect()
      const buttonRect = button.getBoundingClientRect()

      setIndicator({
        left: buttonRect.left - containerRect.left,
        top: buttonRect.top - containerRect.top,
        width: buttonRect.width,
        height: buttonRect.height,
        opacity: 1,
      })
    }

    syncIndicator()
    window.addEventListener('resize', syncIndicator)

    return () => {
      window.removeEventListener('resize', syncIndicator)
    }
  }, [activeTab])

  const updatePointerGlow = (clientX: number, clientY: number) => {
    const container = innerRef.current

    if (!container) {
      return
    }

    const rect = container.getBoundingClientRect()
    container.style.setProperty('--glow-x', `${clientX - rect.left}px`)
    container.style.setProperty('--glow-y', `${clientY - rect.top}px`)
  }

  const getTabFromPoint = (clientX: number, clientY: number): AppTab | null => {
    const container = innerRef.current

    if (!container) {
      return null
    }

    const containerRect = container.getBoundingClientRect()

    if (
      clientX < containerRect.left - DRAG_HIT_PADDING ||
      clientX > containerRect.right + DRAG_HIT_PADDING ||
      clientY < containerRect.top - DRAG_HIT_PADDING ||
      clientY > containerRect.bottom + DRAG_HIT_PADDING
    ) {
      return null
    }

    let nearestTab: { id: AppTab; distance: number } | null = null

    for (const tab of tabs) {
      const button = buttonRefs.current[tab.id]

      if (!button) {
        continue
      }

      const rect = button.getBoundingClientRect()
      const isInside =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom

      if (isInside) {
        return tab.id
      }

      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const distance = Math.hypot(clientX - centerX, clientY - centerY)

      if (!nearestTab || distance < nearestTab.distance) {
        nearestTab = { id: tab.id, distance }
      }
    }

    return nearestTab?.id ?? null
  }

  const activateTabFromPointer = (clientX: number, clientY: number) => {
    const nextTab = getTabFromPoint(clientX, clientY)

    if (nextTab && nextTab !== activeTab) {
      onChange(nextTab)
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    updatePointerGlow(event.clientX, event.clientY)

    if (event.pointerType !== 'mouse') {
      event.preventDefault()
    }

    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    activateTabFromPointer(event.clientX, event.clientY)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    updatePointerGlow(event.clientX, event.clientY)

    if (isDragging) {
      activateTabFromPointer(event.clientX, event.clientY)
    }
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return
    }

    activateTabFromPointer(event.clientX, event.clientY)
    setIsDragging(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <nav
      className={`tab-bar ${isDragging ? 'dragging' : ''}`.trim()}
      aria-label="Primary navigation"
    >
      <div
        ref={innerRef}
        className="tab-bar-inner"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerEnd}
      >
        <div
          className="tab-bar-indicator"
          aria-hidden="true"
          style={{
            transform: `translate3d(${indicator.left}px, ${indicator.top}px, 0)`,
            width: `${indicator.width}px`,
            height: `${indicator.height}px`,
            opacity: indicator.opacity,
          }}
        />

        {tabs.map((tab) => {
          const isActive = tab.id === activeTab

          return (
            <button
              key={tab.id}
              ref={(element) => {
                buttonRefs.current[tab.id] = element
              }}
              type="button"
              className={`tab-button ${isActive ? 'active' : ''}`.trim()}
              data-tab={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <TabIcon tab={tab.id} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
