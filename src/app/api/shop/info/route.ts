import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";
import { buildShopSnapshot } from "@/lib/shopPurchase";

/**
 * POST /api/shop/info  (인게임 상점 GUI 렌더용 스냅샷 — BlockCanvasLink 가 HMAC 서명해 호출)
 * body: { uuid } → 연동 프로필 해석 후 { success, ...스냅샷 }(잔액·구독상태·카탈로그·닉가격).
 * 웹 세션 화면(getMyShop)과 동일 buildShopSnapshot — 가격/정책 단일 원본(중복 정의 방지).
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = JSON.parse(rawBody);
    const uuid = body?.uuid;
    if (!uuid || typeof uuid !== "string") {
      return NextResponse.json({ success: false, error: "Bad Request: missing uuid." }, { status: 400 });
    }
    const profile = await prisma.profile.findUnique({
      where: { minecraft_uuid: uuid },
      select: { id: true, minecraft_uuid: true, subscription_until: true, plot_slot_bonus: true },
    });
    if (!profile) {
      return NextResponse.json({ success: false, error: "연동된 웹 계정을 찾을 수 없습니다. 먼저 /웹연동 해주세요." }, { status: 404 });
    }
    const snapshot = await buildShopSnapshot(profile);
    return NextResponse.json({ success: true, ...snapshot }, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Error in shop/info:", msg);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
