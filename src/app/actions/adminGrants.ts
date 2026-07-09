"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { awardCoins, syncSubscription } from "@/lib/minecraft";
import { logCoinAward, getEconomyConfig } from "@/lib/economyConfig";
import { extendSubscriptionUntil } from "@/lib/subscription";
import { evaluateQuota } from "@/lib/worldQuotaEnforcement";

// 어드민 지급/선물(코인·구독권·플롯 확장권). 모든 액션은 userIds[] 를 받아 1:1(1명)·1:n(다중) 을 통합 처리한다.
// 🔒 requireSuperAdmin(최종관리자 admin 전용) 게이트 — 무상 가치(코인/구독/플롯) 발행은 매니저에게 열지 않는다
//    (C-2: 매니저의 무제한 자가발행 차단). 각 대상별 성공/실패를 모아 요약을 돌려준다(부분 실패 허용).

export interface GrantSummary {
  success: true;
  ok: number;
  failed: number;
  errors: { name: string; error: string }[];
  message: string;
}
type GrantResult = GrantSummary | { error: string };

const MAX_TARGETS = 500;

async function audit(admin: string, action: string, details: string) {
  await prisma.auditLog.create({ data: { admin_name: admin, action, target_id: null, details } }).catch(() => {});
}

function cleanIds(userIds: unknown): string[] {
  if (!Array.isArray(userIds)) return [];
  return [...new Set(userIds.filter((x): x is string => typeof x === "string" && x.length > 0))].slice(0, MAX_TARGETS);
}

/** 코인 지급(다중) — 마크 연동 회원만(CMI). 미연동 대상은 실패로 요약에 남긴다. */
export async function grantCoinsToUsers(userIds: string[], amount: number, reason?: string): Promise<GrantResult> {
  try {
    const admin = await requireSuperAdmin();
    const ids = cleanIds(userIds);
    if (!ids.length) return { error: "대상 회원을 선택해주세요." };
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) return { error: "지급할 코인 수량이 올바르지 않습니다." };
    if (amt > 1_000_000) return { error: "1회 지급 한도(1,000,000)를 초과했습니다." };

    const targets = await prisma.profile.findMany({ where: { id: { in: ids } }, select: { id: true, creator_name: true, minecraft_uuid: true } });
    const errors: { name: string; error: string }[] = [];
    let ok = 0;
    for (const t of targets) {
      if (!t.minecraft_uuid) { errors.push({ name: t.creator_name, error: "마크 미연동(코인 지급 불가)" }); continue; }
      const res = await awardCoins(t.minecraft_uuid, amt, reason || "관리자 지급");
      if (!res.success) { errors.push({ name: t.creator_name, error: "지급 실패(서버 오프라인/경제 미연동)" }); continue; }
      await logCoinAward({ profileId: t.id, minecraftUuid: t.minecraft_uuid, amount: amt, source: "admin_grant", reason: reason || "관리자 지급" }).catch(() => {});
      await prisma.notification.create({
        data: { recipient_id: t.id, sender_name: admin, category: "coin", title: "코인이 지급되었습니다", body: `${amt.toLocaleString()} 코인이 지급되었습니다.${reason ? `\n사유: ${reason}` : ""}`, meta: JSON.stringify({ coin: amt }) },
      }).catch(() => {});
      ok++;
    }
    await audit(admin, "GRANT_COINS_BULK", `${ok}명 +${amt}코인 · ${reason || "사유없음"}${errors.length ? ` (실패 ${errors.length})` : ""}`);
    ids.forEach((id) => revalidatePath(`/adminpage/users/${id}`));
    return { success: true, ok, failed: errors.length, errors, message: `${ok}명에게 ${amt.toLocaleString()} 코인을 지급했습니다.${errors.length ? ` (실패 ${errors.length}명)` : ""}` };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "서버 처리 중 문제가 발생했습니다." };
  }
}

/**
 * 구독권 선물(다중) — 무료. 구독권 1장 = 경제설정 subscriptionDays(기본 30)일. periods 장 만큼 subscription_until 을 누적 연장한다.
 * role=user 는 creator 로 승격(구독 혜택, role_granted_by_sub 표식). 쿼터 재평가 + 마크 연동 시 인게임 구독권 동기화(best-effort).
 */
