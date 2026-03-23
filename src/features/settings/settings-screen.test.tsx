import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { computeCategoryDeletionPlan } from '../../domain/category-service'
import { SettingsScreen } from './settings-screen'
import { createFinanceContextValue, renderWithFinance } from '../../test/finance-test-utils'
import { initialFinanceState } from '../../domain/default-data'
import type { FinanceState } from '../../domain/models'

const restoreState = vi.hoisted(() => ({
  result: {
    ok: false as const,
    message: 'This backup file is not valid.',
  },
}))

vi.mock('../../backup/restore-service', () => ({
  prepareBackupRestoreFile: vi.fn(async () => restoreState.result),
}))

vi.mock('../../utils/download', () => ({
  downloadTextFile: vi.fn(),
}))

function createState(overrides: Partial<FinanceState> = {}): FinanceState {
  return {
    ...initialFinanceState,
    categories: [...initialFinanceState.categories],
    settings: {
      ...initialFinanceState.settings,
      hasSeenPrivacyModal: true,
    },
    ...overrides,
  }
}

function renderScreen(state: FinanceState, overrides = {}) {
  const replaceState = vi.fn(async () => undefined)
  const onShowToast = vi.fn()
  const onOpenRecurringEditor = vi.fn()
  const onCreateBackup = vi.fn(async () => true)
  const onInstall = vi.fn()

  const contextValue = createFinanceContextValue({
    state,
    replaceState,
    ...overrides,
  })

  return {
    ...renderWithFinance(
      <SettingsScreen
        canInstall={false}
        isInstalled={true}
        onCreateBackup={onCreateBackup}
        onInstall={onInstall}
        onOpenRecurringEditor={onOpenRecurringEditor}
        onShowToast={onShowToast}
      />,
      contextValue,
    ),
    replaceState,
    onShowToast,
    onOpenRecurringEditor,
  }
}

