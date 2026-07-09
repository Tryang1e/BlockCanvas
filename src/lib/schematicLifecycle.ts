import { promises as fs } from "fs";
import { prisma } from "@/lib/prisma";
import { playerSchemDir } from "@/lib/schematics";

// 스키매틱 수명주기: 90일 미접속 시 개인 폴더 영구 삭제(백업 없음 — 사용자 결정).
export const SCHEM_PURGE_DAYS = 90;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/**
 * 90일 미접속 플레이어의 스키매틱 폴더를 삭제한다(스케줄러가 주기 호출).
 * 대상 = last_seen_at 이 90일 이전인 연동 계정. last_seen_at=null(아직 접속 기록 없음)은 유예(삭제 안 함).
 * 폴더명은 sha256(uuid) 로 재계산(저장 시와 동일).
 */
export async function sweepSchematics(): Promise<{ purged: number; errors: number }> {
  let purged = 0;
  let errors = 0;
  const stale = await prisma.profile.findMany({
    where: { minecraft_uuid: { not: null }, last_seen_at: { not: null, lt: daysAgo(SCHEM_PURGE_DAYS) } },
    select: { minecraft_uuid: true },
  });
  for (const p of stale) {
    if (!p.minecraft_uuid) continue;
    const dir = playerSchemDir(p.minecraft_uuid);
    try {
      await fs.access(/* turbopackIgnore: true */ dir); // 폴더 없으면 throw → skip(카운트 안 함)
    } catch {
      continue;
    }
    try {
      await fs.rm(/* turbopackIgnore: true */ dir, { recursive: true, force: true });
      purged++;
    } catch {
      errors++;
    }
  }
  return { purged, errors };
}
