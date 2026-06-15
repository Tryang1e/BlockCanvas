"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";

async function getAuthenticatedProfile() {
  const cookieStore = await cookies();
  const creatorName = verifySession(cookieStore.get("session")?.value);
  if (!creatorName) throw new Error("Unauthorized: Please log in first.");
  const profile = await prisma.profile.findUnique({ where: { creator_name: creatorName.toLowerCase() } });
  if (!profile) throw new Error("Profile not found.");
  return profile;
}

/** 현재 사용자의 Discord 연동 상태 + 대기 코드 조회. */
export async function getDiscordStatus() {
  try {
    const profile = await getAuthenticatedProfile();
    const verification = await prisma.discordVerification.findUnique({ where: { profile_id: profile.id } });
    return {
      success: true,
      linked: !!profile.discord_id,
      discordId: profile.discord_id,
      discordUsername: profile.discord_username,
      verificationCode: verification?.code || null,
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Discord 연동용 6자리 코드 발급(crypto 난수 + @unique 충돌 회피 + 만료 정리). */
export async function generateDiscordCode() {
  try {
    const profile = await getAuthenticatedProfile();

    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    await prisma.discordVerification.deleteMany({ where: { created_at: { lt: cutoff } } });

    let code = "";
    for (let i = 0; i < 12; i++) {
      const candidate = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
      const clash = await prisma.discordVerification.findUnique({ where: { code: candidate } });
      if (!clash) {
        code = candidate;
        break;
      }
    }
    if (!code) return { success: false, error: "코드 생성에 실패했습니다. 잠시 후 다시 시도해주세요." };

    await prisma.discordVerification.upsert({
      where: { profile_id: profile.id },
      update: { code, created_at: new Date() },
      create: { profile_id: profile.id, code },
    });
    return { success: true, code };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Discord 연동 해제. */
export async function unlinkDiscord() {
  try {
    const profile = await getAuthenticatedProfile();
    await prisma.$transaction([
      prisma.profile.update({ where: { id: profile.id }, data: { discord_id: null, discord_username: null } }),
      prisma.discordVerification.deleteMany({ where: { profile_id: profile.id } }),
    ]);
    return { success: true, message: "Discord account unlinked successfully." };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
