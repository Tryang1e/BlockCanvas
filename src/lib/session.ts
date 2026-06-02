import crypto from 'crypto'

// Use environment variable SESSION_SECRET or a robust static fallback
const SESSION_SECRET = process.env.SESSION_SECRET || 'blockcanvas-fallback-super-secret-key-32chars!'

/**
 * Sign the session (creatorName) with HMAC-SHA256
 * Returns format: "creatorName.signature"
 */
export function signSession(creatorName: string): string {
  if (!creatorName) return ''
  const normalized = creatorName.toLowerCase()
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
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
    .createHmac('sha256', SESSION_SECRET)
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
