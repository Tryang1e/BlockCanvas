import { NextRequest, NextResponse } from "next/server";
import { verifyInboundSignature } from "@/lib/minecraft";
import { recordBlockReward, recordPlaytimeReward } from "@/lib/activityReward";

export const runtime = "nodejs";

/**
 * POST /api/minecraft/activity — 플러그인이 온라인 플레이어의 인게임 활동을 주기적으로 보고.
 * body: { uuid, block_net_delta?, playtime_minutes? }  (HMAC=MINECRAFT_API_SECRET, 서명=verifyInboundSignature)
 *  - block_net_delta: 지난 보고 이후 순설치(설치−파괴) 블록 델타 → 블록 마일스톤 지급.
 *  - playtime_minutes: 현재 누적 접속(분, 바닐라 통계) → 접속 마일스톤 지급.
 * 실제 지급/설정/원장/미지급정산은 recordBlockReward·recordPlaytimeReward(= deliverCoins) 에서.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ error: "Unauthorized: Invalid signature or expired timestamp." }, { status: 401 });
    }
    const body = JSON.parse(rawBody) ?? {};
    const uuid = typeof body.uuid === "string" ? body.uuid : null;
    if (!uuid) return NextResponse.json({ error: "Bad Request: missing uuid." }, { status: 400 });

    if (typeof body.block_net_delta === "number") {
      await recordBlockReward(uuid, body.block_net_delta);
    }
    if (typeof body.playtime_minutes === "number") {
      await recordPlaytimeReward(uuid, body.playtime_minutes);
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Activity reward error:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
