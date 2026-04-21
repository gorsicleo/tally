import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { RecurringEditorSheet } from './recurring-editor-sheet'
import { createFinanceContextValue, renderWithFinance } from '../../test/finance-test-utils'
import { initialFinanceState } from '../../domain/default-data'
import { FinanceContext } from '../../state/finance-store'
import type { RecurringTemplate } from '../../domain/models'

function createRecurringTemplate(
  overrides: Partial<RecurringTemplate> = {},
): RecurringTemplate {
  return {
    id: overrides.id ?? 'rec-1',
    type: overrides.type ?? 'expense',
    amount: overrides.amount ?? 25,
    categoryId: overrides.categoryId ?? 'cat-food',
    note: overrides.note ?? 'Meal plan',
    frequency: overrides.frequency ?? 'monthly',
    intervalDays: overrides.intervalDays ?? null,
    startDate: overrides.startDate ?? '2026-03-01',
    nextDueDate: overrides.nextDueDate ?? '2026-04-01',
    active: overrides.active ?? true,
    createdAt: overrides.createdAt ?? '2026-03-01T08:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-01T08:00:00.000Z',
  }
}

function createContextValue() {
  const updateRecurringTemplate = vi.fn()
  const stopRecurringTemplate = vi.fn()
  const onClose = vi.fn()
  const onShowToast = vi.fn()

  const contextValue = createFinanceContextValue({
    state: {
      ...initialFinanceState,
      categories: [...initialFinanceState.categories],
      recurringTemplates: [
        createRecurringTemplate(),
      ],
    },
    updateRecurringTemplate,
    stopRecurringTemplate,
  })

  return {
    contextValue,
    updateRecurringTemplate,
    stopRecurringTemplate,
    onClose,
    onShowToast,
  }
}

function renderStatefulSheet() {
  const updateRecurringTemplateSpy = vi.fn()
  const stopRecurringTemplateSpy = vi.fn()
  const onClose = vi.fn()
  const onShowToast = vi.fn()

  function Harness() {
    const [state, setState] = useState({
      ...initialFinanceState,
      categories: [...initialFinanceState.categories],
      recurringTemplates: [createRecurringTemplate()],
    })
    const [isOpen, setIsOpen] = useState(true)

    const updateRecurringTemplate = (
      input: Parameters<typeof updateRecurringTemplateSpy>[0],
    ) => {
      updateRecurringTemplateSpy(input)
      setState((current) => ({
        ...current,
        recurringTemplates: current.recurringTemplates.map((template) =>
          template.id === input.id
            ? {
                ...template,
                ...input,
                amount: Math.abs(input.amount),
                note: input.note.trim(),
                intervalDays:
                  input.frequency === 'custom'
                    ? Math.floor(input.intervalDays ?? 1)
                    : null,
                active: true,
                updatedAt: '2026-04-01T09:00:00.000Z',
              }
            : template,
        ),
      }))
    }

    const stopRecurringTemplate = (templateId: string) => {
      stopRecurringTemplateSpy(templateId)
      setState((current) => ({
        ...current,
        recurringTemplates: current.recurringTemplates.map((template) =>
          template.id === templateId
            ? {
                ...template,
                active: false,
                updatedAt: '2026-04-01T09:10:00.000Z',
              }
            : template,
        ),
      }))
    }

    const contextValue = createFinanceContextValue({
      state,
      updateRecurringTemplate,
      stopRecurringTemplate,
    })

    return (
      <FinanceContext.Provider value={contextValue}>
        {isOpen ? (
          <RecurringEditorSheet
            templateId="rec-1"
            onClose={() => {
              onClose()
              setIsOpen(false)
            }}
            onShowToast={onShowToast}
          />
        ) : null}
      </FinanceContext.Provider>
    )
  }

  return {
    user: userEvent.setup(),
    ...render(<Harness />),
    updateRecurringTemplateSpy,
    stopRecurringTemplateSpy,
    onClose,
    onShowToast,
  }
}

