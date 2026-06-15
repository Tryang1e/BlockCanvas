import { prisma } from "@/lib/prisma";

export type HubProvider = "discord" | "minecraft";

/**
 * 허브에서 한 제공자(Discord/Minecraft)를 연결한다.
 *  - 허브 세션이 있으면: 그 계정에 "연결"(다른 계정 소유면 충돌)
 *  - 없으면: 해당 식별자로 기존 계정 "로그인", 없으면 새 계정 생성
 */
export async function linkProviderToHub(params: {
  currentLinkedAccountId: string | null;
  provider: HubProvider;
  id: string;
  username: string;
}): Promise<{ ok: boolean; linkedAccountId?: string; error?: string }> {
  const { currentLinkedAccountId, provider, id, username } = params;

  const whereByIdentity =
    provider === "discord" ? { discord_id: id } : { minecraft_uuid: id };
  const data =
    provider === "discord"
      ? { discord_id: id, discord_username: username }
      : { minecraft_uuid: id, minecraft_username: username };

  const ownerOfIdentity = await prisma.linkedAccount.findFirst({ where: whereByIdentity });

  // 연결(이미 로그인된 허브 계정에 추가)
  if (currentLinkedAccountId) {
    if (ownerOfIdentity && ownerOfIdentity.id !== currentLinkedAccountId) {
      return { ok: false, error: "이 계정은 이미 다른 허브 계정에 연결되어 있습니다." };
    }
    await prisma.linkedAccount.update({ where: { id: currentLinkedAccountId }, data });
    return { ok: true, linkedAccountId: currentLinkedAccountId };
  }

  // 로그인(기존 계정) 또는 신규 생성
  if (ownerOfIdentity) {
    await prisma.linkedAccount.update({ where: { id: ownerOfIdentity.id }, data });
    return { ok: true, linkedAccountId: ownerOfIdentity.id };
  }
  const created = await prisma.linkedAccount.create({ data });
  return { ok: true, linkedAccountId: created.id };
}

/** 허브 계정 조회. */
export async function getHubAccount(id: string) {
  return prisma.linkedAccount.findUnique({ where: { id } });
}

/**
 * 웹 브리지(읽기 전용): 연결된 식별자가 크리에이터 Profile 과 일치하는지 탐지.
 * 일치하면 그 Profile 을 반환(허브 페이지에 "웹 계정도 연결됨" 표시용).
 */
export async function detectLinkedProfile(account: {
  discord_id: string | null;
  minecraft_uuid: string | null;
}) {
  if (account.minecraft_uuid) {
    const p = await prisma.profile.findUnique({ where: { minecraft_uuid: account.minecraft_uuid } });
    if (p) return p;
  }
  if (account.discord_id) {
    const p = await prisma.profile.findFirst({ where: { discord_id: account.discord_id } });
    if (p) return p;
  }
  return null;
}

/**
 * 허브 계정을 크리에이터 Profile 에 브리지(웹 연동)한다.
 * Profile 의 비어있는 minecraft/discord 필드를 허브 연결정보로 채운다(덮어쓰지 않음).
 */
export async function bridgeProfile(
  linkedAccountId: string,
  creatorName: string
): Promise<{ ok: boolean; error?: string; creatorName?: string }> {
  const profile = await prisma.profile.findUnique({ where: { creator_name: creatorName.toLowerCase() } });
  if (!profile) return { ok: false, error: "프로필을 찾을 수 없습니다." };

  const existingBridge = await prisma.linkedAccount.findUnique({ where: { profile_id: profile.id } });
  if (existingBridge && existingBridge.id !== linkedAccountId) {
    return { ok: false, error: "이 craftopia 계정은 이미 다른 허브 계정에 연결되어 있습니다." };
  }

  const account = await prisma.linkedAccount.findUnique({ where: { id: linkedAccountId } });
  if (!account) return { ok: false, error: "허브 계정을 찾을 수 없습니다." };

  const profileData: {
    minecraft_uuid?: string;
    minecraft_username?: string | null;
    discord_id?: string;
    discord_username?: string | null;
  } = {};
  if (!profile.minecraft_uuid && account.minecraft_uuid) {
    const clash = await prisma.profile.findUnique({ where: { minecraft_uuid: account.minecraft_uuid } });
    if (!clash) {
      profileData.minecraft_uuid = account.minecraft_uuid;
      profileData.minecraft_username = account.minecraft_username;
    }
  }
  if (!profile.discord_id && account.discord_id) {
    profileData.discord_id = account.discord_id;
    profileData.discord_username = account.discord_username;
  }

  await prisma.$transaction([
    prisma.linkedAccount.update({ where: { id: linkedAccountId }, data: { profile_id: profile.id } }),
    ...(Object.keys(profileData).length
      ? [prisma.profile.update({ where: { id: profile.id }, data: profileData })]
      : []),
  ]);
  return { ok: true, creatorName: profile.creator_name };
}

/** 브리지된 Profile 의 creator_name 조회(허브 페이지 표시용). */
export async function getBridgedProfileName(profileId: string): Promise<string | null> {
  const p = await prisma.profile.findUnique({ where: { id: profileId }, select: { creator_name: true } });
  return p?.creator_name ?? null;
}
