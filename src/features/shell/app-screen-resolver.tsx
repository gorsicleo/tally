import { BudgetsScreen } from '../budgets/budgets-screen'
import { HomeScreen } from '../home/home-screen'
import { InsightsScreen } from '../insights/insights-screen'
import { SettingsScreen } from '../settings/settings-screen'
import { TransactionsScreen } from '../transactions/transactions-screen'
import type { AppTab } from './tab-bar'
import type { Transaction } from '../../domain/models'

interface AppScreenResolverProps {
  activeTab: AppTab
  budgetsView: 'budgets' | 'goals'
  openGoalCreateFromHome: boolean
  canInstall: boolean
  isInstalled: boolean
  onCreateBackup: () => Promise<boolean>
  onInstall: () => void
  onNavigate: (
    tab: AppTab,
    options?: {
      budgetsView?: 'budgets' | 'goals'
      openCreateGoal?: boolean
    },
  ) => void
  onGoalCreateRequestHandled: () => void
  onEditTransaction: (transaction: Transaction) => void
  onEditRecurring: (templateId: string) => void
  onShowToast: (message: string) => void
}

export function AppScreenResolver({
  activeTab,
  budgetsView,
  openGoalCreateFromHome,
  canInstall,
  isInstalled,
  onCreateBackup,
  onInstall,
  onNavigate,
  onGoalCreateRequestHandled,
  onEditTransaction,
  onEditRecurring,
  onShowToast,
}: AppScreenResolverProps) {
  if (activeTab === 'transactions') {
    return <TransactionsScreen onEditTransaction={onEditTransaction} />
  }

  if (activeTab === 'insights') {
    return <InsightsScreen />
  }

  if (activeTab === 'budgets') {
    return (
      <BudgetsScreen
        initialView={budgetsView}
        openCreateGoalRequest={openGoalCreateFromHome}
        onOpenCreateGoalHandled={onGoalCreateRequestHandled}
      />
    )
  }

  if (activeTab === 'settings') {
    return (
      <SettingsScreen
        canInstall={canInstall}
        isInstalled={isInstalled}
        onCreateBackup={onCreateBackup}
        onInstall={onInstall}
        onOpenRecurringEditor={onEditRecurring}
        onShowToast={onShowToast}
      />
    )
  }

  return (
    <HomeScreen
      onNavigate={onNavigate}
      onEditTransaction={onEditTransaction}
      onEditRecurring={onEditRecurring}
      onShowToast={onShowToast}
    />
  )
}
