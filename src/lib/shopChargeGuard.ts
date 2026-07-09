import { prisma } from "@/lib/prisma";
import { awardCoins } from "@/lib/minecraft";
import { opsAlert } from "@/lib/opsAlert";

/**
 * 상점 결제 사가 가드 — CMI 차감(chargeCoins)과 웹 부여(구매기록/혜택/환불) 사이에서 단일 Next 프로세스가
 * 죽어도 "차감됐는데 미부여·미환불"로 코인이 소실되지 않게 한다.
 *
 * 흐름(각 상점 코어):
 *   const id = await beginCharge(...)           // status=charging 기록(차감 전)
 *   const charge = await chargeCoins(...)
 *   if (!charge.success) { await resolveIntent(id); return }   // 차감 실패 → 종료(환불 없음)
 *   await markCharged(id)                        // 차감 '확인'
 *   try { ...부여... } catch { await refundIntent(id, {...}); return }  // 부여 실패 → 내구성 환불
 *   await resolveIntent(id)                       // 부여 성공 → 종료
 *
 * 복구: 접속 시 reconcileStuckCharges() 가 status='charged' 로 STUCK_CHARGED_MS 이상 방치된 건
 * (=부여 도중 크래시)을 내구성 환불한다. 환불은 CoinAward(delivered=false) 원장 + awardCoins 로,
 * 실패해도 flushPendingCoins 가 다음 접속에 재시도한다(정산 seam 재사용). dailyEarnCap 미적용.
 *
 * ⚠ status='charging'(차감 여부 불명) 은 자동 환불하지 않는다 — 실제로 차감 안 됐다면 무상 지급이 되므로.
 *    이 좁은 창의 건은 reconcile 이 로그만 남긴다(수동 확인용, 극히 드묾).
 */

const STUCK_CHARGED_MS = 5 * 60 * 1000; // charged 상태로 이 시간 이상 방치 = 부여 중 크래시로 간주 → 환불
const STALE_CHARGING_MS = 30 * 60 * 1000; // charging 으로 이 시간 이상 방치 = 관측/로그(무상지급 위험이라 자동환불 안 함)

/** 차감 '전' 의도 기록. 실패 시 null(가드 인프라 장애가 구매를 막지 않게 — best-effort). */
export async function beginCharge(input: {
  profileId?: string | null;
  minecraftUuid: string;
  amount: number;
  purpose: string;
}): Promise<string | null> {
  const amt = Math.round(input.amount);
  if (!(amt > 0) || !input.minecraftUuid) return null;
  try {
    const row = await prisma.chargeIntent.create({
      data: {
        profile_id: input.profileId ?? null,
        minecraft_uuid: input.minecraftUuid,
        amount: amt,
        purpose: input.purpose.slice(0, 100),
        status: "charging",
      },
      select: { id: true },
    });
    return row.id;
  } catch {
    return null;
  }
}

/** 차감 성공 직후 — 'charged'(차감 확인)로 표시. 이 상태의 건만 크래시 시 자동 환불 대상이 된다. */
export async function markCharged(intentId: string | null): Promise<void> {
  if (!intentId) return;
  await prisma.chargeIntent
    .update({ where: { id: intentId }, data: { status: "charged" } })
    .catch(() => {});
}

/** 부여 성공/차감 실패 등 — 의도 종료(resolved). */
export async function resolveIntent(intentId: string | null): Promise<void> {
  if (!intentId) return;
  await prisma.chargeIntent
    .update({ where: { id: intentId }, data: { status: "resolved", resolved_at: new Date() } })
    .catch(() => {});
}

/** delivered=false 원장을 CMI 재시도 — 성공 시 delivered=true, 실패면 flushPendingCoins 가 접속 시 재시도. */
async function retryAward(awardId: string, minecraftUuid: string, amount: number, reason: string): Promise<void> {
  const r = await awardCoins(minecraftUuid, amount, reason, awardId);
  if (r.success) {
    await prisma.coinAward.update({ where: { id: awardId }, data: { delivered: true } }).catch(() => {});
  }
}

/**
 * 내구성 환불 — CoinAward(delivered=false, source=shop_refund) 원장 생성 후 awardCoins.
 * intent 당 refund_award_id 로 환불 원장을 1개로 고정(이중 환불 방지). dailyEarnCap 미적용(환불은 캡 대상 아님).
 * intentId=null 이면(가드 미가동) 추적 없는 1회 지급으로 폴백(기존 동작).
 */
