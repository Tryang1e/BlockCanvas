import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";
import { DISCORD_API_SECRET } from "@/lib/discordApiSecret";

function jsonArrayLength(value: string | null): number {
  if (!value) return 0;
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

/**
 * POST /api/discord/plot
 * 봇의 /홍보·/판매 용 — Discord 사용자가 소유한 플롯의 스펙 + Dynmap 링크를 반환한다.
 * 소유권은 discord_id → Profile → MinecraftPlot.owner_id 로 검증한다.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"), DISCORD_API_SECRET)) {
      return NextResponse.json({ error: "Unauthorized: Invalid signature or expired timestamp." }, { status: 401 });
    }

    const { discord_id, plot_id } = JSON.parse(rawBody) ?? {};
    if (!discord_id || !plot_id) {
      return NextResponse.json({ error: "Bad Request: Missing discord_id or plot_id." }, { status: 400 });
    }

    const profile = await prisma.profile.findFirst({ where: { discord_id: String(discord_id) } });
    if (!profile) {
      return NextResponse.json(
        { error: "디스코드 계정이 연동되지 않았습니다. 웹 대시보드에서 먼저 연동해주세요." },
        { status: 404 }
      );
    }

    // 봇은 바레 plotId 만 보내므로 (plot_id, owner_id) 로 조회한다(복합 PK 와 무관, 본인 소유 플롯 한정).
    const plot = await prisma.minecraftPlot.findFirst({ where: { plot_id: String(plot_id), owner_id: profile.id } });
    if (!plot) {
      return NextResponse.json(
        { error: "본인이 소유한 플롯을 찾을 수 없습니다. 웹 대시보드에서 플롯을 동기화했는지 확인하세요." },
        { status: 404 }
      );
    }

    // Dynmap 링크(서버측 env 로 구성 → 봇은 맵 설정을 몰라도 됨)
    const mapBase = (process.env.NEXT_PUBLIC_MINECRAFT_MAP_URL || "").replace(/\/$/, "");
    const mapName = process.env.NEXT_PUBLIC_MINECRAFT_MAP_NAME || "flat";
    const mapUrl =
      mapBase && plot.center_x !== null && plot.center_z !== null
        ? `${mapBase}/?worldname=${encodeURIComponent(plot.world)}&mapname=${encodeURIComponent(mapName)}&zoom=6&x=${plot.center_x}&y=64&z=${plot.center_z}`
        : null;

    return NextResponse.json({
      success: true,
      plot: {
        id: plot.plot_id || plot.id,
        alias: plot.alias,
        world: plot.world,
        ownerName: profile.minecraft_username || profile.display_name || profile.creator_name,
        creatorName: profile.creator_name,
        memberCount: jsonArrayLength(plot.members),
        trustedCount: jsonArrayLength(plot.trusted_players),
        x: plot.center_x,
        z: plot.center_z,
        mapUrl,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error in discord plot lookup:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
