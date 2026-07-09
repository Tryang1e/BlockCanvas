import { NextRequest, NextResponse } from "next/server";
import { verifyInboundSignature } from "@/lib/minecraft";
import { getMinecraftStatus, cardSignature } from "@/lib/minecraftStatus";

export const runtime = "nodejs";

// 인게임 상태창용 요약. 플러그인(BlockCanvasLink)이 플레이어가 상태창을 열 때 HMAC 서명하여 호출한다.
//   POST { uuid } → { success, linked, creator_name, dashboard_url, role, world_count, world_archived,
//                      world_invited, quota_used, quota_total, quota_unlimited, quota_pct, quota_state, plot_count }
// 데이터 로직은 lib/minecraftStatus 로 분리(카드 렌더 라우트 /api/minecraft/status-card 와 공용).
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { uuid } = JSON.parse(rawBody) ?? {};
    if (!uuid || typeof uuid !== "string") {
      return NextResponse.json({ success: false, error: "Missing uuid" }, { status: 400 });
    }
    const status = await getMinecraftStatus(uuid);
    if (!status.linked) {
      // 웹 계정 미연동 — 인게임에서 연동 안내를 띄울 수 있도록 success:false + linked:false
      return NextResponse.json({ success: false, linked: false });
    }
    // cardSig: 카드 내용 서명 — 플러그인이 직전과 같으면 개인 카드 팩 재전송(재다운로드)을 생략한다.
    return NextResponse.json({ success: true, ...status, cardSig: cardSignature(status) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
