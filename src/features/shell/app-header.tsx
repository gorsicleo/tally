interface AppHeaderProps {
  title: string
}

export function AppHeader({ title }: AppHeaderProps) {
  return (
    <header className="app-header" aria-live="polite">
      <div className="app-header-copy">
        <h1>{title}</h1>
      </div>
    </header>
  )
}
