import type { FinanceState } from '../../domain/models'

export function recordMeaningfulChange(nextState: FinanceState): FinanceState {
  return {
    ...nextState,
    settings: {
      ...nextState.settings,
      changesSinceBackup: nextState.settings.changesSinceBackup + 1,
    },
  }
}
