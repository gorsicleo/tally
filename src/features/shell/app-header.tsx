interface AppHeaderProps {
  title: string
  subtitle: string
  variant?: 'default' | 'compact'
}

export function AppHeader({
  title,
  subtitle,
  variant = 'default',
}: AppHeaderProps) {
  return (
    <header
      className={
        `panel app-header no-meta ${variant === 'compact' ? 'compact' : ''}`.trim()
      }
    >
      <div className="app-header-copy">
        <p className="brand-mark">TALLY</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  )
}
