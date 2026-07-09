import { prisma } from "@/lib/prisma";
import {
  chargeCoins,
  getEconomyBalance,
  getPlotClaimInfo,
  setMinecraftNickname,
  syncSubscription,
} from "@/lib/minecraft";
import { findShopItem, SHOP_ITEMS } from "@/lib/shop";
import { validateNickname, NICK_MIN_LEN, NICK_MAX_LEN } from "@/lib/nicknameFilter";
import {
  SUBSCRIPTION_QUOTA_BONUS_BYTES,
  isSubscribed,
  extendSubscriptionUntil,
  subscriptionDaysLeft,
} from "@/lib/subscription";
import { evaluateQuota } from "@/lib/worldQuotaEnforcement";
import { getEconomyConfig, logCoinSpend } from "@/lib/economyConfig";
import { beginCharge, markCharged, resolveIntent, refundIntent } from "@/lib/shopChargeGuard";

/**
 * 상점 구매 코어 — 웹 세션 액션(actions/shop)과 인게임 인바운드 라우트(api/shop/purchase)가 공유.
 * 소유확인 → 코인 차감(서버 CMI) → 구매 기록(실패 시 환불). profile 은 호출 측에서 인증/해석.
 * 품목별 효과(혜택 부여 등)는 구매 성공 후 호출 측에서 적용한다.
 */
export async function purchaseItemForProfile(
  profile: { id: string; creator_name: string; minecraft_uuid: string | null },
  itemKey: string
): Promise<{ success: boolean; message?: string; error?: string; balance?: number | null }> {
  if (!profile.minecraft_uuid) return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };
  const item = findShopItem(itemKey);
  if (!item) return { success: false, error: "존재하지 않는 상품입니다." };

  const already = await prisma.purchase.findUnique({
    where: { profile_id_item_key: { profile_id: profile.id, item_key: item.key } },
    select: { id: true },
  });
  if (already) return { success: false, error: "이미 보유한 상품입니다." };

  // 결제 사가 가드 — 차감~부여 사이 크래시 시 접속 정산으로 자동 환불(shopChargeGuard).
  const intentId = await beginCharge({ profileId: profile.id, minecraftUuid: profile.minecraft_uuid, amount: item.price, purpose: `shop_item:${item.key}` });

  // 1) 코인 차감(서버 CMI). 실패 시 중단.
  const charge = await chargeCoins(profile.minecraft_uuid, item.price);
  if (!charge.success) {
    await resolveIntent(intentId);
    return {
      success: false,
      error:
        charge.status === 402 ? "코인이 부족합니다." :
        charge.status === 503 ? "경제 시스템이 비활성 상태입니다. (관리자 문의)" :
        "결제에 실패했습니다.",
    };
  }
  await markCharged(intentId);

  // 2) 소유 기록(실패 시 환불).
  try {
    await prisma.purchase.create({
      data: { profile_id: profile.id, item_key: item.key, kind: item.kind, price: item.price },
    });
  } catch {
    await refundIntent(intentId, { minecraftUuid: profile.minecraft_uuid, amount: item.price, reason: "구매 취소 환불" });
    return { success: false, error: "구매 처리 중 오류가 발생했습니다. (코인 환불됨)" };
  }
  await resolveIntent(intentId);

  await prisma.creatorLog.create({
    data: { creator_name: profile.creator_name, action: "SHOP_BUY", target_id: item.key, details: `-${item.price}코인` },
  }).catch(() => {});
  // 경제 원장 — 상점 구매(소각). 환불 구간을 지난 성공 시점에만 기록(유령 유출 방지).
  await logCoinSpend({ profileId: profile.id, minecraftUuid: profile.minecraft_uuid, amount: item.price, source: "shop_item", reason: item.label });

  return { success: true, message: `'${item.label}'을(를) 구매했습니다.`, balance: charge.balance ?? null };
}

