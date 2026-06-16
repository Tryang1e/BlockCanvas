import { promises as fs } from "fs";
import { prisma } from "@/lib/prisma";
import { backupMinecraftWorld, deleteMinecraftWorld } from "@/lib/minecraft";
import type { MinecraftWorld } from "@prisma/client";

// 월드 수명주기(사용자 결정 2026-06-16): 사용 시 자동 갱신 + 수동 비활성화.
//  - 마지막 사용(last_active_at)으로부터 30일 미사용 → 자동 아카이브(백업 zip 보관 + 서버에서 제거, status=archived)
//  - 수동 "비활성화"(deactivateWorld) → 즉시 아카이브
//  - 아카이브된 지(archived_at) 90일 경과 → 영구 삭제(백업 zip + DB 레코드 삭제)
export const RENEW_DAYS = 30;
export const PURGE_DAYS = 90;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/** 만료된 활성 월드를 아카이브: 백업 zip 생성 후 서버에서 제거(파일은 zip 으로만 남음). */
export async function archiveWorld(world: Pick<MinecraftWorld, "id" | "mv_world" | "size_bytes">): Promise<boolean> {
  let backupPath: string | null = null;
  if (world.mv_world) {
    // 1) 백업(복구 원본). 실패하면 데이터 보존을 위해 삭제하지 않고 다음 스윕으로 미룬다.
    const b = await backupMinecraftWorld(world.mv_world);
    if (!b.success) return false;
    backupPath = b.backupPath ?? null;
    // 2) 서버에서 제거(베스트 에포트 — 실패해도 아카이브 상태로는 전환)
    await deleteMinecraftWorld(world.mv_world);
  }
  await prisma.minecraftWorld.update({
    where: { id: world.id },
    data: { status: "archived", archived_at: new Date(), backup_path: backupPath ?? undefined },
  });
  return true;
}

/** 아카이브가 만료된 월드를 영구 삭제: 백업 zip + 서버 잔여 폴더 + DB 레코드 제거. */
export async function purgeWorld(world: Pick<MinecraftWorld, "id" | "mv_world" | "backup_path">): Promise<void> {
  if (world.backup_path) {
    try { await fs.unlink(world.backup_path); } catch { /* 이미 없으면 무시 */ }
  }
  if (world.mv_world) {
    await deleteMinecraftWorld(world.mv_world); // 혹시 서버에 남아있다면 정리(베스트 에포트)
  }
  await prisma.minecraftWorld.delete({ where: { id: world.id } });
}

/**
 * 수명주기 스윕(스케줄러가 주기 호출). 30일 미사용 → 아카이브, 90일 미사용 → 영구 삭제.
 * 외부 MC 서버 호출이 섞여 있어 best-effort; 실패 건은 다음 스윕에서 재시도된다.
 */
export async function sweepWorlds(): Promise<{ archived: number; purged: number; errors: number }> {
  let archived = 0;
  let purged = 0;
  let errors = 0;

  // 1) 아카이브 대상: 활성 + 30일 미사용
  const toArchive = await prisma.minecraftWorld.findMany({
    where: { status: { in: ["active", "provisioning"] }, last_active_at: { lt: daysAgo(RENEW_DAYS) } },
    select: { id: true, mv_world: true, size_bytes: true },
  });
  for (const w of toArchive) {
    try {
      if (await archiveWorld(w)) archived++;
      else errors++;
    } catch { errors++; }
  }

  // 2) 영구 삭제 대상: 아카이브된 지 90일 경과(아카이브 후 90일 보관 → 삭제)
  const toPurge = await prisma.minecraftWorld.findMany({
    where: { status: "archived", archived_at: { lt: daysAgo(PURGE_DAYS) } },
    select: { id: true, mv_world: true, backup_path: true },
  });
  for (const w of toPurge) {
    try {
      await purgeWorld(w);
      purged++;
    } catch { errors++; }
  }

  return { archived, purged, errors };
}
