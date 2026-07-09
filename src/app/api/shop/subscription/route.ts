import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";
import { subscribeForProfile } from "@/lib/shopPurchase";

/**
 * POST /api/shop/subscription  (인게임 상점 GUI — BlockCanvasLink 가 HMAC 서명해 호출)
 * body: { uuid } → 연동 프로필 해석 후 구독 구매/연장(코인 차감·연장·승격·동기화·환불은 코어가 처리).
 * 웹 세션 상점(actions/shop.purchaseSubscription)과 동일 코어(subscribeForProfile)를 써 일관.
 * ⚠ 구독은 누적형 — purchaseItemForProfile(소유 차단)을 거치지 않는다.
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
      select: {
        id: true,
        creator_name: true,
        minecraft_uuid: true,
        role: true,
        subscription_until: true,
        role_granted_by_sub: true,
      },
    });
    if (!profile) {
      return NextResponse.json({ success: false, error: "연동된 웹 계정을 찾을 수 없습니다. 먼저 /웹연동 해주세요." }, { status: 404 });
    }
    const r = await subscribeForProfile(profile);
    return NextResponse.json(r, { status: r.success ? 200 : 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Error in shop/subscription:", msg);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
