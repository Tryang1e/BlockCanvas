import crypto from "crypto";

// 연동 허브(auth.craftopia.work) 전용 세션 — 크리에이터 세션과 별개.
// LinkedAccount.id 를 HMAC 서명해 쿠키에 담는다(만료 30일).

export const HUB_COOKIE = "hub_session";
const TTL_MS = 1000 * 60 * 60 * 24 * 30;

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET is not set or too short.");
  }
  return s;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
}

/** LinkedAccount.id 로 허브 세션 토큰 생성. */
export function signHubSession(linkedAccountId: string, ttlMs: number = TTL_MS): string {
  const expiry = Date.now() + ttlMs;
  const payload = `${linkedAccountId}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

/** 허브 세션 토큰 검증 → 유효하면 LinkedAccount.id, 아니면 null. */
export function verifyHubSession(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 3) return null;

  const providedSig = parts[parts.length - 1];
  const expiryStr = parts[parts.length - 2];
  const id = parts.slice(0, parts.length - 2).join(".");
  if (!providedSig || !expiryStr || !id) return null;

  const expected = sign(`${id}.${expiryStr}`);
  const a = Buffer.from(expected);
  const b = Buffer.from(providedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return null;
  return id;
}
