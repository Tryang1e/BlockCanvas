import { prisma } from "@/lib/prisma";
import { subscriptionUntilAtLeast, subscriptionDaysLeft } from "@/lib/subscription";
import { getEconomyConfig } from "@/lib/economyConfig";
import { evaluateQuota } from "@/lib/worldQuotaEnforcement";
import { syncSubscription } from "@/lib/minecraft";

/**
 * Patreon 활성 후원자 → BLOCKCANVAS 구독 부여(코인 차감 없음).
 *  - subscription_until 을 "적어도 지금+기간" 으로 끌어올린다(멱등 — 재연결 반복해도 누적 X, 악용 방지).
 *  - role=user 면 creator 로 승격(role_granted_by_sub 표식) — 코인 구독(shopPurchase.subscribeForProfile)과 동일 혜택.
 *    ⚠ 원래 크리에이터(role_granted_by_sub=false)는 건드리지 않는다(만료 스윕이 강등하면 안 됨).
 *  - 쿼터 재평가 + 인게임 동기화는 best-effort(실패해도 구독은 유효).
 * 후원이 끊기고 재연결이 없으면 subscription_until 이 자연 만료되고 lifecycle 스윕이 승격분을 강등한다.
 */
export async function grantPatreonSubscription(profile: {
  id: string;
  creator_name: string;
  minecraft_uuid: string | null;
  role: string;
}): Promise<{ until: Date; daysLeft: number }> {
  const cfg = await getEconomyConfig(); // 구독 기간(일)은 SiteSetting(어드민 편집) — 코인 구독과 동일 소스
  const promote = (profile.role || "").toLowerCase() === "user";

  // 현재 만료일을 DB 에서 신선하게 읽어 max 보장(호출 측 프로필 스냅샷 staleness 방지).
  const cur = await prisma.profile.findUnique({
    where: { id: profile.id },
    select: { subscription_until: true },
  });
  const until = subscriptionUntilAtLeast(cur?.subscription_until ?? null, cfg.subscriptionDays);

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      subscription_until: until,
      ...(promote ? { role: "creator", role_granted_by_sub: true } : {}),
    },
  });

  await prisma.creatorLog.create({
    data: {
      creator_name: profile.creator_name,
      action: "PATREON_SUBSCRIPTION",
      target_id: until.toISOString(),
      details: `Patreon 후원자 구독 보장(≥${cfg.subscriptionDays}일)`,
    },
  }).catch(() => {});

  // 쿼터 재평가 — 용량 혜택으로 잠금/경고가 풀릴 수 있다(실패는 무시).
  try { await evaluateQuota(profile.id); } catch { /* 평가 실패는 무시 */ }
  // 인게임 동기화 — 구독자 권한(코인 부스트 등)을 새 만료일로 갱신. best-effort.
  if (profile.minecraft_uuid) {
    try { await syncSubscription(profile.minecraft_uuid, until); } catch { /* 동기화 실패는 무시 */ }
  }

  return { until, daysLeft: subscriptionDaysLeft(until) };
}
