import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";
import { getWorldQuotaBytes, formatBytes } from "@/lib/worldQuota";

export const runtime = "nodejs";

// 인게임 상태창용 요약. 플러그인(BlockCanvasLink)이 플레이어가 상태창을 열 때 HMAC 서명하여 호출한다.
//   POST { uuid } → { success, creator_name, dashboard_url, world_count, world_archived, world_invited,
//                      quota_used, quota_total, quota_pct, quota_state, plot_count }
// 폴링이 아니라 "열 때마다 1회" 갱신용 — 플러그인이 응답을 캐시해 placeholder 로 노출한다.
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

    const profile = await prisma.profile.findUnique({ where: { minecraft_uuid: uuid } });
    if (!profile) {
      // 웹 계정 미연동 — 인게임에서 연동 안내를 띄울 수 있도록 success:false + linked:false
      return NextResponse.json({ success: false, linked: false });
    }

    const worlds = await prisma.minecraftWorld.findMany({
      where: { owner_id: profile.id },
      select: { size_bytes: true, status: true },
    });
    const active = worlds.filter((w) => w.status !== "archived");
    const archived = worlds.filter((w) => w.status === "archived");
    const usedBytes = worlds.reduce((s, w) => s + Number(w.size_bytes), 0); // 전체(쿼터 모델과 동일)
    const total = getWorldQuotaBytes(profile.role);
    const unlimited = !Number.isFinite(total);

    const [plotCount, invitedCount] = await Promise.all([
      prisma.minecraftPlot.count({ where: { owner_id: profile.id } }),
      prisma.minecraftWorld.count({
        where: { owner_id: { not: profile.id }, status: { not: "archived" }, trusted_players: { contains: uuid } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      linked: true,
      creator_name: profile.creator_name,
      dashboard_url: `https://${profile.creator_name}.craftopia.work/minecraft`,
      world_count: active.length,
      world_archived: archived.length,
      world_invited: invitedCount,
      quota_used: formatBytes(usedBytes),
      quota_total: unlimited ? "무제한" : formatBytes(total),
      quota_pct: unlimited ? 0 : Math.min(100, Math.round((usedBytes / total) * 100)),
      quota_state: profile.world_quota_state || "ok",
      plot_count: plotCount,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
