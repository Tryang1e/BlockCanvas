"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { getWorldQuotaBytes } from "@/lib/worldQuota";
import { WORLD_ICON_KEYS } from "@/lib/worldIcons";
import { createMinecraftWorld } from "@/lib/minecraft";

// 인게임 개인 월드(클라우드)의 웹측 관리 액션 (MyIdea §2 / Builder's Refuge 스타일).
// 메타데이터는 DB, 실제 프로비저닝(Multiverse 생성)은 BlockCanvasLink 플러그인이 수행.

async function getAuthenticatedProfile() {
  const cookieStore = await cookies();
  const creatorName = verifySession(cookieStore.get("session")?.value);
  if (!creatorName) throw new Error("Unauthorized: Please log in first.");
  const profile = await prisma.profile.findUnique({
    where: { creator_name: creatorName.toLowerCase() },
  });
  if (!profile) throw new Error("Profile not found.");
  return profile;
}

function parseTrusted(value: string | null): { uuid?: string; name: string }[] {
  if (!value) return [];
  try {
    const p = JSON.parse(value);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function parseFlags(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const p = JSON.parse(value);
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

const MAX_WORLDS = 20; // 골격 단계 남용 방지

/** 현재 사용자의 월드 목록 + 쿼터 사용량 조회. */
export async function getMyWorlds() {
  try {
    const profile = await getAuthenticatedProfile();
    const ownerName = profile.minecraft_username || profile.creator_name;
    const rows = await prisma.minecraftWorld.findMany({
      where: { owner_id: profile.id, status: { not: "archived" } },
      orderBy: { created_at: "desc" },
    });

    const worlds = rows.map((w) => ({
      id: w.id,
      name: w.name,
      icon: w.icon,
      ownerName,
      generator: w.generator,
      version: w.version,
      sizeBytes: Number(w.size_bytes),
      border: w.border,
      flags: parseFlags(w.flags),
      trusted: parseTrusted(w.trusted_players),
      status: w.status,
      lastSaved: w.last_saved ? w.last_saved.toISOString() : null,
      lastBackupAt: w.last_backup_at ? w.last_backup_at.toISOString() : null,
      createdAt: w.created_at.toISOString(),
    }));

    const usedBytes = worlds.reduce((s, w) => s + w.sizeBytes, 0);
    const totalRaw = getWorldQuotaBytes(profile.role);

    return {
      success: true as const,
      worlds,
      quota: {
        usedBytes,
        totalBytes: Number.isFinite(totalRaw) ? totalRaw : null, // null = 무제한
        worldCount: worlds.length,
      },
    };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 내가 초대(trusted)된 다른 사람의 월드 목록. */
export async function getInvitedWorlds() {
  try {
    const profile = await getAuthenticatedProfile();
    if (!profile.minecraft_uuid) return { success: true as const, worlds: [] };

    const rows = await prisma.minecraftWorld.findMany({
      where: {
        status: { not: "archived" },
        owner_id: { not: profile.id },
        trusted_players: { contains: profile.minecraft_uuid },
      },
      include: { owner: { select: { creator_name: true, minecraft_username: true } } },
      orderBy: { created_at: "desc" },
    });

    const worlds = rows.map((w) => ({
      id: w.id,
      name: w.name,
      icon: w.icon,
      ownerName: w.owner?.minecraft_username || w.owner?.creator_name || "?",
      generator: w.generator,
      sizeBytes: Number(w.size_bytes),
      status: w.status,
    }));
    return { success: true as const, worlds };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 새 월드 생성 신청 (DB 레코드 + 서버 프로비저닝 베스트에포트). */
export async function createWorld(name: string, generator: string, icon?: string) {
  try {
    const profile = await getAuthenticatedProfile();

    const cleanName = (name || "").trim();
    if (cleanName.length < 2 || cleanName.length > 32) {
      return { success: false as const, error: "월드 이름은 2~32자여야 합니다." };
    }
    if (!/^[\w가-힣 -]+$/.test(cleanName)) {
      return { success: false as const, error: "월드 이름에 사용할 수 없는 문자가 있습니다." };
    }
    const gen = generator === "wild" ? "wild" : "flat";
    const validIcon = icon && WORLD_ICON_KEYS.includes(icon) ? icon : null;

    const existingCount = await prisma.minecraftWorld.count({
      where: { owner_id: profile.id, status: { not: "archived" } },
    });
    if (existingCount >= MAX_WORLDS) {
      return { success: false as const, error: `월드는 최대 ${MAX_WORLDS}개까지 만들 수 있습니다.` };
    }
    const dup = await prisma.minecraftWorld.findFirst({
      where: { owner_id: profile.id, name: cleanName, status: { not: "archived" } },
    });
    if (dup) {
      return { success: false as const, error: "같은 이름의 월드가 이미 있습니다." };
    }

    const world = await prisma.minecraftWorld.create({
      data: { owner_id: profile.id, name: cleanName, generator: gen, icon: validIcon, status: "provisioning" },
    });

    // 서버 프로비저닝(베스트 에포트): 폴더명 예약 + BlockCanvasLink 로 실제 생성 요청.
    const folder = "bcw_" + world.id.replace(/-/g, "").slice(0, 12);
    const provision = await createMinecraftWorld(folder, gen, 3000);
    await prisma.minecraftWorld.update({
      where: { id: world.id },
      data: provision.success
        ? { mv_world: provision.folder || folder, size_bytes: BigInt(provision.sizeBytes ?? 0), status: "active" }
        : { mv_world: folder },
    });

    try {
      await prisma.creatorLog.create({
        data: {
          creator_name: profile.creator_name,
          action: "WORLD_CREATE",
          details: `월드 생성 신청: ${cleanName} (${gen})`,
        },
      });
    } catch { /* 로그 실패는 무시 */ }

    return { success: true as const, worldId: world.id, provisioned: provision.success };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 월드를 보관함으로 이동(소프트 삭제). 30일 후 영구 삭제 예정. */
export async function archiveWorld(worldId: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world || world.owner_id !== profile.id) {
      return { success: false as const, error: "월드를 찾을 수 없습니다." };
    }
    await prisma.minecraftWorld.update({
      where: { id: worldId },
      data: { status: "archived", archived_at: new Date() },
    });
    return { success: true as const };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}
