import { prisma } from "@/lib/prisma";
import { getWorldQuotaBytes, desiredQuotaState, formatBytes } from "@/lib/worldQuota";
import { archiveWorld } from "@/lib/worldLifecycle";
import { getMinecraftWorldInfo, notifyMinecraftPlayer } from "@/lib/minecraft";

// 월드 클라우드 쿼터 enforcement.
//   사용량 = 그 유저의 모든 월드(활성+비활성) size_bytes 합 → 비활성화로는 안 줄고, 삭제해야 줄어든다.
//   90%+ = warned(경고 알림), 100%+ = locked(전 월드 자동 비활성화, 다운로드/삭제만), 다시 미만 = 잠금 해제.
//   알림 3채널: 웹(CreatorLog + 대시보드 배너[상태 기반]) · 디스코드(웹훅) · 인게임(플러그인 notify, 온라인 시).

type QuotaKind = "warned" | "locked" | "unlocked";

const MESSAGES: Record<QuotaKind, string> = {
  warned: "클라우드 용량이 곧 가득 찹니다(90% 사용). 정리하지 않으면 초과 시 모든 월드가 비활성화됩니다.",
  locked: "클라우드 용량을 초과해 모든 월드가 비활성화되었습니다. 지금부터 다운로드/삭제만 가능합니다. 월드를 삭제해 용량을 확보하면 다시 사용할 수 있습니다.",
  unlocked: "클라우드 용량이 확보되어 잠금이 해제되었습니다. 월드를 다시 활성화하고 기능을 사용할 수 있습니다.",
};

interface OwnerProfile {
  id: string;
  creator_name: string;
  role: string;
  minecraft_uuid: string | null;
  minecraft_username: string | null;
  world_quota_state: string;
}

async function usedBytesForOwner(ownerId: string): Promise<number> {
  const agg = await prisma.minecraftWorld.aggregate({ where: { owner_id: ownerId }, _sum: { size_bytes: true } });
  return Number(agg._sum.size_bytes ?? BigInt(0));
}

async function postDiscord(profile: OwnerProfile, kind: QuotaKind, used: number, total: number) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  const titles: Record<QuotaKind, string> = {
    warned: "⚠️ 클라우드 용량 경고 (90%)",
    locked: "⛔ 클라우드 용량 초과 — 월드 비활성화",
    unlocked: "✅ 클라우드 용량 확보 — 잠금 해제",
  };
  const colors: Record<QuotaKind, number> = { warned: 0xf59e0b, locked: 0xef4444, unlocked: 0x10b981 };
  const body = {
    embeds: [
      {
        title: titles[kind],
        color: colors[kind],
        description: MESSAGES[kind],
        fields: [
          { name: "사용자", value: profile.minecraft_username || profile.creator_name, inline: true },
          { name: "사용량", value: `${formatBytes(used)} / ${Number.isFinite(total) ? formatBytes(total) : "∞"}`, inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
}

/** 웹(로그) + 디스코드(웹훅) + 인게임(온라인 시) 3채널 알림. 각 채널 실패는 무시(best-effort). */
async function notifyAll(profile: OwnerProfile, kind: QuotaKind, used: number, total: number) {
  try {
    await prisma.creatorLog.create({
      data: {
        creator_name: profile.creator_name,
        action: `WORLD_QUOTA_${kind.toUpperCase()}`,
        details: `${formatBytes(used)} / ${Number.isFinite(total) ? formatBytes(total) : "∞"}`,
      },
    });
  } catch { /* ignore */ }
  try { await postDiscord(profile, kind, used, total); } catch { /* ignore */ }
  try { if (profile.minecraft_uuid) await notifyMinecraftPlayer(profile.minecraft_uuid, MESSAGES[kind]); } catch { /* ignore */ }
}

/**
 * 한 유저의 쿼터 상태를 평가하고 전이를 처리한다.
 *   - locked 진입/유지: 남아있는 활성 월드를 모두 비활성화(아카이브)
 *   - 상태 변화 시에만 알림 + DB(world_quota_state) 갱신
 * create/import/delete/getWorldLive 및 스윕에서 호출.
 */
export async function evaluateQuota(ownerId: string): Promise<{ state: string; usedBytes: number; totalBytes: number | null }> {
  const profile = (await prisma.profile.findUnique({
    where: { id: ownerId },
    select: { id: true, creator_name: true, role: true, minecraft_uuid: true, minecraft_username: true, world_quota_state: true },
  })) as OwnerProfile | null;
  if (!profile) return { state: "ok", usedBytes: 0, totalBytes: null };

  const total = getWorldQuotaBytes(profile.role);
  const used = await usedBytesForOwner(ownerId);
  const desired = desiredQuotaState(used, total);
  const prev = profile.world_quota_state || "ok";

  // locked 면(전이든 유지든) 남은 활성 월드를 모두 비활성화 — 서버 다운으로 일부 실패했던 것도 재시도.
  if (desired === "locked") {
    const actives = await prisma.minecraftWorld.findMany({
      where: { owner_id: ownerId, status: "active" },
      select: { id: true, mv_world: true, size_bytes: true },
    });
    for (const w of actives) {
      try { await archiveWorld(w); } catch { /* 다음 평가에서 재시도 */ }
    }
  }

  if (desired !== prev) {
    if (desired === "locked") await notifyAll(profile, "locked", used, total);
    else if (prev === "locked") await notifyAll(profile, "unlocked", used, total);
    else if (desired === "warned") await notifyAll(profile, "warned", used, total);
    await prisma.profile.update({ where: { id: ownerId }, data: { world_quota_state: desired } });
  }

  return { state: desired, usedBytes: used, totalBytes: Number.isFinite(total) ? total : null };
}

/** 활성 월드들의 디스크 크기를 서버에서 새로고침(인게임 성장 반영). 스윕 전용. */
async function refreshActiveSizes() {
  const actives = await prisma.minecraftWorld.findMany({
    where: { status: "active", mv_world: { not: null } },
    select: { id: true, mv_world: true },
  });
  for (const w of actives) {
    try {
      const info = await getMinecraftWorldInfo(w.mv_world as string);
      if (info.success && info.exists && typeof info.sizeBytes === "number") {
        await prisma.minecraftWorld.update({ where: { id: w.id }, data: { size_bytes: BigInt(info.sizeBytes) } });
      }
    } catch { /* ignore */ }
  }
}

/** 전 유저 쿼터 스윕(스케줄러). 활성 월드 크기 새로고침 후 유저별 평가. */
export async function sweepQuotas(): Promise<{ evaluated: number }> {
  await refreshActiveSizes();
  const owners = await prisma.minecraftWorld.findMany({ distinct: ["owner_id"], select: { owner_id: true } });
  let evaluated = 0;
  for (const o of owners) {
    try {
      await evaluateQuota(o.owner_id);
      evaluated++;
    } catch { /* ignore */ }
  }
  return { evaluated };
}
