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
    await syncBridgeToProfile(currentLinkedAccountId); // 브리지된 크리에이터 Profile 에 미러링
    return { ok: true, linkedAccountId: currentLinkedAccountId };
  }

  // 로그인(기존 계정) 또는 신규 생성
  if (ownerOfIdentity) {
    await prisma.linkedAccount.update({ where: { id: ownerOfIdentity.id }, data });
    await syncBridgeToProfile(ownerOfIdentity.id); // 브리지된 크리에이터 Profile 에 미러링
    return { ok: true, linkedAccountId: ownerOfIdentity.id };
  }
  const created = await prisma.linkedAccount.create({ data });
  return { ok: true, linkedAccountId: created.id }; // 신규 계정 → 아직 브리지 없음
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

  // 반대 방향: 허브 LinkedAccount 의 빈 필드도 Profile 값으로 채워 양쪽을 일치시킨다(@unique 충돌은 건너뜀).
  const accountData: {
    minecraft_uuid?: string;
    minecraft_username?: string | null;
    discord_id?: string;
    discord_username?: string | null;
  } = {};
  if (!account.minecraft_uuid && profile.minecraft_uuid) {
    const clash = await prisma.linkedAccount.findUnique({ where: { minecraft_uuid: profile.minecraft_uuid } });
    if (!clash) {
      accountData.minecraft_uuid = profile.minecraft_uuid;
      accountData.minecraft_username = profile.minecraft_username;
    }
  }
  if (!account.discord_id && profile.discord_id) {
    const clash = await prisma.linkedAccount.findUnique({ where: { discord_id: profile.discord_id } });
    if (!clash) {
      accountData.discord_id = profile.discord_id;
      accountData.discord_username = profile.discord_username;
    }
  }

  await prisma.$transaction([
    prisma.linkedAccount.update({ where: { id: linkedAccountId }, data: { profile_id: profile.id, ...accountData } }),
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

// ===== 브리지 양방향 동기화 (auth.craftopia.work 허브 ↔ 크리에이터 대시보드) =====
// 브리지(LinkedAccount.profile_id)된 계정은 허브·대시보드 어느 쪽에서 Minecraft/Discord 를
// 연결·해제해도 양쪽의 식별자가 일치하도록 미러링한다. @unique 충돌(이미 다른 계정 소유) 필드는 건너뛴다.

type IdentityFields = {
  minecraft_uuid?: string | null;
  minecraft_username?: string | null;
  discord_id?: string | null;
  discord_username?: string | null;
};

/** 해당 minecraft_uuid 가 exceptProfileId 외의 다른 Profile 에 이미 연동돼 있는지(Profile.minecraft_uuid @unique 가드). */
async function mcOnOtherProfile(uuid: string, exceptProfileId: string): Promise<boolean> {
  const p = await prisma.profile.findUnique({ where: { minecraft_uuid: uuid }, select: { id: true } });
  return !!p && p.id !== exceptProfileId;
}
/** 해당 minecraft_uuid 가 exceptLinkedId 외의 다른 LinkedAccount 에 있는지(LinkedAccount.minecraft_uuid @unique 가드). */
async function mcOnOtherLinked(uuid: string, exceptLinkedId: string): Promise<boolean> {
  const a = await prisma.linkedAccount.findUnique({ where: { minecraft_uuid: uuid }, select: { id: true } });
  return !!a && a.id !== exceptLinkedId;
}
/** 해당 discord_id 가 exceptLinkedId 외의 다른 LinkedAccount 에 있는지(LinkedAccount.discord_id @unique 가드). */
async function discordOnOtherLinked(discordId: string, exceptLinkedId: string): Promise<boolean> {
  const a = await prisma.linkedAccount.findUnique({ where: { discord_id: discordId }, select: { id: true } });
  return !!a && a.id !== exceptLinkedId;
}

/**
 * 대시보드(Profile) 측 연동 변경을 브리지된 허브 LinkedAccount 에 미러링한다.
 * 대시보드에서 Minecraft/Discord 를 연결·해제한 직후 호출. 브리지 안 됐으면 no-op.
 */
export async function syncBridgeFromProfile(profileId: string): Promise<void> {
  const account = await prisma.linkedAccount.findUnique({ where: { profile_id: profileId } });
  if (!account) return;
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { minecraft_uuid: true, minecraft_username: true, discord_id: true, discord_username: true },
  });
  if (!profile) return;

  const data: IdentityFields = {};
  if (account.minecraft_uuid !== profile.minecraft_uuid) {
    if (!profile.minecraft_uuid || !(await mcOnOtherLinked(profile.minecraft_uuid, account.id))) {
      data.minecraft_uuid = profile.minecraft_uuid;
      data.minecraft_username = profile.minecraft_username;
    }
  }
  if (account.discord_id !== profile.discord_id) {
    if (!profile.discord_id || !(await discordOnOtherLinked(profile.discord_id, account.id))) {
      data.discord_id = profile.discord_id;
      data.discord_username = profile.discord_username;
    }
  }
  if (Object.keys(data).length) {
    try {
      await prisma.linkedAccount.update({ where: { id: account.id }, data });
    } catch {
      /* 동기화 실패는 비치명적 — 식별자 충돌 등 */
    }
  }
}

/**
 * 허브(LinkedAccount) 측 연동 변경을 브리지된 크리에이터 Profile 에 미러링한다.
 * 허브에서 Minecraft/Discord 를 연결·해제한 직후 호출. 브리지 안 됐으면 no-op.
 */
export async function syncBridgeToProfile(linkedAccountId: string): Promise<void> {
  const account = await prisma.linkedAccount.findUnique({ where: { id: linkedAccountId } });
  if (!account || !account.profile_id) return;
  const profile = await prisma.profile.findUnique({
    where: { id: account.profile_id },
    select: { id: true, minecraft_uuid: true, discord_id: true },
  });
  if (!profile) return;

  const data: IdentityFields = {};
  if (account.minecraft_uuid !== profile.minecraft_uuid) {
    // Profile.minecraft_uuid 는 @unique → 다른 Profile 이 소유 중이면 덮어쓰지 않음
    if (!account.minecraft_uuid || !(await mcOnOtherProfile(account.minecraft_uuid, profile.id))) {
      data.minecraft_uuid = account.minecraft_uuid;
      data.minecraft_username = account.minecraft_username;
    }
  }
  if (account.discord_id !== profile.discord_id) {
    // Profile.discord_id 는 @unique 가 아님 → 가드 불필요
    data.discord_id = account.discord_id;
    data.discord_username = account.discord_username;
  }
  if (Object.keys(data).length) {
    try {
      await prisma.profile.update({ where: { id: profile.id }, data });
    } catch {
      /* 동기화 실패는 비치명적 */
    }
  }
}
