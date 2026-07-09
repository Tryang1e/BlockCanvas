import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";
import { changeNicknameForProfile } from "@/lib/shopPurchase";

/**
 * POST /api/shop/nickname  (인게임 상점 GUI — 채팅으로 입력받은 닉을 HMAC 서명해 호출)
 * body: { uuid, nick } → 연동 프로필 해석 후 닉네임 변경(검증·차감·적용·환불은 코어가 처리).
 * 웹 세션 상점(actions/shop.changeNicknameAction)과 동일 코어(changeNicknameForProfile)를 써 일관.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = JSON.parse(rawBody);
    const uuid = body?.uuid;
    const nick = body?.nick;
    if (!uuid || typeof uuid !== "string" || !nick || typeof nick !== "string") {
      return NextResponse.json({ success: false, error: "Bad Request: missing uuid/nick." }, { status: 400 });
    }
    const profile = await prisma.profile.findUnique({
      where: { minecraft_uuid: uuid },
      select: { id: true, creator_name: true, minecraft_uuid: true },
    });
    if (!profile) {
      return NextResponse.json({ success: false, error: "연동된 웹 계정을 찾을 수 없습니다. 먼저 /웹연동 해주세요." }, { status: 404 });
    }
    const r = await changeNicknameForProfile(profile, nick);
    return NextResponse.json(r, { status: r.success ? 200 : 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Error in shop/nickname:", msg);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
