"use server";

import { sessionProfile } from "@/lib/server-auth";
import {
  purchaseItemForProfile,
  buildShopSnapshot,
  subscribeForProfile,
  changeNicknameForProfile,
  purchasePlotSlotForProfile,
} from "@/lib/shopPurchase";

async function authedProfile() {
  return sessionProfile(); // 서명·만료·token_version 대조까지 (무효화 세션 거부)
}

/** 상점 데이터 — 일반 카탈로그 + 특별 상품(닉변권·구독) + 코인 잔액 + 마크 연동 여부.
 *  렌더 스냅샷은 인게임 GUI(api/shop/info)와 공유하는 buildShopSnapshot 으로 구성(진실원본 일치). */
export async function getMyShop() {
  try {
    const profile = await authedProfile();
    if (!profile) return { success: false as const, error: "로그인이 필요합니다." };
    const snapshot = await buildShopSnapshot(profile);
    return { success: true as const, ...snapshot };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 일반 카탈로그 구매(웹 세션) — 공용 코어(purchaseItemForProfile)에 위임. 인게임 /상점구매와 동일 로직. */
export async function purchaseItem(itemKey: string) {
  try {
    const profile = await authedProfile();
    if (!profile) return { success: false as const, error: "로그인이 필요합니다." };
    const r = await purchaseItemForProfile(profile, itemKey);
    return r.success
      ? { success: true as const, message: r.message, balance: r.balance ?? null }
      : { success: false as const, error: r.error };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 닉네임 변경권 — 공용 코어(changeNicknameForProfile)에 위임. 인게임 상점 GUI와 동일 로직.
 * (검증 → 코인 차감 → CMI 닉 적용 → 실패 시 환불은 코어가 처리)
 */
export async function changeNicknameAction(newNick: string) {
  try {
    const profile = await authedProfile();
    if (!profile) return { success: false as const, error: "로그인이 필요합니다." };
    const r = await changeNicknameForProfile(profile, newNick);
    return r.success
      ? { success: true as const, message: r.message, balance: r.balance ?? null, nick: r.nick }
      : { success: false as const, error: r.error };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 플롯 확장 구매권 — 공용 코어(purchasePlotSlotForProfile)에 위임. 인게임 상점 GUI와 동일 로직.
 * ⚠ 누적형(소유 차단 없음) — 구매마다 최대 플롯 claim 한도 +1, 가격은 2배씩 증가.
 */
export async function purchasePlotSlot() {
  try {
    const profile = await authedProfile();
    if (!profile) return { success: false as const, error: "로그인이 필요합니다." };
    const r = await purchasePlotSlotForProfile(profile);
    return r.success
      ? { success: true as const, message: r.message, balance: r.balance ?? null, bonus: r.bonus, nextPrice: r.nextPrice }
      : { success: false as const, error: r.error };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * BLOCKCANVAS 구독권 — 공용 코어(subscribeForProfile)에 위임. 인게임 상점 GUI와 동일 로직.
 * (코인 차감 → subscription_until 연장 + 승격 → 쿼터 재평가 → 인게임 동기화는 코어가 처리)
 */
export async function purchaseSubscription() {
  try {
    const profile = await authedProfile();
    if (!profile) return { success: false as const, error: "로그인이 필요합니다." };
    const r = await subscribeForProfile(profile);
    return r.success
      ? { success: true as const, message: r.message, balance: r.balance ?? null, until: r.until, daysLeft: r.daysLeft }
      : { success: false as const, error: r.error };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}
