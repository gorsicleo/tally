import { describe, expect, it } from 'vitest'
import {
  createAppLockPinVerifier,
  validateNumericPin,
  verifyAppLockPin,
} from './app-lock'

describe('app lock helpers', () => {
  it('validates numeric pin requirements', () => {
    expect(validateNumericPin('12')).toBe('PIN must be at least 4 digits.')
    expect(validateNumericPin('12ab')).toBe('PIN must contain digits only.')
    expect(validateNumericPin('1234')).toBeNull()
  })

  it('creates and verifies a PIN without storing plaintext', async () => {
    const verifier = await createAppLockPinVerifier('1234')

    expect(verifier.saltHex).not.toBe('1234')
    expect(verifier.verifierHex).not.toBe('1234')
    expect('pin' in verifier).toBe(false)
    expect(await verifyAppLockPin('1234', verifier)).toBe(true)
    expect(await verifyAppLockPin('9999', verifier)).toBe(false)
  })
})