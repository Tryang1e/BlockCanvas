import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";
import { purchaseItemForProfile } from "@/lib/shopPurchase";

/**
 * POST /api/shop/purchase  (인게임 상점 — BlockCanvasLink ShopCommands 가 HMAC 서명해 호출)
 * body: { uuid, item_key } → 연동 프로필 해석 후 상품 구매(코인 차감·기록·환불은 코어가 처리).
 * 웹 세션 상점(actions/shop.purchaseItem)과 동일 코어를 써 소유/잔액 일관.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = JSON.parse(rawBody);
    const uuid = body?.uuid;
    const itemKey = body?.item_key;
    if (!uuid || typeof uuid !== "string" || !itemKey || typeof itemKey !== "string") {
      return NextResponse.json({ success: false, error: "Bad Request: missing uuid/item_key." }, { status: 400 });
    }
    const profile = await prisma.profile.findUnique({
      where: { minecraft_uuid: uuid },
      select: { id: true, creator_name: true, minecraft_uuid: true },
    });
    if (!profile) {
      return NextResponse.json({ success: false, error: "연동된 웹 계정을 찾을 수 없습니다. 먼저 /웹연동 해주세요." }, { status: 404 });
    }
    const r = await purchaseItemForProfile(profile, itemKey);
    return NextResponse.json(r, { status: r.success ? 200 : 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Error in shop/purchase:", msg);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