describe('SettingsScreen direct flows', () => {
  it('shows recurring settings view and opens recurring editor callback', async () => {
    const { user, onOpenRecurringEditor } = renderScreen(
      createState({
        recurringTemplates: [
          {
            id: 'rec-food',
            type: 'expense',
            amount: 25,
            categoryId: 'cat-food',
            note: 'Meal plan',
            frequency: 'monthly',
            intervalDays: null,
            startDate: '2026-03-01',
            nextDueDate: '2026-04-01',
            active: true,
            createdAt: '2026-03-01T08:00:00.000Z',
            updatedAt: '2026-03-01T08:00:00.000Z',
            syncStatus: 'synced',
          },
        ],
      }),
    )

    await user.click(screen.getByRole('button', { name: /Manage recurring/i }))

    expect(await screen.findByRole('heading', { name: 'Recurring transactions' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Meal plan/i }))

    expect(onOpenRecurringEditor).toHaveBeenCalledWith('rec-food')
  })

  it('creates a category from the settings category editor', async () => {
    const addCategory = vi.fn()
    const { user } = renderScreen(createState(), { addCategory })

    await user.click(screen.getByRole('button', { name: /Manage categories/i }))
    await user.click(screen.getByRole('button', { name: '+ Add' }))
    await user.type(screen.getByLabelText('Name'), 'Health')
    await user.selectOptions(screen.getByLabelText('Kind'), 'both')
    await user.click(screen.getByRole('button', { name: 'Add category' }))

    expect(addCategory).toHaveBeenCalledWith({
      name: 'Health',
      color: '#0f766e',
      kind: 'both',
    })
  })

  it('blocks incompatible kind changes for linked categories', async () => {
    const updateCategory = vi.fn()
    const { user } = renderScreen(
      createState({
        transactions: [
          {
            id: 'txn-food',
            type: 'expense',
            amount: 18,
            categoryId: 'cat-food',
            note: 'Lunch',
            occurredAt: '2026-03-20',
            recurringTemplateId: null,
            recurringOccurrenceDate: null,
            createdAt: '2026-03-20T08:00:00.000Z',
            updatedAt: '2026-03-20T08:00:00.000Z',
            syncStatus: 'synced',
          },
        ],
      }),
      { updateCategory },
    )

    await user.click(screen.getByRole('button', { name: /Manage categories/i }))
    await user.click(screen.getByRole('button', { name: /Food/i }))
    await user.selectOptions(screen.getByLabelText('Kind'), 'income')
    await user.click(screen.getByRole('button', { name: 'Save category' }))

    expect(
      await screen.findByText('This category already has linked transactions of the other type.'),
    ).toBeInTheDocument()
    expect(updateCategory).not.toHaveBeenCalled()
  })

  it('deletes a category with reassignment from the settings category editor', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const deleteCategory = vi.fn(() => null)
    const state = createState({
      transactions: [
        {
          id: 'txn-food',
          type: 'expense',
          amount: 22,
          categoryId: 'cat-food',
          note: 'Dinner',
          occurredAt: '2026-03-20',
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-03-20T08:00:00.000Z',
          updatedAt: '2026-03-20T08:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
      recurringTemplates: [
        {
          id: 'rec-food',
          type: 'expense',
          amount: 20,
          categoryId: 'cat-food',
          note: 'Meal plan',
          frequency: 'monthly',
          intervalDays: null,
          startDate: '2026-03-01',
          nextDueDate: '2026-04-01',
          active: true,
          createdAt: '2026-03-01T08:00:00.000Z',
          updatedAt: '2026-03-01T08:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
      budgets: [
        {
          id: 'budget-food',
          name: 'Food budget',
          categoryIds: ['cat-food'],
          monthKey: '2026-03',
          limit: 200,
          createdAt: '2026-03-01T08:00:00.000Z',
          updatedAt: '2026-03-01T08:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
    })
    const { user } = renderScreen(state, {
      previewCategoryDeletion: (input) => computeCategoryDeletionPlan(state, input),
      deleteCategory,
    })

    await user.click(screen.getByRole('button', { name: /Manage categories/i }))
    await user.click(screen.getByRole('button', { name: /Food/i }))

    expect(screen.getByText('1 transactions, 1 recurring templates, 1 budgets affected.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Replacement category'), 'cat-housing')
    await user.click(screen.getByRole('button', { name: 'Delete category' }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(deleteCategory).toHaveBeenCalledWith({
      categoryId: 'cat-food',
      strategy: 'reassign',
      replacementCategoryId: 'cat-housing',
    })
  })

  it('shows empty recurring state when there are no active recurring templates', async () => {
    const { user } = renderScreen(createState({ recurringTemplates: [] }))

    await user.click(screen.getByRole('button', { name: /Manage recurring/i }))
    expect(
      await screen.findByText('Recurring items you create will appear here for future editing.'),
    ).toBeInTheDocument()
  })

  it('shows restore error when uploaded file is invalid', async () => {
    restoreState.result = {
      ok: false,
      message: 'This backup file is not valid.',
    }
    const { user } = renderScreen(createState())

    const file = new File(['bad data'], 'bad-backup.json', { type: 'application/json' })
    const input = screen.getByLabelText('Restore backup file')

    await user.upload(input, file)

    expect(await screen.findByText('This backup file is not valid.')).toBeInTheDocument()
  })

  it('prepares restore dialog and replaces state after confirm', async () => {
    const nextState = createState({
      transactions: [
        {
          id: 'txn-restored',
          type: 'expense',
          amount: 12,
          categoryId: 'cat-food',
          note: 'Restored',
          occurredAt: '2026-03-20',
          recurringTemplateId: null,
          recurringOccurrenceDate: null,
          createdAt: '2026-03-20T08:00:00.000Z',
          updatedAt: '2026-03-20T08:00:00.000Z',
          syncStatus: 'synced',
        },
      ],
    })
    restoreState.result = {
      ok: true as const,
      prepared: {
        payload: {
          schemaVersion: 2,
          exportedAt: '2026-03-20T10:00:00.000Z',
          app: 'Tally',
          data: {
            transactions: nextState.transactions,
            categories: nextState.categories,
            budgets: nextState.budgets,
            recurringTemplates: nextState.recurringTemplates,
            preferences: nextState.settings,
          },
        },
        nextState,
      },
    }

    const { user, replaceState, onShowToast } = renderScreen(createState())
    const input = screen.getByLabelText('Restore backup file')
    const file = new File(['good'], 'backup.json', { type: 'application/json' })

    await user.upload(input, file)

    const dialog = await screen.findByRole('dialog', { name: 'Restore backup?' })
    expect(within(dialog).getByText('backup.json')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Restore' }))

    await waitFor(() => {
      expect(replaceState).toHaveBeenCalledWith(nextState)
      expect(onShowToast).toHaveBeenCalledWith('Backup restored successfully.')
    })
  })

  it('clears pending restore when dialog is cancelled', async () => {
    restoreState.result = {
      ok: true as const,
      prepared: {
        payload: {
          schemaVersion: 2,
          exportedAt: '2026-03-20T10:00:00.000Z',
          app: 'Tally',
          data: {
            transactions: [],
            categories: initialFinanceState.categories,
            budgets: [],
            recurringTemplates: [],
            preferences: initialFinanceState.settings,
          },
        },
        nextState: createState(),
      },
    }

    renderScreen(createState())
    const input = screen.getByLabelText('Restore backup file')
    const file = new File(['good'], 'backup.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })

    const dialog = await screen.findByRole('dialog', { name: 'Restore backup?' })
    await within(dialog).getByRole('button', { name: 'Cancel' }).click()

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Restore backup?' })).not.toBeInTheDocument()
    })
  })
})