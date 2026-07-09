import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature, plotCacheId } from "@/lib/minecraft";

/**
 * POST /api/minecraft/sync  (역방향 동기화 webhook)
 *
 * 마인크래프트(BlockCanvasLink) 플러그인이 인게임 변경을 웹으로 push 한다:
 *  - 플롯 멤버/소유자 변경 → 해당 플롯 캐시 갱신
 *  - 소유권 양도 수락/거절(/플롯 수락·거절 또는 웹 대시보드) → PendingTransfer status 갱신
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
    const { plot_id, world, owner_uuid, alias, members, trusted, x, z, auction_price, transfer_resolved } = body ?? {};

    if (!plot_id) {
      return NextResponse.json({ error: "Bad Request: Missing plot_id." }, { status: 400 });
    }

    // 플롯 캐시 키는 (world, plotId) 복합 — 같은 plotId 가 여러 플롯월드에 있어도 충돌하지 않게.
    const w = typeof world === "string" && world ? world : "world";
    const cacheId = plotCacheId(w, plot_id);

    // 1) 소유자 UUID → 웹 프로필 매핑
    const ownerProfile = owner_uuid
      ? await prisma.profile.findUnique({ where: { minecraft_uuid: owner_uuid } })
      : null;

    // 2) 플롯 캐시 갱신 (id="<world>:<plotId>" 가 PK 이므로 소유자가 바뀌면 행이 자연스럽게 새 주인으로 이전됨)
    if (ownerProfile) {
      const data = {
        owner_id: ownerProfile.id,
        plot_id: String(plot_id),
        world: w,
        alias: typeof alias === "string" && alias ? alias : null,
        center_x: typeof x === "number" ? x : null,
        center_z: typeof z === "number" ? z : null,
        auction_price: typeof auction_price === "number" ? auction_price : null,
        members: JSON.stringify(Array.isArray(members) ? members : []),
        trusted_players: JSON.stringify(Array.isArray(trusted) ? trusted : []),
      };
      await prisma.minecraftPlot.upsert({
        where: { id: cacheId },
        update: data,
        create: { id: cacheId, ...data },
      });
    } else {
      // 소유자가 웹 유저가 아니거나 소유자 없음 → 캐시에서 제거
      await prisma.minecraftPlot.deleteMany({ where: { id: cacheId } });
    }

    // 3) 양도 결과 반영 (/플롯 수락·거절 또는 웹 대시보드 수락·거절·만료) — world 한정으로 정확한 플롯의 양도만 갱신
    if (transfer_resolved && typeof transfer_resolved === "object") {
      // 신규 계약은 status 문자열, 구버전 호환으로 accepted 불리언도 허용
      const raw = String(
        transfer_resolved.status ?? (transfer_resolved.accepted ? "accepted" : "rejected")
      );
      const status = ["accepted", "rejected", "expired"].includes(raw) ? raw : "rejected";
      await prisma.pendingTransfer.updateMany({
        where: { plot_id, world: w, status: "pending" },
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