async function durableRefund(minecraftUuid: string, amount: number, reason: string, intentId: string | null): Promise<void> {
  const amt = Math.round(amount);
  if (!(amt > 0) || !minecraftUuid) return;

  if (intentId) {
    const existing = await prisma.chargeIntent
      .findUnique({ where: { id: intentId }, select: { refund_award_id: true } })
      .catch(() => null);
    if (existing?.refund_award_id) {
      // 이미 이 intent 로 환불 원장이 있음 → 재생성 없이 미전달분만 재시도(중복 환불 방지).
      await retryAward(existing.refund_award_id, minecraftUuid, amt, reason);
      return;
    }
  }

  let awardId: string | null = null;
  try {
    const row = await prisma.coinAward.create({
      data: {
        minecraft_uuid: minecraftUuid,
        amount: amt,
        source: "shop_refund",
        direction: "in",
        reason: reason.slice(0, 200) || null,
        delivered: false,
      },
      select: { id: true },
    });
    awardId = row.id;
  } catch {
    /* 원장 생성 실패 → 아래 폴백 */
  }

  if (!awardId) {
    // 원장 생성 실패(DB blip) → 최선의 1회 지급(추적 없음). 기존 동작과 동일.
    await awardCoins(minecraftUuid, amt, reason).catch(() => {});
    return;
  }
  if (intentId) {
    await prisma.chargeIntent.update({ where: { id: intentId }, data: { refund_award_id: awardId } }).catch(() => {});
  }
  await retryAward(awardId, minecraftUuid, amt, reason);
}

/** 부여 실패 시 환불(내구성) + 의도 종료. */
export async function refundIntent(
  intentId: string | null,
  input: { minecraftUuid: string; amount: number; reason: string }
): Promise<void> {
  await durableRefund(input.minecraftUuid, input.amount, input.reason, intentId);
  await resolveIntent(intentId);
}

/**
 * 접속 시 정산 — status='charged'(차감 확인) 로 STUCK_CHARGED_MS 이상 방치된 건(부여 중 크래시)을 내구성 환불한다.
 * 'charging'(차감 여부 불명) 건은 STALE_CHARGING_MS 초과 시 로그만 남긴다(무상지급 위험이라 자동환불 안 함).
 * flushPendingCoins 와 같은 접속 훅에서 호출한다(role-sync). best-effort.
 */
export async function reconcileStuckCharges(minecraftUuid: string): Promise<void> {
  if (!minecraftUuid) return;
  const now = Date.now();
  const chargedCutoff = new Date(now - STUCK_CHARGED_MS);

  const stuck = await prisma.chargeIntent
    .findMany({
      where: { minecraft_uuid: minecraftUuid, status: "charged", created_at: { lt: chargedCutoff } },
      select: { id: true, amount: true, purpose: true },
      take: 20,
    })
    .catch(() => [] as { id: string; amount: number; purpose: string }[]);

  for (const it of stuck) {
    await refundIntent(it.id, {
      minecraftUuid,
      amount: it.amount,
      reason: `상점 결제 미완료 자동 환불 (${it.purpose})`,
    });
  }

  // 관측: 차감 여부 불명(charging) 으로 오래 방치된 건 — 자동환불하지 않고 로그만(수동 확인).
  const staleCharging = await prisma.chargeIntent
    .count({
      where: { minecraft_uuid: minecraftUuid, status: "charging", created_at: { lt: new Date(now - STALE_CHARGING_MS) } },
    })
    .catch(() => 0);
  if (staleCharging > 0) {
    // 차감 여부 불명(자동환불 불가) — 운영자 수동 확인 필요. 통지.
    await opsAlert(
      "shop-charge-stale",
      `${minecraftUuid}: 차감 여부 불명(charging) 상점 결제 ${staleCharging}건 방치 — 수동 확인 필요(자동 환불 대상 아님).`,
      { level: "warn", debounceMs: 6 * 60 * 60 * 1000 }
    ).catch(() => {});
  }
  if (stuck.length > 0) {
    // 차감 확인된 미완료 결제를 자동 환불했음 — 관측용 통지(빈번하면 코어 문제 신호).
    await opsAlert(
      "shop-charge-refunded",
      `${minecraftUuid}: 미완료 상점 결제 ${stuck.length}건 자동 환불(charged→refund).`,
      { level: "warn", debounceMs: 60 * 60 * 1000 }
    ).catch(() => {});
  }
}
