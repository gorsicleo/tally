import type { AppTab } from './tab-bar'

interface TabMeta {
  title: string
  subtitle: string
}

export const APP_HEADER_STATUS_MODE = 'hidden' as const

const tabMeta: Record<AppTab, TabMeta> = {
  home: {
    title: 'This month, at a glance',
    subtitle: 'See where you stand now and record the next spend.',
  },
  transactions: {
    title: 'Records',
    subtitle: 'Search, filter, and edit your history.',
  },
  insights: {
    title: 'Insights',
    subtitle: 'Understand spending with breakdowns and trend views.',
  },
  budgets: {
    title: 'Budgets',
    subtitle: 'Use category budgets as your guardrails.',
  },
  settings: {
    title: 'App settings',
    subtitle: 'Manage categories, theme, backups, and preferences.',
  },
}

function isCompactHeaderTab(activeTab: AppTab): boolean {
  return activeTab === 'insights' || activeTab === 'budgets' || activeTab === 'settings'
}

export function getActiveTabMeta(
  activeTab: AppTab,
  currentMonthLabel: string,
): TabMeta {
  if (activeTab === 'insights' || activeTab === 'budgets') {
    return { title: tabMeta[activeTab].title, subtitle: currentMonthLabel }
  }

  if (activeTab === 'settings') {
    return { title: 'Settings', subtitle: 'General, data, recurring, and categories' }
  }

  return tabMeta[activeTab]
}

export function getHeaderVariant(activeTab: AppTab): 'default' | 'compact' {
  if (isCompactHeaderTab(activeTab)) {
    return 'compact'
  }

  return 'default'
}
