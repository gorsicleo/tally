import type { RecoveryCodeSet } from '../../domain/models'

const RECOVERY_CODE_COUNT = 8
const RECOVERY_CODE_PART_LENGTH = 4
const RECOVERY_CODE_PARTS = 2
const RECOVERY_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const RECOVERY_SALT_LENGTH = 16

interface RecoveryCodeVerificationResult {
  ok: boolean
  message: string | null
  nextSet: RecoveryCodeSet | null
}

function getWebCrypto(): Crypto {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Recovery codes are not available in this browser.')
  }

  return crypto
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
}

function normalizeRecoveryCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
}

function isValidRecoveryCodeInput(code: string): boolean {
  return normalizeRecoveryCode(code).length === RECOVERY_CODE_PART_LENGTH * RECOVERY_CODE_PARTS
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)

  getWebCrypto().getRandomValues(bytes)

  return bytes
}

function generateReadableCode(): string {
  const length = RECOVERY_CODE_PART_LENGTH * RECOVERY_CODE_PARTS
  const random = randomBytes(length)
  let normalized = ''

  for (let index = 0; index < length; index += 1) {
    const charIndex = random[index] % RECOVERY_CODE_ALPHABET.length
    normalized += RECOVERY_CODE_ALPHABET[charIndex]
  }

  const firstPart = normalized.slice(0, RECOVERY_CODE_PART_LENGTH)
  const secondPart = normalized.slice(RECOVERY_CODE_PART_LENGTH)

  return `${firstPart}-${secondPart}`
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

async function deriveRecoveryVerifierHex(code: string, saltHex: string): Promise<string> {
  const normalizedCode = normalizeRecoveryCode(code)
  const payload = `${saltHex}:${normalizedCode}`
  const digest = await getWebCrypto().subtle.digest('SHA-256', new TextEncoder().encode(payload))

  return bytesToHex(new Uint8Array(digest))
}

export function getRecoveryCodeSummary(set: RecoveryCodeSet | null | undefined): {
  total: number
  remaining: number
} {
  if (!set) {
    return { total: 0, remaining: 0 }
  }

  const total = set.verifiers.length
  const remaining = set.verifiers.filter((entry) => entry.usedAt === null).length

  return { total, remaining }
}

export async function createRecoveryCodeSet(): Promise<{
  plaintextCodes: string[]
  codeSet: RecoveryCodeSet
}> {
  const saltHex = bytesToHex(randomBytes(RECOVERY_SALT_LENGTH))
  const generatedAt = new Date().toISOString()
  const plaintextCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateReadableCode())

  const verifiers = await Promise.all(
    plaintextCodes.map(async (code, index) => ({
      id: `rc-${index + 1}`,
      verifierHex: await deriveRecoveryVerifierHex(code, saltHex),
      usedAt: null,
    })),
  )

  return {
    plaintextCodes,
    codeSet: {
      version: 1,
      hash: 'SHA-256',
      saltHex,
      generatedAt,
      verifiers,
    },
  }
}

export async function verifyAndConsumeRecoveryCode(
  code: string,
  set: RecoveryCodeSet | null | undefined,
): Promise<RecoveryCodeVerificationResult> {
  if (!set) {
    return {
      ok: false,
      message: 'Recovery codes are not configured.',
      nextSet: null,
    }
  }

  if (!isValidRecoveryCodeInput(code)) {
    return {
      ok: false,
      message: 'Recovery code is invalid.',
      nextSet: set,
    }
  }

  const nextVerifierHex = await deriveRecoveryVerifierHex(code, set.saltHex)
  const index = set.verifiers.findIndex(
    (entry) => entry.usedAt === null && timingSafeEqual(entry.verifierHex, nextVerifierHex),
  )

  if (index < 0) {
    return {
      ok: false,
      message: 'Recovery code is invalid or already used.',
      nextSet: set,
    }
  }

  const nextSet: RecoveryCodeSet = {
    ...set,
    verifiers: set.verifiers.map((entry, verifierIndex) =>
      verifierIndex === index
        ? {
            ...entry,
            usedAt: new Date().toISOString(),
          }
        : entry,
    ),
  }

  return {
    ok: true,
    message: null,
    nextSet,
  }
}
