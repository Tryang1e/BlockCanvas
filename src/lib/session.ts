import crypto from 'crypto'

/**
 * 세션 토큰 유효기간: 30일.
 * 쿠키의 maxAge 와 동일하게 맞춰, 토큰이 유출되더라도 만료 후에는 무효가 되도록 한다.
 */
export const SESSION_TTL_MS = 60 * 60 * 24 * 30 * 1000

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

function sign(data: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(data)
    .digest('base64url') // Base64url is URL-safe and standard (no '.' chars)
}

/**
 * Sign the session (creatorName) with HMAC-SHA256, embedding an expiry timestamp.
 *
 * Token format: "creatorName.expiryMs.signature"
 *  - 서명 대상은 "creatorName.expiryMs" 이므로 만료시각을 변조하면 검증에 실패한다.
 *  - 서명(base64url)·만료시각(숫자)에는 '.' 이 없으므로, creatorName 에 '.' 이 있어도
 *    오른쪽에서부터 분리하면 안전하게 파싱된다.
 */
export function signSession(creatorName: string, ttlMs: number = SESSION_TTL_MS): string {
  if (!creatorName) return ''
  const normalized = creatorName.toLowerCase()
  const expiry = Date.now() + ttlMs
  const payload = `${normalized}.${expiry}`
  return `${payload}.${sign(payload)}`
}

/**
 * Verify the session token.
 * Returns the raw creatorName if valid and not expired, or null otherwise.
 *
 * 구버전(만료 없는 "creatorName.signature", 2-파트) 토큰은 더 이상 유효하지 않으며
 * null 을 반환한다 — 해당 사용자는 재로그인이 필요하다.
 */
export function verifySession(token: string | undefined): string | null {
  if (!token) return null
  const parts = token.split('.')
  // 최소 3파트(name.expiry.signature) 필요. 구버전 2파트 토큰은 무효 처리.
  if (parts.length < 3) return null

  const providedSignature = parts[parts.length - 1]
  const expiryStr = parts[parts.length - 2]
  const signedData = parts.slice(0, parts.length - 1).join('.') // "name.expiry"
  const creatorName = parts.slice(0, parts.length - 2).join('.')

  if (!providedSignature || !expiryStr || !creatorName) return null

  const expectedSignature = sign(signedData)

  // Prevent timing attacks using crypto.timingSafeEqual
  const expectedBuf = Buffer.from(expectedSignature)
  const providedBuf = Buffer.from(providedSignature)

  if (expectedBuf.length !== providedBuf.length) {
    return null
  }

  if (!crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return null
  }

  // 서명이 유효해도 만료된 토큰은 거부한다.
  const expiry = Number(expiryStr)
  if (!Number.isFinite(expiry) || Date.now() > expiry) {
    return null
  }

  return creatorName
}