/** 인게임 상점 GUI / 웹 상점 화면이 공유하는 렌더 스냅샷 모양. */
export interface ShopSnapshot {
  items: { key: string; label: string; description: string; price: number }[];
  owned: string[];
  balance: number | null; // 코인 잔액(미연동/경제 미가동 시 null)
  linked: boolean; // 마크 연동 여부
  nick: { price: number; minLen: number; maxLen: number };
  subscription: {
    price: number;
    days: number;
    quotaBonusBytes: number;
    active: boolean;
    until: string | null; // ISO
    daysLeft: number;
  };
  plotSlot: {
    price: number; // 다음 구매 가격(300×2^bonus). max 도달 시 0.
    bonus: number; // 현재까지 구매한 확장 수(=최대 플롯 한도 개인 보너스)
    max: number; // 1인당 최대 구매 개수(0=무제한)
    baseLimit: number | null; // 역할(LP 그룹) 기본 claim 한도. 미연동/오프라인 시 null. 0=무제한.
    limit: number | null; // 현재 최종 한도(base+bonus). 0=무제한.
    owned: number | null; // 현재 소유 플롯 수
  };
}

/**
 * 상점 렌더 스냅샷 — 웹 세션 화면(actions/shop.getMyShop)과 인게임 GUI(api/shop/info)가 공유.
 * 카탈로그·닉가격·구독 정책은 전부 단일 소스(lib/shop, lib/subscription)에서 읽어 진실원본 일치.
 */
export async function buildShopSnapshot(
  profile: { id: string; minecraft_uuid: string | null; subscription_until: Date | null; plot_slot_bonus: number }
): Promise<ShopSnapshot> {
  const owned = await prisma.purchase.findMany({
    where: { profile_id: profile.id },
    select: { item_key: true },
  });

  const cfg = await getEconomyConfig(); // 가격은 SiteSetting(어드민 편집) → 웹·인게임 GUI 공통

  // 잔액 + 플롯 claim 한도(base/limit/owned)는 인게임 서버 조회(best-effort). 미연동/오프라인이면 null.
  let balance: number | null = null;
  let claim: { base?: number; limit?: number; owned?: number } = {};
  if (profile.minecraft_uuid) {
    const b = await getEconomyBalance(profile.minecraft_uuid);
    balance = b.balance;
    const info = await getPlotClaimInfo(profile.minecraft_uuid, profile.plot_slot_bonus);
    if (info.success) claim = { base: info.base, limit: info.limit, owned: info.owned };
  }

  const slotBonus = Math.max(0, profile.plot_slot_bonus ?? 0);
  const atMax = cfg.plotSlotMax > 0 && slotBonus >= cfg.plotSlotMax;

  return {
    items: SHOP_ITEMS.map((i) => ({ key: i.key, label: i.label, description: i.description, price: i.price })),
    owned: owned.map((o) => o.item_key),
    balance,
    linked: !!profile.minecraft_uuid,
    nick: { price: cfg.nickPrice, minLen: NICK_MIN_LEN, maxLen: NICK_MAX_LEN },
    subscription: {
      price: cfg.subscriptionPrice,
      days: cfg.subscriptionDays,
      quotaBonusBytes: SUBSCRIPTION_QUOTA_BONUS_BYTES,
      active: isSubscribed(profile.subscription_until),
      until: profile.subscription_until ? profile.subscription_until.toISOString() : null,
      daysLeft: subscriptionDaysLeft(profile.subscription_until),
    },
    plotSlot: {
      price: atMax ? 0 : plotSlotPrice(slotBonus, cfg.plotSlotBase),
      bonus: slotBonus,
      max: cfg.plotSlotMax,
      baseLimit: claim.base ?? null,
      limit: claim.limit ?? null,
      owned: claim.owned ?? null,
    },
  };
}

