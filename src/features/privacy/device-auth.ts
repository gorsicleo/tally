import type { DeviceAuthCredential, DeviceAuthTransport } from '../../domain/models'

const DEVICE_AUTH_CHALLENGE_LENGTH = 32
const DEVICE_AUTH_USER_ID_LENGTH = 16
const DEVICE_AUTH_TIMEOUT_MS = 60_000

interface DeviceAuthCheckResult {
  ok: boolean
  message: string | null
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function base64UrlToBytes(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const decoded = atob(padded)
  const bytes = new Uint8Array(decoded.length)

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }

  return toArrayBuffer(bytes)
}

function randomBytes(length: number): ArrayBuffer {
  const bytes = new Uint8Array(length)

  crypto.getRandomValues(bytes)

  return toArrayBuffer(bytes)
}

function isDeviceAuthTransport(value: unknown): value is DeviceAuthTransport {
  return value === 'usb' ||
    value === 'nfc' ||
    value === 'ble' ||
    value === 'internal' ||
    value === 'hybrid'
}

function readCredentialTransports(response: AuthenticatorAttestationResponse): DeviceAuthTransport[] {
  if (typeof response.getTransports !== 'function') {
    return []
  }

  return response
    .getTransports()
    .filter((transport): transport is DeviceAuthTransport => isDeviceAuthTransport(transport))
}

function resolveUnavailableMessage(): string {
  return 'Device authentication is not available on this device.'
}

export function isDeviceAuthenticationSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  if (!window.isSecureContext) {
    return false
  }

  if (typeof PublicKeyCredential === 'undefined' || !navigator.credentials) {
    return false
  }

  return (
    typeof navigator.credentials.create === 'function' &&
    typeof navigator.credentials.get === 'function'
  )
}

export function isDeviceAuthenticationConfigured(
  credential: DeviceAuthCredential | null | undefined,
): credential is DeviceAuthCredential {
  return credential !== null && credential !== undefined
}

export async function registerDeviceAuthenticationCredential(): Promise<DeviceAuthCredential> {
  if (!isDeviceAuthenticationSupported()) {
    throw new Error(resolveUnavailableMessage())
  }

  // This is a local-only registration marker for UX and fallback orchestration.
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(DEVICE_AUTH_CHALLENGE_LENGTH),
      rp: {
        name: 'Tally',
      },
      user: {
        id: randomBytes(DEVICE_AUTH_USER_ID_LENGTH),
        name: 'tally-local-user',
        displayName: 'Tally User',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      timeout: DEVICE_AUTH_TIMEOUT_MS,
      attestation: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    },
  })) as PublicKeyCredential | null

  if (!credential || credential.rawId.byteLength === 0) {
    throw new Error('Device authentication setup did not complete.')
  }

  const response = credential.response
  const transports =
    response instanceof AuthenticatorAttestationResponse
      ? readCredentialTransports(response)
      : []

  return {
    version: 1,
    credentialId: bytesToBase64Url(new Uint8Array(credential.rawId)),
    createdAt: new Date().toISOString(),
    ...(transports.length > 0 ? { transports } : {}),
  }
}

export async function authenticateWithDeviceCredential(
  credential: DeviceAuthCredential | null | undefined,
): Promise<DeviceAuthCheckResult> {
  if (!isDeviceAuthenticationConfigured(credential)) {
    return {
      ok: false,
      message: 'Device authentication is not configured.',
    }
  }

  if (!isDeviceAuthenticationSupported()) {
    return {
      ok: false,
      message: resolveUnavailableMessage(),
    }
  }

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(DEVICE_AUTH_CHALLENGE_LENGTH),
        allowCredentials: [
          {
            type: 'public-key',
            id: base64UrlToBytes(credential.credentialId),
            transports: credential.transports ? [...credential.transports] : undefined,
          },
        ],
        timeout: DEVICE_AUTH_TIMEOUT_MS,
        userVerification: 'preferred',
      },
    })

    if (!assertion) {
      return {
        ok: false,
        message: 'Device authentication failed. Use PIN instead.',
      }
    }

    return {
      ok: true,
      message: null,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return {
        ok: false,
        message: 'Device authentication was cancelled. Use PIN instead.',
      }
    }

    return {
      ok: false,
      message: 'Device authentication failed. Use PIN instead.',
    }
  }
}
