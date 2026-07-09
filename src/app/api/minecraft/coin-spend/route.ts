import { NextRequest, NextResponse } from "next/server";
import { verifyInboundSignature } from "@/lib/minecraft";
import { prisma } from "@/lib/prisma";
import { logCoinAward, type CoinDirection } from "@/lib/economyConfig";

export const runtime = "nodejs";

/**
 * POST /api/minecraft/coin-spend — 플러그인이 인게임에서 발생한 코인 지출/이체를 보고.
 * (플롯 분양·경매 낙찰·인게임 /돈 보내기). 코인은 이미 CMI 에서 차감/이동된 뒤 보고되므로
 * 여기서는 원장(CoinAward)에 1행만 기록한다 — CMI 재차감/재입금 없음(≠ deliverCoins).
 *
 * body: { uuid, amount, kind, counterparty_uuid?, counterparty_name?, plot_id?, world?, reason? }
 *   HMAC=MINECRAFT_API_SECRET, 서명=verifyInboundSignature("<ts>.<body>").
 *   kind → (source, direction):
 *     plot_claim   → source=plot_claim,   direction=out      (소각: 분양가 서버 회수)
 *     auction_buy  → source=auction_buy,  direction=transfer (구매자→판매자, 순통화량 불변)
 *     coin_transfer→ source=coin_transfer,direction=transfer (인게임 /돈 보내기)
 *     admin_grant  → source=admin_grant,  direction=in       (인게임 /코인지급 관리자 지급 — CMI 는 이미 입금됨, 원장만 기록)
 *  웹발(구독/닉변/상점/웹 송금)은 웹에서 이미 원장에 기록하므로 여기로 보내지 않는다(이중집계 방지).
 */
const KIND_MAP: Record<string, { source: string; direction: CoinDirection }> = {
  plot_claim: { source: "plot_claim", direction: "out" },
  auction_buy: { source: "auction_buy", direction: "transfer" },
  coin_transfer: { source: "coin_transfer", direction: "transfer" },
  admin_grant: { source: "admin_grant", direction: "in" },
};

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ error: "Unauthorized: Invalid signature or expired timestamp." }, { status: 401 });
    }
    const body = JSON.parse(rawBody) ?? {};
    const uuid = typeof body.uuid === "string" ? body.uuid : null;
    const amount = typeof body.amount === "number" ? Math.round(body.amount) : NaN;
    const kind = typeof body.kind === "string" ? body.kind : "";
    const map = KIND_MAP[kind];
    if (!uuid || !map) return NextResponse.json({ error: "Bad Request: missing uuid or invalid kind." }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Bad Request: invalid amount." }, { status: 400 });

    // 당사자 profile 매핑(없으면 uuid 만으로 기록 — 미연동 유저도 집계에 포함).
    const profile = await prisma.profile.findUnique({ where: { minecraft_uuid: uuid }, select: { id: true } });

    const counterparty = typeof body.counterparty_name === "string" ? body.counterparty_name : null;
    const plotId = typeof body.plot_id === "string" ? body.plot_id : null;
    const world = typeof body.world === "string" ? body.world : null;
    const customReason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 200) : null;
    const reason =
      kind === "admin_grant" ? (customReason || "인게임 관리자 지급") :
      kind === "coin_transfer" ? (counterparty ? `→ ${counterparty}` : "유저 송금") :
      kind === "auction_buy" ? `경매 낙찰${plotId ? ` ${plotId}` : ""}${counterparty ? ` (판매 ${counterparty})` : ""}` :
      `플롯 분양${plotId ? ` ${plotId}` : ""}${world ? ` (${world})` : ""}`;

    await logCoinAward({
      profileId: profile?.id ?? null,
      minecraftUuid: uuid,
      amount,
      source: map.source,
      direction: map.direction,
      reason,
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Coin-spend report error:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
