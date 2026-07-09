// BLOCKCANVAS 구독 — 코인 구매 / (추후) Patreon 공통 로직.
//  핵심: 구독 상태를 단일 만료일(Profile.subscription_until)로만 표현하고,
//  웹 구매든 Patreon 갱신이든 항상 extendSubscriptionUntil 로 "이어붙여" 연장한다.
//  → 소스가 달라도 기간이 합산된다(Patreon 1개월 + 웹 구매 1개월 = 2개월).
//  순수 함수만 — 서버 의존성 없음(클라이언트에서도 import 가능). DB 쓰기는 호출측(server action)에서.

const GB = 1024 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

function envNum(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 1회 구매(또는 Patreon 1주기)당 연장되는 구독 일수. */
export const SUBSCRIPTION_DAYS = Math.round(envNum("SHOP_SUBSCRIPTION_DAYS", 30));
/** 구독권 가격(코인). */
export const SUBSCRIPTION_PRICE = envNum("SHOP_SUBSCRIPTION_PRICE", 50000);
/** 구독 중 추가되는 클라우드 저장 용량(바이트). 기본 5GB. 미구독 시 0. */
export const SUBSCRIPTION_QUOTA_BONUS_BYTES = envNum("SHOP_SUBSCRIPTION_QUOTA_GB", 5) * GB;

/** 현재 구독 중인지(만료일이 미래인지). null/과거 = 미구독. */
export function isSubscribed(until: Date | null | undefined): boolean {
  return until != null && until.getTime() > Date.now();
}

/**
 * 구독을 days 만큼 연장한 새 만료일을 계산한다(소스 무관 누적의 핵심).
 *  - 이미 구독 중(미래 만료일)이면 그 만료일에서 이어붙인다(잔여 기간 보존 → 합산).
 *  - 미구독/만료면 지금부터 시작한다.
 * 웹 구매·Patreon 갱신 모두 이 함수로 연장하면 자연히 기간이 합쳐진다.
 */
export function extendSubscriptionUntil(current: Date | null | undefined, days: number): Date {
  const base = isSubscribed(current) ? (current as Date).getTime() : Date.now();
  return new Date(base + days * DAY_MS);
}

/**
 * 구독 만료일을 "적어도 지금+days" 로 끌어올린다(멱등 — 이미 그보다 미래면 그대로).
 *  - Patreon 활성 후원자 연결 시 사용: 재연결을 반복해도 기간이 누적되지 않는다(악용 방지).
 *  - extendSubscriptionUntil(누적/코인 구매)과 달리 더하지 않고 max 로 보장선만 올린다.
 *    → 코인 구매로 이미 더 먼 만료일이면 줄이지 않고, 코인 구매는 이 보장분 위에 별도 가산된다.
 */
export function subscriptionUntilAtLeast(current: Date | null | undefined, days: number): Date {
  const floor = Date.now() + days * DAY_MS;
  const cur = current != null ? current.getTime() : 0;
  return new Date(Math.max(cur, floor));
}

/** 구독 상태에 따른 클라우드 쿼터 보너스(바이트). 미구독 = 0. (만료 시 자동으로 0 — 별도 스윕 불필요) */
export function subscriptionQuotaBonus(until: Date | null | undefined): number {
  return isSubscribed(until) ? SUBSCRIPTION_QUOTA_BONUS_BYTES : 0;
}

/** 남은 구독 일수(올림). 미구독 = 0. 표시용. */
export function subscriptionDaysLeft(until: Date | null | undefined): number {
  if (!isSubscribed(until)) return 0;
  return Math.ceil(((until as Date).getTime() - Date.now()) / DAY_MS);
}
