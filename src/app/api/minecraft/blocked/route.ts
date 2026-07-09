import { NextRequest, NextResponse } from "next/server";
import { verifyInboundSignature } from "@/lib/minecraft";
import { isIdentityBlocked } from "@/lib/blocklist";

/**
 * POST /api/minecraft/blocked
 * 마크 서버(BlockCanvasLink)가 플레이어 접속(PlayerLogin) 시 HMAC 서명해 호출한다.
 * 대상 UUID 가 접근 차단 목록에 있으면 { blocked: true } 로 응답 → 플러그인이 접속을 거부한다.
 * (웹 인증 게이트와 동일 기준 — 제재 회피 방지). 플러그인 측 훅은 이 저장소 밖(Java)이라 별도 구현 필요.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ error: "Unauthorized: Invalid signature or expired timestamp." }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const uuid = body?.uuid ?? body?.player_uuid;
    if (!uuid || typeof uuid !== "string") {
      return NextResponse.json({ error: "Bad Request: missing uuid." }, { status: 400 });
    }

    const blocked = await isIdentityBlocked("minecraft_uuid", uuid);
    return NextResponse.json({ success: true, blocked });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error in minecraft/blocked:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
