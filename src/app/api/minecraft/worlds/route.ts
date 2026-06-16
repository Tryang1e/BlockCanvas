import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";

export const runtime = "nodejs";

// 인게임 /월드 명령용 — 플레이어가 입장 가능한 월드 목록(소유 + 초대, active + 폴더 존재).
// 플러그인(BlockCanvasLink)이 /월드 입력 시 HMAC 서명하여 호출하고, 응답을 클릭형 채팅 목록으로 보여준다.
//   POST { uuid } → { success, linked, dashboard_url, worlds: [{ folder, name, role }] }
// 폴더명(mv_world = w_<해시>)은 인게임에서 역산할 수 없으므로 웹이 입장 가능한 목록을 내려준다.
// 입장 모델: 탐방은 자유(소유/초대 모두 가능), 빌드만 플러그인 access 로 제한. 아카이브 월드는 서버에서 내려가므로 제외.
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { uuid } = JSON.parse(rawBody) ?? {};
    if (!uuid || typeof uuid !== "string") {
      return NextResponse.json({ success: false, error: "Missing uuid" }, { status: 400 });
    }

    const profile = await prisma.profile.findUnique({ where: { minecraft_uuid: uuid } });
    if (!profile) {
      // 웹 계정 미연동 — 인게임에서 /웹연동 안내를 띄울 수 있도록 success:false + linked:false
      return NextResponse.json({ success: false, linked: false });
    }

    const [owned, invited] = await Promise.all([
      prisma.minecraftWorld.findMany({
        where: { owner_id: profile.id, status: "active", mv_world: { not: null } },
        select: { mv_world: true, name: true },
        orderBy: { last_active_at: "desc" },
      }),
      prisma.minecraftWorld.findMany({
        where: {
          owner_id: { not: profile.id },
          status: "active",
          mv_world: { not: null },
          trusted_players: { contains: uuid },
        },
        select: { mv_world: true, name: true },
      }),
    ]);

    const worlds = [
      ...owned.map((w) => ({ folder: w.mv_world as string, name: w.name, role: "owner" })),
      ...invited.map((w) => ({ folder: w.mv_world as string, name: w.name, role: "member" })),
    ].filter((w) => w.folder);

    return NextResponse.json({
      success: true,
      linked: true,
      dashboard_url: `https://${profile.creator_name}.craftopia.work/minecraft`,
      worlds,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