export async function grantSubscriptionToUsers(userIds: string[], periods: number, reason?: string): Promise<GrantResult> {
  try {
    const admin = await requireSuperAdmin();
    const ids = cleanIds(userIds);
    if (!ids.length) return { error: "대상 회원을 선택해주세요." };
    const n = Math.floor(Number(periods));
    if (!Number.isFinite(n) || n <= 0) return { error: "지급할 구독권 수량이 올바르지 않습니다." };
    if (n > 120) return { error: "1회 지급 한도(120장)를 초과했습니다." };

    const cfg = await getEconomyConfig();
    const days = n * cfg.subscriptionDays;

    const targets = await prisma.profile.findMany({
      where: { id: { in: ids } },
      select: { id: true, creator_name: true, role: true, minecraft_uuid: true, subscription_until: true },
    });
    const errors: { name: string; error: string }[] = [];
    let ok = 0;
    for (const t of targets) {
      const until = extendSubscriptionUntil(t.subscription_until, days);
      const promote = (t.role || "").toLowerCase() === "user";
      try {
        await prisma.profile.update({
          where: { id: t.id },
          data: { subscription_until: until, ...(promote ? { role: "creator", role_granted_by_sub: true } : {}) },
        });
      } catch { errors.push({ name: t.creator_name, error: "구독 처리 실패" }); continue; }
      try { await evaluateQuota(t.id); } catch { /* 쿼터 평가 실패는 무시 */ }
      if (t.minecraft_uuid) { try { await syncSubscription(t.minecraft_uuid, until); } catch { /* 인게임 동기화 실패는 무시(웹 구독 유효) */ } }
      await prisma.creatorLog.create({
        data: { creator_name: t.creator_name, action: "ADMIN_GIFT_SUBSCRIPTION", target_id: until.toISOString(), details: `+${days}일 (구독권 ${n}장) · ${reason || "관리자 선물"}` },
      }).catch(() => {});
      await prisma.notification.create({
        data: { recipient_id: t.id, sender_name: admin, category: "coin", title: "구독권이 지급되었습니다", body: `구독이 ${days}일 연장되었습니다.${reason ? `\n사유: ${reason}` : ""}` },
      }).catch(() => {});
      ok++;
    }
    await audit(admin, "GRANT_SUBSCRIPTION_BULK", `${ok}명 +${days}일(구독권 ${n}장) · ${reason || "선물"}${errors.length ? ` (실패 ${errors.length})` : ""}`);
    ids.forEach((id) => revalidatePath(`/adminpage/users/${id}`));
    return { success: true, ok, failed: errors.length, errors, message: `${ok}명에게 구독권 ${n}장(${days}일)을 지급했습니다.${errors.length ? ` (실패 ${errors.length}명)` : ""}` };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "서버 처리 중 문제가 발생했습니다." };
  }
}

/**
 * 플롯 최대 확장권 지급(다중) — 무료. 웹 Profile.plot_slot_bonus 를 count 만큼 가산(플러그인이 claim 시 이 값을 base 한도에 더한다).
 * 경제설정 plotSlotMax(>0) 가 있으면 그 값으로 clamp. 마크 미연동이어도 저장 가능(연동/접속 시 적용).
 */
export async function grantPlotSlotsToUsers(userIds: string[], count: number, reason?: string): Promise<GrantResult> {
  try {
    const admin = await requireSuperAdmin();
    const ids = cleanIds(userIds);
    if (!ids.length) return { error: "대상 회원을 선택해주세요." };
    const n = Math.floor(Number(count));
    if (!Number.isFinite(n) || n <= 0) return { error: "지급할 플롯 확장권 수량이 올바르지 않습니다." };
    if (n > 1000) return { error: "1회 지급 한도(1,000개)를 초과했습니다." };

    const cfg = await getEconomyConfig();
    const targets = await prisma.profile.findMany({ where: { id: { in: ids } }, select: { id: true, creator_name: true, plot_slot_bonus: true } });
    const errors: { name: string; error: string }[] = [];
    let ok = 0;
    for (const t of targets) {
      const current = Math.max(0, t.plot_slot_bonus ?? 0);
      const next = cfg.plotSlotMax > 0 ? Math.min(current + n, cfg.plotSlotMax) : current + n;
      const added = next - current;
      if (added <= 0) { errors.push({ name: t.creator_name, error: `이미 최대치(${cfg.plotSlotMax})` }); continue; }
      try {
        await prisma.profile.update({ where: { id: t.id }, data: { plot_slot_bonus: next } });
      } catch { errors.push({ name: t.creator_name, error: "지급 처리 실패" }); continue; }
      await prisma.creatorLog.create({
        data: { creator_name: t.creator_name, action: "ADMIN_GIFT_PLOT_SLOT", target_id: String(next), details: `+${added}개 (누적 ${next}) · ${reason || "관리자 선물"}` },
      }).catch(() => {});
      await prisma.notification.create({
        data: { recipient_id: t.id, sender_name: admin, category: "coin", title: "플롯 확장권이 지급되었습니다", body: `플롯 최대 확장권 ${added}개가 지급되었습니다. (누적 ${next}개)${reason ? `\n사유: ${reason}` : ""}` },
      }).catch(() => {});
      ok++;
    }
    await audit(admin, "GRANT_PLOT_SLOT_BULK", `${ok}명 +${n}개 · ${reason || "선물"}${errors.length ? ` (실패 ${errors.length})` : ""}`);
    ids.forEach((id) => revalidatePath(`/adminpage/users/${id}`));
    return { success: true, ok, failed: errors.length, errors, message: `${ok}명에게 플롯 확장권 ${n}개를 지급했습니다.${errors.length ? ` (실패 ${errors.length}명)` : ""}` };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "서버 처리 중 문제가 발생했습니다." };
  }
}