/**
 * BLOCKCANVAS 구독 구매/연장 코어 — 웹 세션 액션(actions/shop.purchaseSubscription)과
 * 인게임 인바운드 라우트(api/shop/subscription)가 공유. profile 은 호출 측에서 인증/해석.
 * ⚠ 구독은 누적형(소유 차단 없음) — purchaseItemForProfile 을 거치면 안 된다(전용 코어).
 * 코인 차감 → subscription_until 연장(+승격, 실패 시 환불) → 쿼터 재평가 → 인게임 동기화(best-effort).
 * 환불 try 는 charge→update 구간만 감싼다(이후 quota/sync 실패가 활성 구독을 환불시키지 않게).
 */
export async function subscribeForProfile(profile: {
  id: string;
  creator_name: string;
  minecraft_uuid: string | null;
  role: string;
  subscription_until: Date | null;
  role_granted_by_sub: boolean;
}): Promise<{ success: boolean; message?: string; error?: string; balance?: number | null; until?: string; daysLeft?: number }> {
  if (!profile.minecraft_uuid) return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };

  const cfg = await getEconomyConfig(); // 가격/기간은 SiteSetting(어드민 편집)

  // 결제 사가 가드 — 차감~부여 사이 크래시 시 접속 정산으로 자동 환불(shopChargeGuard).
  const intentId = await beginCharge({ profileId: profile.id, minecraftUuid: profile.minecraft_uuid, amount: cfg.subscriptionPrice, purpose: "shop_subscription" });

  // 1) 코인 차감
  const charge = await chargeCoins(profile.minecraft_uuid, cfg.subscriptionPrice);
  if (!charge.success) {
    await resolveIntent(intentId);
    return {
      success: false,
      error:
        charge.status === 402 ? "코인이 부족합니다." :
        charge.status === 503 ? "경제 시스템이 비활성 상태입니다. (관리자 문의)" :
        "결제에 실패했습니다.",
    };
  }
  await markCharged(intentId);
  // 2) 구독 연장(누적) + 포트폴리오 혜택: role=user 면 creator 로 승격(role_granted_by_sub 표식).
  const promote = (profile.role || "").toLowerCase() === "user";
  let until: Date;
  try {
    const updated = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        subscription_until: extendSubscriptionUntil(profile.subscription_until, cfg.subscriptionDays),
        ...(promote ? { role: "creator", role_granted_by_sub: true } : {}),
      },
      select: { subscription_until: true },
    });
    until = updated.subscription_until as Date;
  } catch {
    await refundIntent(intentId, { minecraftUuid: profile.minecraft_uuid, amount: cfg.subscriptionPrice, reason: "구독 결제 실패 환불" });
    return { success: false, error: "구독 처리에 실패했습니다. (코인 환불됨)" };
  }
  await resolveIntent(intentId);
  // 3) 쿼터 재평가 — 용량 혜택으로 잠금/경고가 풀릴 수 있다(실패는 무시).
  try { await evaluateQuota(profile.id); } catch { /* 평가 실패는 무시 */ }
  // 4) 인게임 동기화 — 구독자 권한(코인 부스트 등)을 새 만료일로 갱신. best-effort(실패해도 구독 유효).
  try { await syncSubscription(profile.minecraft_uuid, until); } catch { /* 동기화 실패는 무시 */ }

  await prisma.creatorLog.create({
    data: { creator_name: profile.creator_name, action: "SHOP_SUBSCRIPTION", target_id: until.toISOString(), details: `-${cfg.subscriptionPrice}코인 (+${cfg.subscriptionDays}일)` },
  }).catch(() => {});
  // 경제 원장 — 구독 결제(소각). 환불 구간을 지난 성공 시점에만 기록.
  await logCoinSpend({ profileId: profile.id, minecraftUuid: profile.minecraft_uuid, amount: cfg.subscriptionPrice, source: "shop_subscription", reason: `구독 +${cfg.subscriptionDays}일` });

  return {
    success: true,
    message: `구독이 ${cfg.subscriptionDays}일 연장됐어요.`,
    balance: charge.balance ?? null,
    until: until.toISOString(),
    daysLeft: subscriptionDaysLeft(until),
  };
}

