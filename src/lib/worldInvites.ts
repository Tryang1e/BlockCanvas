import { prisma } from "@/lib/prisma";

/**
 * 닉네임으로 "초대 차단(block_invites)"을 켠 유저인지 판정 — 플롯/월드 초대(trust) enforcement 공용.
 * 웹 액션(inviteWorldMember·trustPlotMemberAction)과 플러그인용 API(/api/minecraft/invite-blocked) 양쪽에서 사용.
 * 차단을 켠 유저는 소수라 그 집합만 조회해 닉네임(대소문자 무시) 매칭한다(SQLite 대소문자 비교 이슈 회피).
 */
export async function isInviteBlockedByName(name: string): Promise<boolean> {
  const target = (name || "").trim().toLowerCase();
  if (!target) return false;
  const blockers = await prisma.profile.findMany({
    where: { block_invites: true, minecraft_username: { not: null } },
    select: { minecraft_username: true },
  });
  return blockers.some((b) => (b.minecraft_username || "").toLowerCase() === target);
}

/**
 * trusted_players JSON 에서 사용자가 (uuid 로, 또는 uuid 가 빈 항목이면 닉네임으로) 매칭되는지 판정.
 * 닉네임으로 매칭됐고 uuid 를 알면 그 항목의 uuid 를 채운 갱신 JSON 을 backfilled 로 반환(자가치유).
 * 월드(항목에 perms 포함)·플롯({uuid,name}) 양쪽 형식 모두에서 동작 — 기존 필드는 보존한다.
 *
 * 배경: 초대 시점에 상대가 아직 웹 연동을 안 했으면 uuid 가 "" 로 저장된다(월드 inviteWorldMember,
 * 플롯 trustPlotMemberAction 의 낙관적 캐시). 그 뒤 연동해도 빈 uuid 가 안 채워져 "초대된 목록"에 안 떴음.
 */
export function matchInvite(
  trustedJson: string | null,
  uuid: string,
  usernameLower: string
): { matched: boolean; backfilled: string | null } {
  let arr: Array<{ uuid?: string; name?: string }>;
  try {
    const parsed = JSON.parse(trustedJson || "[]");
    arr = Array.isArray(parsed) ? parsed : [];
  } catch {
    return { matched: false, backfilled: null };
  }
  for (const t of arr) {
    const tUuid = t?.uuid || "";
    const tName = (t?.name || "").toLowerCase();
    if (uuid && tUuid && tUuid === uuid) return { matched: true, backfilled: null };
    if (!tUuid && usernameLower && tName === usernameLower) {
      if (uuid) {
        t.uuid = uuid; // 자가치유: 빈 uuid 채움 → 다음부터 uuid 매칭
        return { matched: true, backfilled: JSON.stringify(arr) };
      }
      return { matched: true, backfilled: null };
    }
  }
  return { matched: false, backfilled: null };
}

/** 내가 초대된 월드 id 집합(uuid/닉네임 매칭 + 빈 uuid 자가치유). */
export async function resolveInvitedWorldIds(opts: {
  profileId: string;
  uuid: string | null;
  username: string | null;
  activeOnly?: boolean;
}): Promise<Set<string>> {
  const uuid = opts.uuid || "";
  const username = (opts.username || "").toLowerCase();
  if (!uuid && !username) return new Set();
  const candidates = await prisma.minecraftWorld.findMany({
    where: {
      owner_id: { not: opts.profileId },
      status: opts.activeOnly ? "active" : { not: "archived" },
      trusted_players: { not: null },
    },
    select: { id: true, trusted_players: true },
  });
  const ids = new Set<string>();
  for (const w of candidates) {
    const { matched, backfilled } = matchInvite(w.trusted_players, uuid, username);
    if (!matched) continue;
    ids.add(w.id);
    if (backfilled) {
      try {
        await prisma.minecraftWorld.update({ where: { id: w.id }, data: { trusted_players: backfilled } });
      } catch {
        /* 백필 실패는 무시(다음 조회 때 재시도) */
      }
    }
  }
  return ids;
}

/**
 * 내가 trust(초대)된 플롯 id 집합(uuid/닉네임 매칭 + 빈 uuid 자가치유).
 * 플롯은 owner 가 syncMyPlots 하면 PlotSquared 의 실제 uuid 로도 보정되지만, sync 전/누락 시에도
 * 닉네임 매칭으로 즉시 노출되도록 한다(월드와 parity).
 */
export async function resolveInvitedPlotIds(opts: {
  profileId: string;
  uuid: string | null;
  username: string | null;
}): Promise<Set<string>> {
  const uuid = opts.uuid || "";
  const username = (opts.username || "").toLowerCase();
  if (!uuid && !username) return new Set();
  const candidates = await prisma.minecraftPlot.findMany({
    where: { owner_id: { not: opts.profileId }, trusted_players: { not: null } },
    select: { id: true, trusted_players: true },
  });
  const ids = new Set<string>();
  for (const p of candidates) {
    const { matched, backfilled } = matchInvite(p.trusted_players, uuid, username);
    if (!matched) continue;
    ids.add(p.id);
    if (backfilled) {
      try {
        await prisma.minecraftPlot.update({ where: { id: p.id }, data: { trusted_players: backfilled } });
      } catch {
        /* 백필 실패는 무시 */
      }
    }
  }
  return ids;
}
