import type { AppLockPinVerifier, AppSettings } from '../../domain/models'

export const APP_LOCK_RELOCK_TIMEOUT_MS = 3 * 60 * 1000
export const APP_LOCK_COOLDOWN_AFTER_FAILURES_MS = 10 * 1000
export const APP_LOCK_FAILURES_BEFORE_COOLDOWN = 3
export const APP_LOCK_PIN_MIN_LENGTH = 4
export const APP_LOCK_PBKDF2_ITERATIONS = 200_000
const APP_LOCK_SALT_LENGTH = 16
const APP_LOCK_DERIVED_BITS = 256

const encoder = new TextEncoder()

function getWebCrypto(): Crypto {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Secure PIN features are not available in this browser.')
  }

  return crypto
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2)

  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16)
  }

  return bytes
}

function isValidPinInput(pin: string): boolean {
  return /^\d+$/.test(pin) && pin.length >= APP_LOCK_PIN_MIN_LENGTH
}

async function derivePinVerifierHex(
  pin: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const keyMaterial = await getWebCrypto().subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const derivedBits = await getWebCrypto().subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    APP_LOCK_DERIVED_BITS,
  )

  return bytesToHex(new Uint8Array(derivedBits))
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false
  }

  let diff = 0

  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return diff === 0
}

export function validateNumericPin(pin: string): string | null {
  if (!/^\d+$/.test(pin)) {
    return 'PIN must contain digits only.'
  }

  if (pin.length < APP_LOCK_PIN_MIN_LENGTH) {
    return `PIN must be at least ${APP_LOCK_PIN_MIN_LENGTH} digits.`
  }

  return null
}

export async function createAppLockPinVerifier(pin: string): Promise<AppLockPinVerifier> {
  if (!isValidPinInput(pin)) {
    throw new Error('PIN does not meet minimum requirements.')
  }

  const salt = getWebCrypto().getRandomValues(new Uint8Array(APP_LOCK_SALT_LENGTH))
  const verifierHex = await derivePinVerifierHex(pin, salt, APP_LOCK_PBKDF2_ITERATIONS)

  return {
    version: 1,
    algorithm: 'PBKDF2',
    hash: 'SHA-256',
    iterations: APP_LOCK_PBKDF2_ITERATIONS,
    saltHex: bytesToHex(salt),
    verifierHex,
  }
}

export async function verifyAppLockPin(
  pin: string,
  verifier: AppLockPinVerifier,
): Promise<boolean> {
  if (!/^\d+$/.test(pin) || pin.length === 0) {
    return false
  }

  const nextVerifierHex = await derivePinVerifierHex(
    pin,
    hexToBytes(verifier.saltHex),
    verifier.iterations,
  )

  return timingSafeEqual(nextVerifierHex, verifier.verifierHex)
}

export function shouldRequireAppLock(settings: AppSettings): boolean {
  return settings.lockAppOnLaunch === true && settings.appLockPinVerifier !== null
}