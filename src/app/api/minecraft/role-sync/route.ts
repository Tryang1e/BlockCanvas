import { NextRequest, NextResponse } from "next/server";
import { verifyInboundSignature } from "@/lib/minecraft";
import { syncRoleFromLpGroup } from "@/lib/roleSync";

/**
 * POST /api/minecraft/role-sync
 * 마크 서버(BlockCanvasLink)가 플레이어 접속 시 LuckPerms 그룹을 HMAC 서명해 보내면,
 * 연동된 웹 Profile.role 을 LP 그룹에 맞춰 자동 동기화한다. (admin 자동강등은 roleSync 에서 차단)
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ error: "Unauthorized: Invalid signature or expired timestamp." }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { uuid, group } = body ?? {};
    if (!uuid || typeof uuid !== "string") {
      return NextResponse.json({ error: "Bad Request: missing uuid." }, { status: 400 });
    }

    const result = await syncRoleFromLpGroup(uuid, typeof group === "string" ? group : null);
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error in role-sync:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
