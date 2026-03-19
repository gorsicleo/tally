interface AppHeaderProps {
  title: string
  subtitle: string
  syncLabel: string
  isOnline: boolean
  isSyncing: boolean
  statusMode: 'hidden' | 'offline-only' | 'full'
  variant?: 'default' | 'compact'
}

function getSyncTone(syncLabel: string, isSyncing: boolean): string {
  if (isSyncing) {
    return 'syncing'
  }

  const normalizedLabel = syncLabel.toLowerCase()

  if (normalizedLabel.includes('failed')) {
    return 'offline'
  }

  if (normalizedLabel.includes('pending') || normalizedLabel.includes('queued')) {
    return 'syncing'
  }

  if (normalizedLabel === 'synced') {
    return 'online'
  }

  return 'neutral'
}

export function AppHeader({
  title,
  subtitle,
  syncLabel,
  isOnline,
  isSyncing,
  statusMode,
  variant = 'default',
}: AppHeaderProps) {
  const showNetworkStatus = statusMode !== 'hidden'
  const showSyncStatus =
    statusMode === 'full' || (statusMode === 'offline-only' && syncLabel !== 'Offline')
  const hasMeta = showNetworkStatus || showSyncStatus

  return (
    <header
      className={
        `panel app-header ${hasMeta ? 'with-meta' : 'no-meta'} ${variant === 'compact' ? 'compact' : ''}`.trim()
      }
    >
      <div className="app-header-copy">
        <p className="brand-mark">TALLY</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      {hasMeta ? (
        <div className="app-header-meta">
          <div className="status-cluster">
            {showNetworkStatus ? (
              <span className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            ) : null}
            {showSyncStatus ? (
              <span className={`status-pill ${getSyncTone(syncLabel, isSyncing)}`}>
                {syncLabel}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  )
}
