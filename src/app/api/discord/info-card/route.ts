import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature, getEconomyBalance } from "@/lib/minecraft";
import { getMinecraftStatus } from "@/lib/minecraftStatus";
import { renderInfoCardPng, fetchPlayerFace, type InfoCardData } from "@/lib/discordInfoCard";
import { DISCORD_API_SECRET } from "@/lib/discordApiSecret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/discord/info-card
 * 봇의 /내정보 용 — Discord 사용자의 통합 프로필 카드(PNG)를 렌더해 반환한다.
 *   discord_id → Profile → getMinecraftStatus(uuid)(역할·영토·월드·초대·클라우드) + getEconomyBalance(uuid)(코인)
 *   → 사이트 룩 단일 PNG(image/png). 미연동/미링크는 JSON 에러(봇이 안내 메시지로 처리).
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"), DISCORD_API_SECRET)) {
      return NextResponse.json({ error: "Unauthorized: Invalid signature or expired timestamp." }, { status: 401 });
    }

    const { discord_id } = JSON.parse(rawBody) ?? {};
    if (!discord_id) {
      return NextResponse.json({ error: "Bad Request: Missing discord_id." }, { status: 400 });
    }

    const profile = await prisma.profile.findFirst({ where: { discord_id: String(discord_id) } });
    if (!profile) {
      return NextResponse.json(
        { error: "not_linked", message: "디스코드 계정이 연동되지 않았습니다. 웹 대시보드에서 먼저 연동해주세요." },
        { status: 404 },
      );
    }
    if (!profile.minecraft_uuid) {
      return NextResponse.json(
        { error: "no_minecraft", message: "마인크래프트 계정이 연동되지 않았습니다. 인게임 /웹연동 또는 auth.craftopia.work 에서 연동해주세요." },
        { status: 404 },
      );
    }

    const uuid = profile.minecraft_uuid;
    const [status, econ, face] = await Promise.all([
      getMinecraftStatus(uuid),
      getEconomyBalance(uuid), // 인게임 CMI 조회 — 서버 오프라인이면 { success:false, balance:null }
      fetchPlayerFace(uuid),
    ]);

    const data: InfoCardData = {
      name: profile.minecraft_username || profile.display_name || profile.creator_name,
      role: status.role || profile.role || "user",
      plotCount: status.plot_count ?? 0,
      worldCount: status.world_count ?? 0,
      worldInvited: status.world_invited ?? 0,
      quotaUsed: status.quota_used ?? "0 B",
      quotaTotal: status.quota_total ?? "-",
      quotaUnlimited: status.quota_unlimited ?? false,
      quotaPct: status.quota_pct ?? 0,
      quotaState: status.quota_state,
      coins: econ.success ? econ.balance : null,
    };

    const png = await renderInfoCardPng(data, face);
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'inline; filename="info-card.png"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error in discord info-card:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
