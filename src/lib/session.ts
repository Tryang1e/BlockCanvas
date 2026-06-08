import crypto from 'crypto'

/**
 * Resolve the session signing secret from the environment.
 * No insecure fallback: if the secret is missing or too short the app fails
 * closed (throws) instead of silently signing sessions with a publicly-known
 * key. Set a strong random SESSION_SECRET in .env and restart the server.
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET is not set or is too short (need >= 32 chars). ' +
      'Set a strong random value in .env and restart the server.'
    )
  }
  return secret
}

/**
 * Sign the session (creatorName) with HMAC-SHA256
 * Returns format: "creatorName.signature"
 */
export function signSession(creatorName: string): string {
  if (!creatorName) return ''
  const normalized = creatorName.toLowerCase()
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(normalized)
    .digest('base64url') // Base64url is URL-safe and standard
  return `${normalized}.${signature}`
}

/**
 * Verify the session token.
 * Returns the raw creatorName if valid, or null if invalid/forged/empty.
 */
export function verifySession(token: string | undefined): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [creatorName, providedSignature] = parts
  if (!creatorName || !providedSignature) return null

  const expectedSignature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(creatorName)
    .digest('base64url')

  // Prevent timing attacks using crypto.timingSafeEqual
  const expectedBuf = Buffer.from(expectedSignature)
  const providedBuf = Buffer.from(providedSignature)

  if (expectedBuf.length !== providedBuf.length) {
    return null
  }

  const isValid = crypto.timingSafeEqual(expectedBuf, providedBuf)
  return isValid ? creatorName : null
}
