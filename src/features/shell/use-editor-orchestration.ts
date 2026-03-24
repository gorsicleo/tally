import { useMemo, useState } from 'react'
import type { RecurringTemplate, Transaction } from '../../domain/models'

interface UseEditorOrchestrationInput {
  transactions: Transaction[]
  recurringTemplates: RecurringTemplate[]
}

interface EditorOrchestrationResult {
  editorTransactionId: string | null
  recurringEditorId: string | null
  editingTransaction: Transaction | null
  editingRecurringTemplate: RecurringTemplate | null
  openQuickAdd: () => void
  openTransactionEditor: (transaction: Transaction) => void
  openRecurringEditor: (templateId: string) => void
  closeEditor: () => void
  closeRecurringEditor: () => void
}

export function useEditorOrchestration({
  transactions,
  recurringTemplates,
}: UseEditorOrchestrationInput): EditorOrchestrationResult {
  const [editorTransactionId, setEditorTransactionId] = useState<string | null>(null)
  const [recurringEditorId, setRecurringEditorId] = useState<string | null>(null)

  const editingTransaction = useMemo(
    () =>
      editorTransactionId
        ? transactions.find((transaction) => transaction.id === editorTransactionId) ?? null
        : null,
    [editorTransactionId, transactions],
  )

  const editingRecurringTemplate = useMemo(
    () =>
      recurringEditorId
        ? recurringTemplates.find((template) => template.id === recurringEditorId) ?? null
        : null,
    [recurringEditorId, recurringTemplates],
  )

  const openQuickAdd = () => {
    setRecurringEditorId(null)
    setEditorTransactionId('create')
  }

  const openTransactionEditor = (transaction: Transaction) => {
    setRecurringEditorId(null)
    setEditorTransactionId(transaction.id)
  }

  const openRecurringEditor = (templateId: string) => {
    setEditorTransactionId(null)
    setRecurringEditorId(templateId)
  }

  const closeEditor = () => {
    setEditorTransactionId(null)
  }

  const closeRecurringEditor = () => {
    setRecurringEditorId(null)
  }

  return {
    editorTransactionId,
    recurringEditorId,
    editingTransaction,
    editingRecurringTemplate,
    openQuickAdd,
    openTransactionEditor,
    openRecurringEditor,
    closeEditor,
    closeRecurringEditor,
  }
}
