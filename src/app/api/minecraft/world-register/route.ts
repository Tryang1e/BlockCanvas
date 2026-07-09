import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInboundSignature, adoptLocalMinecraftWorld, setMinecraftWorldAccess, deleteMinecraftWorld } from "@/lib/minecraft";
import { isOfficialOrAbove } from "@/lib/roles";
import { effectiveQuotaBytes, getMaxWorlds } from "@/lib/worldQuota";
import { subscriptionQuotaBonus } from "@/lib/subscription";
import { playerSchematicsBytes } from "@/lib/schematics";
import { evaluateQuota } from "@/lib/worldQuotaEnforcement";
import { computeWorldKey, worldFolderFromKey } from "@/lib/worldNaming";

export const runtime = "nodejs";

// 소유자 공동 풀 사용량(월드 size_bytes 합 + 스키매틱).
async function usedBytesFor(ownerId: string, uuid: string | null): Promise<number> {
  const agg = await prisma.minecraftWorld.aggregate({ where: { owner_id: ownerId }, _sum: { size_bytes: true } });
  const schemBytes = uuid ? await playerSchematicsBytes(uuid) : 0;
  return Number(agg._sum.size_bytes ?? BigInt(0)) + schemBytes;
}

// 고유 월드명 예약 — worlds.ts reserveUniqueWorld 와 동일 규칙(이름 겹치면 "이름 (2)" 자동 번호 + 해시 폴더).
async function reserveUnique(ownerId: string, nick: string, baseName: string): Promise<{ name: string; worldKey: string; folder: string } | null> {
  for (let n = 1; n <= 100; n++) {
    const name = n === 1 ? baseName : `${baseName} (${n})`;
    const worldKey = computeWorldKey(nick, name);
    const folder = worldFolderFromKey(worldKey);
    const keyDup = await prisma.minecraftWorld.findFirst({ where: { owner_id: ownerId, world_key: worldKey }, select: { id: true } });
    const nameDup = await prisma.minecraftWorld.findFirst({ where: { owner_id: ownerId, name, status: { not: "archived" } }, select: { id: true } });
    if (!keyDup && !nameDup) return { name, worldKey, folder };
  }
  return null;
}

// 인게임 /월드 등록 <폴더명> (official 이상) — 서버 인박스 폴더의 월드를 업로드 없이 본인 대시보드로 편입한다.
//   POST { uuid, source(인박스 폴더명), size_bytes } → { success, name, dashboard_url } | { success:false, error } (HMAC)
//
// 안전 설계: source 는 서버 인박스(world-adopt-inbox) 하위로 한정(플러그인 adopt-local 이 경로 이탈 검증)하고, 실제 대상 폴더(dest)는
//   웹이 생성하는 w_해시다 → 플레이어가 서 있는 임의 월드/시스템 월드를 채택할 수 없다. 이 파일은 서버액션이 아니라 HMAC 게이트
//   라우트 핸들러라, 클라이언트가 프로필/권한을 위조해 직접 호출할 수 없다.
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyInboundSignature(rawBody, req.headers.get("X-Timestamp"), req.headers.get("X-Signature"))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { uuid, source, size_bytes } = JSON.parse(rawBody) ?? {};
    if (!uuid || !source) return NextResponse.json({ success: false, error: "Missing uuid or source" }, { status: 400 });

    const profile = await prisma.profile.findUnique({ where: { minecraft_uuid: String(uuid) } });
    if (!profile) return NextResponse.json({ success: false, linked: false });
    if (!isOfficialOrAbove(profile.role)) {
      return NextResponse.json({ success: false, error: "공식 크리에이터(official) 이상만 서버 월드를 등록할 수 있습니다." });
    }
    if (profile.world_quota_state === "locked") {
      return NextResponse.json({ success: false, error: "클라우드 용량 초과로 잠겨 있습니다. 월드를 삭제해 용량을 확보하세요." });
    }

    const src = String(source);
    const size = Math.max(0, Math.floor(Number(size_bytes) || 0));
    const nick = profile.minecraft_username || profile.creator_name;
    const cleanName = src.trim().slice(0, 32) || "server-world";

    // 역할별 보유 한도(official+ 는 무제한 → 검사 생략). worlds.ts 와 동일한 getMaxWorlds 로 중앙화.
    const limit = getMaxWorlds(profile.role);
    if (Number.isFinite(limit)) {
      const activeCount = await prisma.minecraftWorld.count({ where: { owner_id: profile.id, status: { not: "archived" } } });
      if (activeCount >= limit) return NextResponse.json({ success: false, error: `월드는 최대 ${limit}개까지 보유할 수 있습니다.` });
    }

    const total = effectiveQuotaBytes(profile.role, subscriptionQuotaBonus(profile.subscription_until));
    if (Number.isFinite(total) && (await usedBytesFor(profile.id, profile.minecraft_uuid)) + size > total) {
      return NextResponse.json({ success: false, error: "클라우드 쿼터를 초과합니다. 월드나 스키매틱을 정리하세요." });
    }

    const reserved = await reserveUnique(profile.id, nick, cleanName);
    if (!reserved) return NextResponse.json({ success: false, error: "같은 이름의 월드가 너무 많습니다. 다른 이름을 사용해 주세요." });
    const { name: finalName, worldKey, folder } = reserved;

    const world = await prisma.minecraftWorld.create({
      data: {
        owner_id: profile.id,
        name: finalName,
        world_key: worldKey,
        mv_world: folder,
        source: "import",
        generator: "import",
        icon: null,
        size_bytes: BigInt(size),
        status: "provisioning",
        last_active_at: new Date(),
      },
    });

    // 인박스(source) → 컨테이너(folder=w_해시) 이동+로드. 플러그인이 인박스 하위 검증(경로 이탈 차단) 후 수행.
    const res = await adoptLocalMinecraftWorld(folder, src, 3000);
    if (!res.success) {
      if (res.status !== 409) await deleteMinecraftWorld(folder).catch(() => {});
      await prisma.minecraftWorld.delete({ where: { id: world.id } }).catch(() => {});
      return NextResponse.json({ success: false, error: res.error || "서버 월드를 불러오지 못했습니다. (서버 연결 확인)" });
    }
    await prisma.minecraftWorld.update({
      where: { id: world.id },
      data: { size_bytes: BigInt(res.sizeBytes ?? size), version: res.version ?? null, status: "active", flags: JSON.stringify({ gamemode: "creative" }) },
    });

    // 로드 후 실제 용량이 쿼터를 넘으면 등록 취소(롤백).
    if (Number.isFinite(total) && (await usedBytesFor(profile.id, profile.minecraft_uuid)) > total) {
      await deleteMinecraftWorld(folder).catch(() => {});
      await prisma.minecraftWorld.delete({ where: { id: world.id } }).catch(() => {});
      return NextResponse.json({ success: false, error: "로드 후 실제 용량이 클라우드 쿼터를 초과합니다. 등록되지 않았습니다." });
    }

    if (profile.minecraft_uuid) {
      // 등록자 = 소유자 → editors + owner 둘 다 본인 uuid (owner 는 /setworldspawn 소유자 게이트 기준)
      try { await setMinecraftWorldAccess(folder, [profile.minecraft_uuid], profile.minecraft_uuid); } catch { /* best-effort */ }
    }
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "WORLD_REGISTER", details: `서버 월드 등록: ${finalName}` },
    }).catch(() => {});
    try { await evaluateQuota(profile.id); } catch { /* 평가 실패 무시 */ }

    return NextResponse.json({ success: true, name: finalName, dashboard_url: `https://${profile.creator_name}.craftopia.work/minecraft` });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
