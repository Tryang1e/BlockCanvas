import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";
import { syncRoleFromLpGroup, evaluateBuildAccess } from "@/lib/roleSync";
import { flushPendingCoins } from "@/lib/economyConfig";
import { reconcileStuckCharges } from "@/lib/shopChargeGuard";

/**
 * POST /api/minecraft/role-sync
 * 마크 서버(BlockCanvasLink)가 플레이어 접속 시 LuckPerms 그룹을 HMAC 서명해 보내면,
 * 연동된 웹 Profile.role 을 LP 그룹에 맞춰 자동 동기화한다. (admin 자동강등은 roleSync 에서 차단)
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ error: "Unauthorized: Invalid signature or expired timestamp." }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { uuid, group } = body ?? {};
    if (!uuid || typeof uuid !== "string") {
      return NextResponse.json({ error: "Bad Request: missing uuid." }, { status: 400 });
    }

    const groupStr = typeof group === "string" ? group : null;
    const result = await syncRoleFromLpGroup(uuid, groupStr);

    // 접속 시 웹 인증 상태 기준으로 건축 권한(LP builder/default) 재조정.
    //  → "서버 접속 전에 웹에서 먼저 인증을 끝낸 유저"(연동 시점에 서버가 꺼져 있었거나 LP 푸시 실패)도
    //     접속하는 순간 역할(builder)을 확실히 받는다. 현재 그룹과 목표가 같으면 no-op(스팸 방지).
    // 아울러 확장권 보너스(plot_slot_bonus)를 응답에 실어, 플러그인이 인게임 플롯 한도(PlayerPlotLimitEvent)를
    //  역할 base + 확장권으로 계산하게 한다. 미연동/미조회면 필드 생략 → 플러그인은 base 한도로 degrade(내결함성).
    let plotSlotBonus: number | undefined;
    if (result.linked) {
      const p = await prisma.profile.findUnique({ where: { minecraft_uuid: uuid }, select: { id: true, plot_slot_bonus: true } });
      if (p) {
        plotSlotBonus = Math.max(0, p.plot_slot_bonus ?? 0);
        await evaluateBuildAccess(p.id, groupStr).catch(() => {});
      }
    }

    // 접속 시각 기록(스키매틱 90일 미접속 정리에 사용). 연동 계정에만 반영.
    await prisma.profile.updateMany({ where: { minecraft_uuid: uuid }, data: { last_seen_at: new Date() } }).catch(() => {});
    // 미지급(delivered=false) 코인 정산 — 서버 미접속/오프라인 동안 쌓인 보상을 접속 순간 지급(best-effort).
    //  ⚠ reconcile 을 flush 보다 먼저 — 크래시로 미완료된 상점 결제의 환불 원장을 먼저 만들고, 같은 접속에서 함께 정산되게.
    await reconcileStuckCharges(uuid).catch(() => {});
    flushPendingCoins(uuid).catch(() => {});
    return NextResponse.json({ success: true, ...result, ...(plotSlotBonus !== undefined ? { plot_slot_bonus: plotSlotBonus } : {}) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error in role-sync:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
