import type { ThemeMode } from '../../domain/models'

interface ThemeToggleProps {
  theme: ThemeMode
  onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      className="theme-toggle"
      data-theme={theme}
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="theme-toggle-orbit" aria-hidden="true">
        <svg className="theme-icon sun-icon" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4.2" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M12 1.8v3" />
            <path d="M12 19.2v3" />
            <path d="M4.2 4.2l2.1 2.1" />
            <path d="M17.7 17.7l2.1 2.1" />
            <path d="M1.8 12h3" />
            <path d="M19.2 12h3" />
            <path d="M4.2 19.8l2.1-2.1" />
            <path d="M17.7 6.3l2.1-2.1" />
          </g>
        </svg>
        <svg className="theme-icon moon-icon" viewBox="0 0 24 24">
          <path
            d="M15.6 3.2A8.8 8.8 0 1 0 20.8 18a8.5 8.5 0 0 1-5.2-14.8Z"
            fill="currentColor"
          />
        </svg>
      </span>
    </button>
  )
}
