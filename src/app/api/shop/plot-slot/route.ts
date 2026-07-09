import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";
import { purchasePlotSlotForProfile } from "@/lib/shopPurchase";

/**
 * POST /api/shop/plot-slot  (인게임 상점 GUI — BlockCanvasLink 가 HMAC 서명해 호출)
 * body: { uuid } → 연동 프로필 해석 후 플롯 확장 구매권 구매(한도 검사·코인 차감·보너스+1·환불은 코어가 처리).
 * 웹 세션 상점(actions/shop.purchasePlotSlot)과 동일 코어(purchasePlotSlotForProfile)를 써 일관.
 * ⚠ 누적형 — purchaseItemForProfile(소유 차단)을 거치지 않는다.
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
        plot_slot_bonus: true,
      },
    });
    if (!profile) {
      return NextResponse.json({ success: false, error: "연동된 웹 계정을 찾을 수 없습니다. 먼저 /웹연동 해주세요." }, { status: 404 });
    }
    const r = await purchasePlotSlotForProfile(profile);
    return NextResponse.json(r, { status: r.success ? 200 : 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Error in shop/plot-slot:", msg);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