/**
 * 닉네임 변경권 코어 — 웹 세션 액션(actions/shop.changeNicknameAction)과
 * 인게임 인바운드 라우트(api/shop/nickname)가 공유. ⚠ 소모형(소유 차단 없음).
 * 검증(길이/금지어) → 코인 차감 → CMI 닉 적용(실패 시 환불) → 기록.
 */
export async function changeNicknameForProfile(
  profile: { id: string; creator_name: string; minecraft_uuid: string | null },
  newNick: string
): Promise<{ success: boolean; message?: string; error?: string; balance?: number | null; nick?: string }> {
  if (!profile.minecraft_uuid) return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };

  const v = validateNickname(newNick);
  if (!v.ok || !v.nick) return { success: false, error: v.reason || "사용할 수 없는 닉네임입니다." };

  const cfg = await getEconomyConfig(); // 닉변 가격은 SiteSetting(어드민 편집)

  // 결제 사가 가드 — 차감~부여 사이 크래시 시 접속 정산으로 자동 환불(shopChargeGuard).
  const intentId = await beginCharge({ profileId: profile.id, minecraftUuid: profile.minecraft_uuid, amount: cfg.nickPrice, purpose: "shop_nickname" });

  // 1) 코인 차감
  const charge = await chargeCoins(profile.minecraft_uuid, cfg.nickPrice);
  if (!charge.success) {
    await resolveIntent(intentId);
    return {
      success: false,
      error:
        charge.status === 402 ? "코인이 부족합니다." :
        charge.status === 503 ? "경제 시스템이 비활성 상태입니다. (관리자 문의)" :
        "결제에 실패했습니다.",
    };
  }
  await markCharged(intentId);
  // 2) 닉 적용(실패 시 환불)
  const applied = await setMinecraftNickname(profile.minecraft_uuid, v.nick);
  if (!applied.success) {
    await refundIntent(intentId, { minecraftUuid: profile.minecraft_uuid, amount: cfg.nickPrice, reason: "닉네임 변경 실패 환불" });
    return {
      success: false,
      error: applied.status === 404
        ? "서버 접속 이력이 없어 적용할 수 없습니다. (코인 환불됨)"
        : "닉네임 적용에 실패했습니다. (코인 환불됨)",
    };
  }
  await resolveIntent(intentId);
  await prisma.creatorLog.create({
    data: { creator_name: profile.creator_name, action: "SHOP_NICK_CHANGE", target_id: v.nick, details: `-${cfg.nickPrice}코인` },
  }).catch(() => {});
  // 경제 원장 — 닉네임 변경권(소각). 환불 구간을 지난 성공 시점에만 기록.
  await logCoinSpend({ profileId: profile.id, minecraftUuid: profile.minecraft_uuid, amount: cfg.nickPrice, source: "shop_nickname", reason: v.nick });

  return { success: true, message: `닉네임을 '${v.nick}'(으)로 변경했어요.`, balance: charge.balance ?? null, nick: v.nick };
}

/**
 * 플롯 확장 구매권 다음 구매 가격 = base × 2^(현재 보유 확장 수). 구매할수록 2배씩 증가(300→600→1200→2400…).
 * 지수는 오버플로/무의미 방지로 상한(30)에서 고정한다(2^30 이상은 잔액으로 도달 불가). base<=0 이면 0.
 */
export function plotSlotPrice(bonus: number, base: number): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  const exp = Math.min(Math.max(0, Math.floor(bonus)), 30);
  return Math.round(base * Math.pow(2, exp));
}