describe('RecurringEditorSheet', () => {
  it('renders a close button and dismisses when it is clicked', async () => {
    const { user, onClose } = renderStatefulSheet()

    const dialog = await screen.findByRole('dialog', {
      name: 'Edit future recurring transactions',
    })

    await user.click(within(dialog).getByRole('button', { name: 'Close recurring editor' }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
      expect(
        screen.queryByRole('dialog', { name: 'Edit future recurring transactions' }),
      ).not.toBeInTheDocument()
    })
  })

  it('validates custom interval and saves updates', async () => {
    const { contextValue, updateRecurringTemplate, onClose, onShowToast } = createContextValue()
    const { user } = renderWithFinance(
      <RecurringEditorSheet templateId="rec-1" onClose={onClose} onShowToast={onShowToast} />,
      contextValue,
    )

    const dialog = await screen.findByRole('dialog', {
      name: 'Edit future recurring transactions',
    })

    await user.click(within(dialog).getByRole('button', { name: 'Custom' }))
    await user.clear(screen.getByRole('spinbutton', { name: 'Repeat every how many days?' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Repeat every how many days?' }), '0')
    fireEvent.submit(dialog.querySelector('form')!)

    expect(await screen.findByText('Custom repeat must be at least 1 day.')).toBeInTheDocument()

    await user.clear(screen.getByRole('spinbutton', { name: 'Repeat every how many days?' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Repeat every how many days?' }), '10')
    await user.clear(screen.getByRole('spinbutton', { name: 'Recurring amount' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Recurring amount' }), '30')
    await user.clear(screen.getByRole('textbox', { name: 'Note (optional)' }))
    await user.type(screen.getByRole('textbox', { name: 'Note (optional)' }), 'Updated recurring note')
    await user.click(within(dialog).getByRole('button', { name: 'Save recurring' }))

    await waitFor(() => {
      expect(updateRecurringTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'rec-1',
          amount: 30,
          note: 'Updated recurring note',
          frequency: 'custom',
          intervalDays: 10,
        }),
      )
    })
    await waitFor(() => {
      expect(onShowToast).toHaveBeenCalledWith('Recurring updated.')
      expect(onClose).toHaveBeenCalled()
    })
  }, 10000)

  it('dismisses after successful recurring save', async () => {
    const {
      user,
      updateRecurringTemplateSpy,
      onClose,
      onShowToast,
    } = renderStatefulSheet()

    const dialog = await screen.findByRole('dialog', {
      name: 'Edit future recurring transactions',
    })

    await user.clear(screen.getByRole('spinbutton', { name: 'Recurring amount' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Recurring amount' }), '30')
    await user.click(within(dialog).getByRole('button', { name: 'Save recurring' }))

    await waitFor(() => {
      expect(updateRecurringTemplateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'rec-1',
          amount: 30,
        }),
      )
      expect(onShowToast).toHaveBeenCalledWith('Recurring updated.')
      expect(onClose).toHaveBeenCalled()
      expect(
        screen.queryByRole('dialog', { name: 'Edit future recurring transactions' }),
      ).not.toBeInTheDocument()
    })
  })

  it('dismisses after successful recurring stop', async () => {
    const {
      user,
      stopRecurringTemplateSpy,
      onClose,
      onShowToast,
    } = renderStatefulSheet()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const dialog = await screen.findByRole('dialog', {
      name: 'Edit future recurring transactions',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Stop recurring' }))

    expect(confirmSpy).toHaveBeenCalled()
    await waitFor(() => {
      expect(stopRecurringTemplateSpy).toHaveBeenCalledWith('rec-1')
      expect(onShowToast).toHaveBeenCalledWith('Recurring stopped.')
      expect(onClose).toHaveBeenCalled()
      expect(
        screen.queryByRole('dialog', { name: 'Edit future recurring transactions' }),
      ).not.toBeInTheDocument()
    })

    confirmSpy.mockRestore()
  })

  it('closes immediately when template is missing', async () => {
    const onClose = vi.fn()
    renderWithFinance(
      <RecurringEditorSheet
        templateId="missing"
        onClose={onClose}
        onShowToast={vi.fn()}
      />,
      createFinanceContextValue({ state: initialFinanceState }),
    )

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })
})