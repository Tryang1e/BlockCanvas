import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";

export const runtime = "nodejs";

// 인게임 /탐방 명령용 — "탐방 공유"된 개인 월드 목록(전체 유저). 공유 ON + 관리자 미정지 + active + 폴더 존재만.
// 플러그인(BlockCanvasLink)이 /탐방 입력 시 HMAC 서명하여 호출하고, 응답을 GUI(bc_explore) 로 보여준다.
//   POST {} → { success, worlds: [{ folder, name, owner }] }
// 탐방은 자유(누구나 입장해 둘러보기) — 빌드는 플러그인 access 로 소유자/초대자만. 목록은 전역이라 uuid 불필요.
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rows = await prisma.minecraftWorld.findMany({
      where: { explore_shared: true, explore_suspended: false, status: "active", mv_world: { not: null } },
      select: {
        mv_world: true,
        name: true,
        owner: { select: { minecraft_username: true, creator_name: true } },
      },
      orderBy: { last_active_at: "desc" },
      take: 200,
    });

    const worlds = rows
      .filter((w) => w.mv_world)
      .map((w) => ({
        folder: w.mv_world as string,
        name: w.name,
        owner: w.owner?.minecraft_username || w.owner?.creator_name || "?",
      }));

    return NextResponse.json({ success: true, worlds });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
