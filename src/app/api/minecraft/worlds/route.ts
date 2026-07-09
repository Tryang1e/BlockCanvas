import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";
import { resolveInvitedWorldIds } from "@/lib/worldInvites";
import { canModerate } from "@/lib/roles";

export const runtime = "nodejs";

// 인게임 /월드 명령용 — 플레이어가 입장 가능한 월드 목록(소유 + 초대, active + 폴더 존재).
// 플러그인(BlockCanvasLink)이 /월드 입력 시 HMAC 서명하여 호출하고, 응답을 클릭형 채팅 목록으로 보여준다.
//   POST { uuid } → { success, linked, dashboard_url, worlds: [{ folder, name, role }] }
//   POST { uuid, target } → 위와 동일하되 target 닉네임 유저의 목록(+ target 필드). 관리자/스태프 전용(/월드 <닉네임>).
// 폴더명(mv_world = w_<해시>)은 인게임에서 역산할 수 없으므로 웹이 입장 가능한 목록을 내려준다.
// 입장 모델: 탐방은 자유(소유/초대 모두 가능), 빌드만 플러그인 access 로 제한. 아카이브 월드는 서버에서 내려가므로 제외.
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { uuid, target } = JSON.parse(rawBody) ?? {};
    if (!uuid || typeof uuid !== "string") {
      return NextResponse.json({ success: false, error: "Missing uuid" }, { status: 400 });
    }

    const requester = await prisma.profile.findUnique({ where: { minecraft_uuid: uuid } });
    if (!requester) {
      // 웹 계정 미연동 — 인게임에서 /웹연동 안내를 띄울 수 있도록 success:false + linked:false
      return NextResponse.json({ success: false, linked: false });
    }

    // /월드 <닉네임> — 다른 유저의 월드 목록 조회. 권한은 요청자 role 의 canModerate(admin+manager) 로 검증(역할 SSOT).
    let profile = requester;
    let targetName: string | null = null;
    if (typeof target === "string" && target.trim()) {
      if (!canModerate(requester.role)) {
        // 영문 오타(/월드 tpp 등)도 이 경로로 오므로, 일반 유저가 봐도 상황을 알 수 있게 안내
        return NextResponse.json({ success: false, error: "닉네임 조회(/월드 <닉네임>)는 관리자 전용입니다. 내 목록은 /월드 로 확인하세요." });
      }
      const wanted = target.trim();
      // SQLite 는 대소문자 무시 조회가 불안정 → 정확 일치 우선, 실패 시 연동 유저 닉네임을 소문자 비교(isInviteBlockedByName 과 동일 방식).
      // 닉변 후 재사용으로 같은 username 이 여러 프로필에 남을 수 있어(unique 아님) 최근 접속 프로필을 우선한다.
      let found = await prisma.profile.findFirst({
        where: { minecraft_username: wanted },
        orderBy: { last_seen_at: "desc" },
      });
      if (!found) {
        const linked = await prisma.profile.findMany({
          where: { minecraft_username: { not: null } },
          select: { id: true, minecraft_username: true },
          orderBy: { last_seen_at: "desc" },
        });
        const hit = linked.find((p) => (p.minecraft_username || "").toLowerCase() === wanted.toLowerCase());
        if (hit) found = await prisma.profile.findUnique({ where: { id: hit.id } });
      }
      if (!found) {
        return NextResponse.json({ success: false, error: `'${wanted}' 닉네임의 연동 계정을 찾을 수 없습니다.` });
      }
      profile = found;
      targetName = found.minecraft_username;
    }

    const [owned, invitedIds] = await Promise.all([
      prisma.minecraftWorld.findMany({
        where: { owner_id: profile.id, status: "active", mv_world: { not: null } },
        select: { mv_world: true, name: true },
        orderBy: { last_active_at: "desc" },
      }),
      // uuid 또는 닉네임(초대 당시 미연동으로 uuid 가 빈 항목)으로 매칭 + uuid 자가치유 백필
      resolveInvitedWorldIds({
        profileId: profile.id,
        uuid: profile.minecraft_uuid,
        username: profile.minecraft_username,
        activeOnly: true,
      }),
    ]);
    const invited = invitedIds.size
      ? await prisma.minecraftWorld.findMany({
          where: { id: { in: [...invitedIds] }, status: "active", mv_world: { not: null } },
          select: { mv_world: true, name: true },
        })
      : [];

    const worlds = [
      ...owned.map((w) => ({ folder: w.mv_world as string, name: w.name, role: "owner" })),
      ...invited.map((w) => ({ folder: w.mv_world as string, name: w.name, role: "member" })),
    ].filter((w) => w.folder);

    return NextResponse.json({
      success: true,
      linked: true,
      dashboard_url: `https://${profile.creator_name}.craftopia.work/minecraft`,
      ...(targetName ? { target: targetName } : {}),
      worlds,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
