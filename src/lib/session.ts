import crypto from 'crypto'

/**
 * 세션 토큰 유효기간: 30일.
 * 쿠키의 maxAge 와 동일하게 맞춰, 토큰이 유출되더라도 만료 후에는 무효가 되도록 한다.
 */
export const SESSION_TTL_MS = 60 * 60 * 24 * 30 * 1000

/**
 * Resolve the session signing secret from the environment.
 * No insecure fallback: if the secret is missing or too short the app fails
 * closed (throws) instead of silently signing sessions with a publicly-known key.
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
  return crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url')
}

/**
 * 세션 서명 — 토큰 형식 "name.tokenVersion.expiryMs.signature" (HMAC-SHA256).
 *  - 서명 대상 = "name.tokenVersion.expiryMs" 이므로 어느 부분을 변조해도 검증에 실패한다.
 *  - tokenVersion: 비밀번호 변경/재설정 시 Profile.token_version 이 +1 → 구버전 토큰이 무효화된다
 *    (실제 대조는 verifySessionFull + DB token_version 비교: server-auth 의 sessionProfile/requireAuth).
 *  - signature(base64url)·version(숫자)·expiry(숫자) 에는 '.' 이 없으므로, name 에 '.' 이 있어도
 *    오른쪽에서부터 분리하면 안전하게 파싱된다.
 *  - 구버전(만료 없는 2파트 / 버전 없는 3파트) 토큰은 더 이상 유효하지 않다 → 재로그인 필요.
 *
 * ⚠ 2번째 인자는 이제 tokenVersion 이다(과거의 ttlMs 가 아님). ttl 은 3번째 인자.
 */
export function signSession(name: string, tokenVersion: number = 0, ttlMs: number = SESSION_TTL_MS): string {
  if (!name) return ''
  const normalized = name.toLowerCase()
  const expiry = Date.now() + ttlMs
  const payload = `${normalized}.${tokenVersion}.${expiry}`
  return `${payload}.${sign(payload)}`
}

/** 내부: 서명·만료를 검증하고 { name, version } 을 반환한다. 실패 시 null. */
function parseAndVerify(token: string | undefined): { name: string; version: number } | null {
  if (!token) return null
  const parts = token.split('.')
  // name.version.expiry.signature → 최소 4파트. 구버전(3파트 이하) 토큰은 무효 처리.
  if (parts.length < 4) return null

  const providedSignature = parts[parts.length - 1]
  const expiryStr = parts[parts.length - 2]
  const versionStr = parts[parts.length - 3]
  const signedData = parts.slice(0, parts.length - 1).join('.') // "name.version.expiry"
  const name = parts.slice(0, parts.length - 3).join('.')

  if (!providedSignature || !expiryStr || !versionStr || !name) return null

  // Prevent timing attacks using crypto.timingSafeEqual
  const expectedBuf = Buffer.from(sign(signedData))
  const providedBuf = Buffer.from(providedSignature)
  if (expectedBuf.length !== providedBuf.length) return null
  if (!crypto.timingSafeEqual(expectedBuf, providedBuf)) return null

  // 서명이 유효해도 만료된 토큰은 거부한다.
  const expiry = Number(expiryStr)
  if (!Number.isFinite(expiry) || Date.now() > expiry) return null

  const version = Number(versionStr)
  if (!Number.isInteger(version) || version < 0) return null

  return { name, version }
}

/**
 * 세션 토큰 검증 → 유효하면 name(creatorName), 아니면 null.
 * ⚠ 서명·만료만 본다(토큰의 버전은 파싱하지만 DB 의 현재 token_version 과 대조하지 않음).
 *    세션 무효화(비번 변경 시 구세션 거부)까지 보장하려면 verifySessionFull + DB 대조
 *    (server-auth 의 sessionProfile / requireAuth)를 쓸 것. 표시·가벼운 게이트엔 이 함수로 충분.
 */
export function verifySession(token: string | undefined): string | null {
  const r = parseAndVerify(token)
  return r ? r.name : null
}

/** 세션 검증 + 토큰 버전 반환(DB token_version 과 대조해 무효화 판정용). 실패 시 null. */
export function verifySessionFull(token: string | undefined): { name: string; version: number } | null {
  return parseAndVerify(token)
}
