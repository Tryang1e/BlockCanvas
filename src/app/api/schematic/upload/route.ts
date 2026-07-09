import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionFull } from "@/lib/session";
import {
  savePlayerSchematic,
  walkSchematics,
  safeSchemName,
  safeRelFolder,
  hasValidMagic,
  MAX_FILE_BYTES,
  MAX_FILES,
  ALLOWED_EXT,
} from "@/lib/schematics";
import { resolveSchemAccess } from "@/lib/schematicShares";
import { getQuotaUsage, evaluateQuota } from "@/lib/worldQuotaEnforcement";
import { formatBytes } from "@/lib/worldQuota";

export const runtime = "nodejs";

// 스키매틱 업로드 — 로그인 + (본인 폴더 또는 edit 권한으로 공유받은 폴더)에 저장. 백업 없음.
export async function POST(request: Request) {
  try {
    const full = verifySessionFull((await cookies()).get("session")?.value);
    if (!full) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const creatorName = full.name;
    const profile = await prisma.profile.findUnique({ where: { creator_name: creatorName.toLowerCase() } });
    if (!profile) return NextResponse.json({ error: "프로필을 찾을 수 없습니다." }, { status: 403 });
    if (profile.token_version !== full.version) return NextResponse.json({ error: "세션이 만료되었습니다. 다시 로그인해 주세요." }, { status: 401 });

    // 권한은 바디(파일) 버퍼링 전에 검사 → 무권한 요청에서 25MB 낭비 방지. owner/path 는 쿼리 파라미터(?owner=&path=폴더).
    const url = new URL(request.url);
    const ownerId = url.searchParams.get("owner");
    const access = await resolveSchemAccess(profile, ownerId);
    if (!access) {
      // 본인 폴더인데 미연동 → 연동 안내, 공유 폴더인데 권한 없음 → 거부
      if (!ownerId && !profile.minecraft_uuid) return NextResponse.json({ error: "먼저 마인크래프트 계정을 연동해주세요." }, { status: 400 });
      return NextResponse.json({ error: "이 폴더에 접근할 권한이 없습니다." }, { status: 403 });
    }
    if (!access.canWrite) return NextResponse.json({ error: "업로드 권한이 없습니다 (보기 전용 공유)." }, { status: 403 });

    const folder = safeRelFolder(url.searchParams.get("path") || "");
    if (folder === null) return NextResponse.json({ error: "잘못된 폴더 경로입니다." }, { status: 400 });

    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

    const safe = safeSchemName(file.name);
    if (!safe) return NextResponse.json({ error: `허용되지 않는 파일입니다. (${ALLOWED_EXT.join(", ")} 만 가능)` }, { status: 400 });
    const relPath = folder ? `${folder}/${safe}` : safe; // 저장 위치(현재 폴더 + 파일명)
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `파일이 너무 큽니다. (최대 ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)}MB)` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // 내용 검증: 확장자별 매직바이트(.schem=gzip NBT, .bp=Axiom) 확인 — 아무 파일 위장 차단.
    if (!hasValidMagic(safe, buffer)) {
      return NextResponse.json({ error: "올바른 스키매틱/블루프린트 파일이 아닙니다." }, { status: 400 });
    }

    // 개수 제한(전 폴더 합산) — 새 파일(덮어쓰기 아님)일 때만 초과 검사. 덮어쓰기면 기존 크기로 delta 계산.
    const all = await walkSchematics(access.uuid);
    const existing = all.find((f) => f.path === relPath);
    if (!existing && all.length >= MAX_FILES) {
      return NextResponse.json({ error: `스키매틱 개수 한도(${MAX_FILES})를 초과했습니다.` }, { status: 400 });
    }

    // 공동 쿼터(월드 클라우드 + 스키매틱) — 폴더 소유자 기준. 덮어쓰기면 증가분(delta)만 차감. locked 면 used>=total 이라 자동 차단.
    const quota = await getQuotaUsage(access.ownerId);
    if (quota.totalBytes !== null) {
      const prevBytes = existing?.bytes ?? 0;
      // 파일 하나가 총 용량보다 큰 경우(현재 사용량과 무관하게 절대 못 들어감)를 우선 차단 — 명확한 안내.
      if (file.size > quota.totalBytes) {
        return NextResponse.json(
          { error: `이 파일(${formatBytes(file.size)})이 회원님의 클라우드 총 용량(${formatBytes(quota.totalBytes)})보다 큽니다.` },
          { status: 413 }
        );
      }
      // 남은 용량 부족.
      if (quota.usedBytes + (file.size - prevBytes) > quota.totalBytes) {
        return NextResponse.json(
          { error: `클라우드 용량이 부족합니다 (${formatBytes(quota.usedBytes)} / ${formatBytes(quota.totalBytes)} 사용 중, 월드와 공동). 월드나 스키매틱을 정리해주세요.` },
          { status: 413 }
        );
      }
    }

    await savePlayerSchematic(access.uuid, relPath, buffer);
    // 업로드도 활동으로 간주 → 폴더 소유자의 90일 미접속 정리에서 보호(공유 폴더면 소유자 기준)
    await prisma.profile.update({ where: { id: access.ownerId }, data: { last_seen_at: new Date() } }).catch(() => {});
    try { await evaluateQuota(access.ownerId); } catch { /* 경고/잠금 전이 + 알림 반영(베스트에포트) */ }
    return NextResponse.json({ success: true, name: safe, path: relPath });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Schematic upload error:", msg);
    return NextResponse.json({ error: "업로드 실패: " + msg }, { status: 500 });
  }
}
