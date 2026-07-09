import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";
import { canModerate } from "@/lib/roles";

export const runtime = "nodejs";

const fmt = (d: Date | null) => (d ? d.toLocaleString("ko-KR") : null);

// 인게임 /월드 정보 (관리자/스태프 전용) — 서 있는 월드(folder=mv_world)의 DB 메타데이터 조회.
//   POST { uuid(요청자), folder } → { success, name, owner, created, invited[], lastBackup, backupCount, status }
// 권한은 요청자 role 의 canModerate(admin+manager) 로 웹에서 검증(역할 SSOT). 미연동/비관리자는 거부.
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { uuid, folder } = JSON.parse(rawBody) ?? {};
    if (!uuid || !folder) {
      return NextResponse.json({ success: false, error: "Missing uuid or folder" }, { status: 400 });
    }

    const requester = await prisma.profile.findUnique({ where: { minecraft_uuid: String(uuid) } });
    if (!requester) {
      return NextResponse.json({ success: false, linked: false });
    }
    if (!canModerate(requester.role)) {
      return NextResponse.json({ success: false, error: "관리자 전용 명령입니다." });
    }

    const world = await prisma.minecraftWorld.findFirst({
      where: { mv_world: String(folder) },
      include: { owner: { select: { minecraft_username: true, creator_name: true } } },
    });
    if (!world) {
      return NextResponse.json({ success: false, error: "이 월드의 정보를 찾을 수 없습니다. (개인 클라우드 월드 안에서 사용하세요)" });
    }

    // 초대된 사람(trusted_players JSON)
    let invited: string[] = [];
    try {
      const arr = JSON.parse(world.trusted_players || "[]");
      if (Array.isArray(arr)) invited = arr.map((m) => (m?.name || m?.uuid || "?")).filter(Boolean);
    } catch { /* 무시 */ }

    // 백업 개수(backups JSON 배열)
    let backupCount = 0;
    try {
      const arr = JSON.parse(world.backups || "[]");
      if (Array.isArray(arr)) backupCount = arr.length;
    } catch { /* 무시 */ }

    return NextResponse.json({
      success: true,
      name: world.name,
      owner: world.owner?.minecraft_username || world.owner?.creator_name || "?",
      created: fmt(world.created_at),
      invited,
      lastBackup: fmt(world.last_backup_at),
      backupCount,
      status: world.status,
      source: world.source,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
