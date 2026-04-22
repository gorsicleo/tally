import { describe, expect, it } from 'vitest'
import {
  createRecoveryCodeSet,
  getRecoveryCodeSummary,
  verifyAndConsumeRecoveryCode,
} from './recovery-codes'

describe('recovery codes helpers', () => {
  it('generates readable one-time codes and stores only verifier metadata', async () => {
    const { plaintextCodes, codeSet } = await createRecoveryCodeSet()

    expect(plaintextCodes.length).toBeGreaterThan(0)
    expect(codeSet.verifiers).toHaveLength(plaintextCodes.length)

    plaintextCodes.forEach((code) => {
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
      expect(JSON.stringify(codeSet)).not.toContain(code)
    })
  })

  it('consumes a valid code exactly once', async () => {
    const { plaintextCodes, codeSet } = await createRecoveryCodeSet()
    const code = plaintextCodes[0]

    const firstAttempt = await verifyAndConsumeRecoveryCode(code, codeSet)
    expect(firstAttempt.ok).toBe(true)
    expect(firstAttempt.nextSet).not.toBeNull()

    const secondAttempt = await verifyAndConsumeRecoveryCode(code, firstAttempt.nextSet)
    expect(secondAttempt.ok).toBe(false)
    expect(secondAttempt.message).toBe('Recovery code is invalid or already used.')
  })

  it('rejects invalid code input', async () => {
    const { codeSet } = await createRecoveryCodeSet()
    const result = await verifyAndConsumeRecoveryCode('bad', codeSet)

    expect(result.ok).toBe(false)
    expect(result.message).toBe('Recovery code is invalid.')
  })

  it('invalidates previous codes after regeneration', async () => {
    const firstSet = await createRecoveryCodeSet()
    const secondSet = await createRecoveryCodeSet()

    const result = await verifyAndConsumeRecoveryCode(firstSet.plaintextCodes[0], secondSet.codeSet)
    expect(result.ok).toBe(false)
    expect(result.message).toBe('Recovery code is invalid or already used.')
  })

  it('reports remaining code counts', async () => {
    const { plaintextCodes, codeSet } = await createRecoveryCodeSet()
    const consumed = await verifyAndConsumeRecoveryCode(plaintextCodes[0], codeSet)

    const summary = getRecoveryCodeSummary(consumed.nextSet)
    expect(summary.total).toBe(codeSet.verifiers.length)
    expect(summary.remaining).toBe(codeSet.verifiers.length - 1)
  })
})
