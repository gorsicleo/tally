import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { RecurringEditorSheet } from './recurring-editor-sheet'
import { createFinanceContextValue, renderWithFinance } from '../../test/finance-test-utils'
import { initialFinanceState } from '../../domain/default-data'

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
        {
          id: 'rec-1',
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

describe('RecurringEditorSheet', () => {
  it('validates custom interval and saves updates', async () => {
    const { contextValue, updateRecurringTemplate, onClose, onShowToast } =
      createContextValue()
    const { user } = renderWithFinance(
      <RecurringEditorSheet
        templateId="rec-1"
        onClose={onClose}
        onShowToast={onShowToast}
      />,
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

  it('stops recurring after confirmation', async () => {
    const { contextValue, stopRecurringTemplate, onClose, onShowToast } =
      createContextValue()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user } = renderWithFinance(
      <RecurringEditorSheet
        templateId="rec-1"
        onClose={onClose}
        onShowToast={onShowToast}
      />,
      contextValue,
    )

    await screen.findByRole('dialog', { name: 'Edit future recurring transactions' })
    await user.click(screen.getByRole('button', { name: 'Stop recurring' }))

    expect(confirmSpy).toHaveBeenCalled()
    await waitFor(() => {
      expect(stopRecurringTemplate).toHaveBeenCalledWith('rec-1')
      expect(onShowToast).toHaveBeenCalledWith('Recurring stopped.')
      expect(onClose).toHaveBeenCalled()
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