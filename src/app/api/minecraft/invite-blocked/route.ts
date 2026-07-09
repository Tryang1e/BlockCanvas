import { NextRequest, NextResponse } from "next/server";
import { verifyInboundSignature } from "@/lib/minecraft";
import { isInviteBlockedByName } from "@/lib/worldInvites";

/**
 * POST /api/minecraft/invite-blocked
 * 마크 서버(BlockCanvasLink)가 인게임 /플롯 초대·추가 실행 전에 HMAC 서명해 호출한다.
 * 대상 닉네임이 "초대 차단(block_invites)"을 켰는지 판정해 { blocked } 로 응답한다.
 * 차단이면 플러그인이 PlotSquared trust/add 를 실행하지 않고 거부 문구를 보낸다(웹 enforcement 와 동일 기준).
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ error: "Unauthorized: Invalid signature or expired timestamp." }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { name } = body ?? {};
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Bad Request: missing name." }, { status: 400 });
    }

    const blocked = await isInviteBlockedByName(name);
    return NextResponse.json({ success: true, blocked });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error in invite-blocked:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
