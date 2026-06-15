import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature } from "@/lib/minecraft";

/**
 * POST /api/minecraft/sync  (역방향 동기화 webhook)
 *
 * 마인크래프트(BlockCanvasLink) 플러그인이 인게임 변경을 웹으로 push 한다:
 *  - 플롯 멤버/소유자 변경 → 해당 플롯 캐시 갱신
 *  - 소유권 양도 인게임 수락/거절 → PendingTransfer status 갱신
 *
 * Body: {
 *   plot_id: string, world?: string, owner_uuid?: string|null,
 *   alias?: string, members?: {uuid,name}[], trusted?: {uuid,name}[],
 *   transfer_resolved?: { accepted: boolean, target_uuid?: string }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid signature or expired timestamp." },
        { status: 401 }
      );
    }

    const body = JSON.parse(rawBody);
    const { plot_id, world, owner_uuid, alias, members, trusted, transfer_resolved } = body ?? {};

    if (!plot_id) {
      return NextResponse.json({ error: "Bad Request: Missing plot_id." }, { status: 400 });
    }

    // 1) 소유자 UUID → 웹 프로필 매핑
    const ownerProfile = owner_uuid
      ? await prisma.profile.findUnique({ where: { minecraft_uuid: owner_uuid } })
      : null;

    // 2) 플롯 캐시 갱신 (plot_id 가 PK 이므로 소유자가 바뀌면 행이 자연스럽게 새 주인으로 이전됨)
    if (ownerProfile) {
      const data = {
        owner_id: ownerProfile.id,
        world: typeof world === "string" ? world : "world",
        alias: typeof alias === "string" && alias ? alias : null,
        members: JSON.stringify(Array.isArray(members) ? members : []),
        trusted_players: JSON.stringify(Array.isArray(trusted) ? trusted : []),
      };
      await prisma.minecraftPlot.upsert({
        where: { id: plot_id },
        update: data,
        create: { id: plot_id, ...data },
      });
    } else {
      // 소유자가 웹 유저가 아니거나 소유자 없음 → 캐시에서 제거
      await prisma.minecraftPlot.deleteMany({ where: { id: plot_id } });
    }

    // 3) 양도 결과 반영 (인게임 /웹연동 수락·거절·만료)
    if (transfer_resolved && typeof transfer_resolved === "object") {
      // 신규 계약은 status 문자열, 구버전 호환으로 accepted 불리언도 허용
      const raw = String(
        transfer_resolved.status ?? (transfer_resolved.accepted ? "accepted" : "rejected")
      );
      const status = ["accepted", "rejected", "expired"].includes(raw) ? raw : "rejected";
      await prisma.pendingTransfer.updateMany({
        where: { plot_id, status: "pending" },
        data: { status },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error in minecraft sync:", msg);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
