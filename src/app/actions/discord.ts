"use server";

import { prisma } from "@/lib/prisma";
import { sessionProfile } from "@/lib/server-auth";
import { evaluateBuildAccess } from "@/lib/roleSync";

async function getAuthenticatedProfile() {
  const profile = await sessionProfile(); // 서명·만료·token_version 대조까지 (무효화 세션 거부)
  if (!profile) throw new Error("Unauthorized: Please log in first.");
  return profile;
}

/** 현재 사용자의 Discord 연동 상태 조회. (연동은 OAuth — /api/auth/discord/start) */
export async function getDiscordStatus() {
  try {
    const profile = await getAuthenticatedProfile();
    return {
      success: true,
      linked: !!profile.discord_id,
      discordId: profile.discord_id,
      discordUsername: profile.discord_username,
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Discord 연동 해제. */
export async function unlinkDiscord() {
  try {
    const profile = await getAuthenticatedProfile();
    // 잠김 방지: 이메일/비밀번호가 없는(=Discord 로만 가입한) 계정은 Discord 해제 시 로그인 수단이 사라진다.
    if (!profile.password) {
      return {
        success: false,
        error: "이메일/비밀번호가 설정돼 있지 않아 Discord 연결을 해제할 수 없습니다. (해제 시 로그인할 방법이 없어집니다)",
      };
    }
    await prisma.profile.update({
      where: { id: profile.id },
      data: { discord_id: null, discord_username: null },
    });
    // 3종 인증이 깨졌으므로 건축 권한 재평가 → 방문객(default)로 회수
    await evaluateBuildAccess(profile.id).catch(() => {});
    return { success: true, message: "Discord account unlinked successfully." };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
