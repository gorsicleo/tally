import type { AppTab } from './tab-bar'

interface TabMeta {
  title: string
}

export const APP_HEADER_STATUS_MODE = 'hidden' as const

const tabMeta: Record<AppTab, TabMeta> = {
  home: {
    title: 'Welcome',
  },
  transactions: {
    title: 'Records',
  },
  insights: {
    title: 'Insights',
  },
  budgets: {
    title: 'Budgets',
  },
  settings: {
    title: 'Settings',
  },
}

export function getActiveTabMeta(
  activeTab: AppTab,
): TabMeta {
  return tabMeta[activeTab]
}
