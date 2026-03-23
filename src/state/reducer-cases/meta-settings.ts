import type { FinanceState } from '../../domain/models'
import type { FinanceAction } from '../finance-reducer-types'

type HydrateAction = Extract<FinanceAction, { type: 'hydrate' }>
type ReplaceStateAction = Extract<FinanceAction, { type: 'replace-state' }>
type UpdateSettingsAction = Extract<FinanceAction, { type: 'update-settings' }>
type SyncAttemptAction = Extract<FinanceAction, { type: 'sync-attempt' }>

export function handleHydrate(
  _state: FinanceState,
  action: HydrateAction,
): FinanceState {
  return action.payload
}

export function handleReplaceState(
  _state: FinanceState,
  action: ReplaceStateAction,
): FinanceState {
  return action.payload
}

export function handleUpdateSettings(
  state: FinanceState,
  action: UpdateSettingsAction,
): FinanceState {
  return {
    ...state,
    settings: {
      ...state.settings,
      ...action.payload,
    },
  }
}

export function handleSyncAttempt(
  state: FinanceState,
  action: SyncAttemptAction,
): FinanceState {
  return {
    ...state,
    lastSyncAttemptAt: action.payload.at,
  }
}
