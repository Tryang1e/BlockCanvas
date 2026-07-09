import { prisma } from "@/lib/prisma";

// 닉네임 → 마인크래프트 신원 해석 (월드 멤버 초대·스키매틱 공유 공용).

/** 닉네임 → 마인크래프트 UUID 해석(등록/연동된 유저, 대소문자 무시). 못 찾으면 null — 이름만 기록되고 추후 연동 시 매칭. */
export async function resolveMinecraftUuid(name: string): Promise<string | null> {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const profs = await prisma.profile.findMany({
    where: { minecraft_username: { not: null }, minecraft_uuid: { not: null } },
    select: { minecraft_username: true, minecraft_uuid: true },
  });
  const pm = profs.find((p) => (p.minecraft_username || "").toLowerCase() === n);
  return pm?.minecraft_uuid ?? null;
}

/**
 * 닉네임 → 공유 대상 Profile(웹 가입 + 마크 연동된 유저).
 * 공유는 웹 대시보드에서 접근하므로 grantee 는 Profile(웹 계정)이 필수다.
 * 못 찾으면 null.
 */
export async function resolveGranteeProfile(name: string) {
  const uuid = await resolveMinecraftUuid(name);
  if (!uuid) return null;
  return prisma.profile.findUnique({
    where: { minecraft_uuid: uuid },
    select: { id: true, creator_name: true, minecraft_username: true, minecraft_uuid: true },
  });
}
