"use server";

import { prisma } from "@/lib/prisma";
import { sessionProfile } from "@/lib/server-auth";
import { isSubscribed, subscriptionDaysLeft } from "@/lib/subscription";

async function getAuthenticatedProfile() {
  const profile = await sessionProfile(); // 서명·만료·token_version 대조까지 (무효화 세션 거부)
  if (!profile) throw new Error("Unauthorized: Please log in first.");
  return profile;
}

/** 현재 사용자의 Patreon 연동 + 구독 상태 조회. (연결은 OAuth — /api/auth/patreon/start) */
export async function getPatreonStatus() {
  try {
    const profile = await getAuthenticatedProfile();
    return {
      success: true,
      linked: !!profile.patreon_user_id,
      patreonName: profile.patreon_full_name,
      subscriptionActive: isSubscribed(profile.subscription_until),
      subscriptionUntil: profile.subscription_until ? profile.subscription_until.toISOString() : null,
      subscriptionDaysLeft: subscriptionDaysLeft(profile.subscription_until),
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Patreon 연동 해제. Patreon 은 로그인 수단이 아니므로(연결 전용) 잠김 위험 없이 즉시 해제 가능.
 * 이미 부여된 구독(subscription_until)은 회수하지 않는다 — 남은 기간은 자연 만료된다.
 */
export async function unlinkPatreon() {
  try {
    const profile = await getAuthenticatedProfile();
    await prisma.profile.update({
      where: { id: profile.id },
      data: { patreon_user_id: null, patreon_full_name: null },
    });
    return { success: true, message: "Patreon 연동이 해제되었습니다." };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