/**
 * 플롯 확장 구매권 코어 — 웹 세션 액션(actions/shop.purchasePlotSlot)과 인게임 인바운드 라우트(api/shop/plot-slot)가 공유.
 * ⚠ 누적형(소유 차단 없음) — purchaseItemForProfile 을 거치지 않는다. 구매 1회 = 최대 플롯 claim 한도 +1.
 * 한도 검사 → 코인 차감(CMI) → plot_slot_bonus +1(실패 시 환불) → 원장/로그. 실제 한도 강제는 플러그인이
 * claim 시 plot_slot_bonus 를 받아 base 한도에 가산한다(lib/minecraft.claimPlot·PlotApi.resolveClaimLimit).
 */
export async function purchasePlotSlotForProfile(profile: {
  id: string;
  creator_name: string;
  minecraft_uuid: string | null;
  plot_slot_bonus: number;
}): Promise<{ success: boolean; message?: string; error?: string; balance?: number | null; bonus?: number; nextPrice?: number }> {
  if (!profile.minecraft_uuid) return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };

  const cfg = await getEconomyConfig(); // 가격/상한은 SiteSetting(어드민 편집)
  const current = Math.max(0, profile.plot_slot_bonus ?? 0);
  if (cfg.plotSlotMax > 0 && current >= cfg.plotSlotMax) {
    return { success: false, error: "플롯 확장 한도에 도달했습니다." };
  }
  const price = plotSlotPrice(current, cfg.plotSlotBase);
  if (price <= 0) return { success: false, error: "현재 플롯 확장권을 판매하지 않습니다." };

  // 결제 사가 가드 — 차감~부여 사이 크래시 시 접속 정산으로 자동 환불(shopChargeGuard).
  const intentId = await beginCharge({ profileId: profile.id, minecraftUuid: profile.minecraft_uuid, amount: price, purpose: "shop_plot_slot" });

  // 1) 코인 차감(서버 CMI). 실패 시 중단.
  const charge = await chargeCoins(profile.minecraft_uuid, price);
  if (!charge.success) {
    await resolveIntent(intentId);
    return {
      success: false,
      error:
        charge.status === 402 ? "코인이 부족합니다." :
        charge.status === 503 ? "경제 시스템이 비활성 상태입니다. (관리자 문의)" :
        "결제에 실패했습니다.",
    };
  }
  await markCharged(intentId);

  // 2) 보너스 +1(실패 시 환불). 조건부 증가(where plot_slot_bonus=current)로 동시구매 경합을 차단한다.
  const updatedBonus = current + 1;
  try {
    const res = await prisma.profile.updateMany({
      where: { id: profile.id, plot_slot_bonus: current },
      data: { plot_slot_bonus: { increment: 1 } },
    });
    if (res.count !== 1) throw new Error("concurrent-modify");
  } catch {
    await refundIntent(intentId, { minecraftUuid: profile.minecraft_uuid, amount: price, reason: "플롯 확장권 결제 실패 환불" });
    return { success: false, error: "구매 처리 중 오류가 발생했습니다. (코인 환불됨)" };
  }
  await resolveIntent(intentId);

  await prisma.creatorLog.create({
    data: { creator_name: profile.creator_name, action: "SHOP_PLOT_SLOT", target_id: String(updatedBonus), details: `-${price}코인 (플롯 한도 +1, 누적 ${updatedBonus})` },
  }).catch(() => {});
  // 경제 원장 — 플롯 확장권(소각). 환불 구간을 지난 성공 시점에만 기록.
  await logCoinSpend({ profileId: profile.id, minecraftUuid: profile.minecraft_uuid, amount: price, source: "shop_plot_slot", reason: `플롯 확장권 #${updatedBonus}` });

  const atMax = cfg.plotSlotMax > 0 && updatedBonus >= cfg.plotSlotMax;
  return {
    success: true,
    message: `플롯 확장권을 구매했어요. 최대 플롯 구매 한도가 +1 되었습니다.`,
    balance: charge.balance ?? null,
    bonus: updatedBonus,
    nextPrice: atMax ? 0 : plotSlotPrice(updatedBonus, cfg.plotSlotBase),
  };
}
