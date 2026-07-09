"use server";

import { promises as fs } from "fs";
import { prisma } from "@/lib/prisma";
import { sessionProfile, resolveViewProfile } from "@/lib/server-auth";
import { effectiveQuotaBytes, getMaxWorlds } from "@/lib/worldQuota";
import { subscriptionQuotaBonus } from "@/lib/subscription";
import { canModerate } from "@/lib/roles";
import { WORLD_ICON_KEYS } from "@/lib/worldIcons";
import { computeWorldKey, worldFolderFromKey } from "@/lib/worldNaming";
import { parseTrusted, hasCapability, emptyPerms, permsFor, PERM_KEYS, type MemberPerms } from "@/lib/worldPerms";
import { archiveWorld as archiveWorldLifecycle, recordBackup, unlinkAllBackups, parseBackupList } from "@/lib/worldLifecycle";
import { evaluateQuota } from "@/lib/worldQuotaEnforcement";
import { resolveInvitedWorldIds, isInviteBlockedByName } from "@/lib/worldInvites";
import { resolveMinecraftUuid } from "@/lib/minecraftResolve";
import { playerSchematicsBytes } from "@/lib/schematics";
import {
  createMinecraftWorld,
  getMinecraftWorldInfo,
  setMinecraftWorldGamerule,
  setMinecraftWorldSetting,
  setMinecraftWorldAccess,
  importMinecraftWorld,
  backupMinecraftWorld,
  deleteMinecraftWorld,
} from "@/lib/minecraft";

// 인게임 개인 월드(클라우드)의 웹측 관리 액션 (MyIdea §2 / Builder's Refuge 스타일).
// 메타데이터는 DB, 실제 프로비저닝(Multiverse 생성)은 BlockCanvasLink 플러그인이 수행.

async function getAuthenticatedProfile() {
  const profile = await sessionProfile(); // 서명·만료·token_version 대조까지 (무효화 세션 거부)
  if (!profile) throw new Error("Unauthorized: Please log in first.");
  return profile;
}

// 멤버 권한 모델(parseTrusted·hasCapability·PERM_KEYS·emptyPerms 등)은 @/lib/worldPerms 로 분리(라우트/클라이언트 공용).

function parseFlags(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const p = JSON.parse(value);
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

// 웹 대시보드에서 토글 가능한 boolean 게임룰(플러그인 WORLD_GAMERULES 화이트리스트와 일치해야 함).
const GAMERULE_KEYS = ["doMobSpawning", "doWeatherCycle", "doDaylightCycle", "doFireTick", "mobGriefing", "doTileDrops", "doTraderSpawning"];
// 게임룰이 아닌 월드 설정(별도 엔드포인트). difficulty 는 4단계 enum.
const DIFFICULTIES = ["peaceful", "easy", "normal", "hard"];
// 게임모드는 Multiverse 가 월드별 속성으로 관리(mv modify set gamemode)하고 입장 시 강제한다.
const GAMEMODES = ["creative", "survival", "adventure", "spectator"];

/** 현재 사용자의 월드 목록 + 쿼터 사용량 조회. */
export async function getMyWorlds(viewAs?: string) {
  try {
    const { profile, readOnly } = await resolveViewProfile(viewAs);
    const ownerName = profile.minecraft_username || profile.creator_name;
    const rows = await prisma.minecraftWorld.findMany({
      where: { owner_id: profile.id },
      orderBy: { created_at: "desc" },
    });

    // 양도 대기중 월드의 받는 사람 이름 일괄 조회(소유자 UI "양도 대기중 → {닉}" 표시용)
    const pendingIds = [...new Set(rows.filter((r) => r.pending_transfer_to).map((r) => r.pending_transfer_to as string))];
    const recipients = pendingIds.length
      ? await prisma.profile.findMany({ where: { id: { in: pendingIds } }, select: { id: true, creator_name: true, minecraft_username: true } })
      : [];
    const recipientName = new Map(recipients.map((r) => [r.id, r.minecraft_username || r.creator_name]));

    const worlds = rows.map((w) => ({
      id: w.id,
      name: w.name,
      icon: w.icon,
      mvWorld: w.mv_world,
      source: w.source,
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
      archivedAt: w.archived_at ? w.archived_at.toISOString() : null,
      createdAt: w.created_at.toISOString(),
      backups: parseBackupList(w.backups).map((b) => ({ ts: b.ts, bytes: b.bytes })), // 날짜별 다운로드용(경로 비노출)
      pendingTransfer: w.pending_transfer_to ? { name: recipientName.get(w.pending_transfer_to) || "?" } : null,
      exploreShared: w.explore_shared,        // 탐방 공유 ON 여부(소유자 토글)
      exploreSuspended: w.explore_suspended,  // 관리자 정지 여부
    }));

    // 쿼터 사용량 = 모든 월드(활성+비활성) + 스키매틱 폴더(공동 풀). 비활성화로는 안 줄고 삭제해야 줄어든다(잠금이 의미를 갖도록).
    const worldBytes = worlds.reduce((s, w) => s + w.sizeBytes, 0);
    const schemBytes = profile.minecraft_uuid ? await playerSchematicsBytes(profile.minecraft_uuid) : 0;
    const usedBytes = worldBytes + schemBytes;
    const totalRaw = effectiveQuotaBytes(profile.role, subscriptionQuotaBonus(profile.subscription_until));

    // 대시보드 진입 시 쿼터 재평가(경고/잠금 enforcement) — 상태를 배너용으로 반환.
    // 읽기 전용(어드민 조회) 시엔 enforcement(자동 비활성화 등 부수효과)를 일으키지 않고 현재 상태만 표시.
    let quotaState = profile.world_quota_state;
    if (!readOnly) {
      try {
        quotaState = (await evaluateQuota(profile.id)).state;
      } catch { /* 평가 실패는 무시 */ }
    }

    return {
      success: true as const,
      worlds,
      quota: {
        usedBytes,
        totalBytes: Number.isFinite(totalRaw) ? totalRaw : null, // null = 무제한
        worldCount: worlds.length,
        worldBytes, // 분해 표시용(월드 / 스키매틱 공동 풀)
        schemBytes,
      },
      quotaState,
    };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 내가 초대(trusted)된 다른 사람의 월드 목록. */
export async function getInvitedWorlds(viewAs?: string) {
  try {
    const { profile } = await resolveViewProfile(viewAs);
    if (!profile.minecraft_uuid) return { success: true as const, worlds: [] };

    // uuid 또는 닉네임(초대 당시 미연동으로 uuid 가 빈 항목)으로 매칭 + uuid 자가치유 백필
    const ids = await resolveInvitedWorldIds({
      profileId: profile.id,
      uuid: profile.minecraft_uuid,
      username: profile.minecraft_username,
    });
    if (ids.size === 0) return { success: true as const, worlds: [] };

    const rows = await prisma.minecraftWorld.findMany({
      where: { id: { in: [...ids] }, status: { not: "archived" } },
      include: { owner: { select: { creator_name: true, minecraft_username: true } } },
      orderBy: { created_at: "desc" },
    });

    const worlds = rows.map((w) => ({
      id: w.id,
      name: w.name,
      icon: w.icon,
      mvWorld: w.mv_world,
      source: w.source,
      ownerName: w.owner?.minecraft_username || w.owner?.creator_name || "?",
      generator: w.generator,
      version: w.version,
      sizeBytes: Number(w.size_bytes),
      trusted: parseTrusted(w.trusted_players),
      myPerms: permsFor(w.trusted_players, profile.minecraft_uuid), // 내 권한(초대된 월드에서 보이는 기능 결정)
      status: w.status,
      createdAt: w.created_at.toISOString(),
    }));
    return { success: true as const, worlds };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 월드 이름 검증(생성/삽입 공용). */
function validateWorldName(name: string): { ok: true; name: string } | { ok: false; error: string } {
  const cleanName = (name || "").trim();
  if (cleanName.length < 2 || cleanName.length > 32) return { ok: false, error: "월드 이름은 2~32자여야 합니다." };
  if (!/^[\w가-힣 -]+$/.test(cleanName)) return { ok: false, error: "월드 이름에 사용할 수 없는 문자가 있습니다." };
  return { ok: true, name: cleanName };
}

/** {닉}_{이름} 해시로 서버 폴더명/키를 만들고, 같은 키의 기존 월드(중복) 여부를 함께 반환. */
async function reserveWorldKey(profileId: string, nick: string, name: string) {
  const worldKey = computeWorldKey(nick, name);
  const folder = worldFolderFromKey(worldKey);
  const dup = await prisma.minecraftWorld.findFirst({ where: { owner_id: profileId, world_key: worldKey } });
  return { worldKey, folder, dup };
}

/**
 * 같은 (닉, 이름)이 이미 있으면 "이름 (2)", "이름 (3)" … 으로 자동 번호를 붙여 충돌 없는
 * 표시 이름 + world_key(해시) + 폴더를 찾는다. 이름이 달라지면 sha256 해시(폴더)도 자연히 고유해진다.
 * → 같은 맵을 여러 번 삽입할 수 있게 한다. 폴더(해시) 충돌은 보관 포함 전 상태로, 표시 이름 충돌은 활성 월드 기준으로 검사.
 * 한도(100) 초과 시 null (호출부에서 에러 처리).
 */
async function reserveUniqueWorld(
  profileId: string,
  nick: string,
  baseName: string
): Promise<{ name: string; worldKey: string; folder: string } | null> {
  for (let n = 1; n <= 100; n++) {
    const name = n === 1 ? baseName : `${baseName} (${n})`;
    const worldKey = computeWorldKey(nick, name);
    const folder = worldFolderFromKey(worldKey);
    const keyDup = await prisma.minecraftWorld.findFirst({ where: { owner_id: profileId, world_key: worldKey }, select: { id: true } });
    const nameDup = await prisma.minecraftWorld.findFirst({ where: { owner_id: profileId, name, status: { not: "archived" } }, select: { id: true } });
    if (!keyDup && !nameDup) return { name, worldKey, folder };
  }
  return null;
}

async function logWorld(creatorName: string, action: string, details: string) {
  try {
    await prisma.creatorLog.create({ data: { creator_name: creatorName, action, details } });
  } catch { /* 로그 실패는 무시 */ }
}

/**
 * 역할별 월드 총 보유 한도 검사(전체 한도 — 하루 레이트리밋이 아니라 동시 보유 상한).
 * builder(user) 7 / creator 14 / official+ 무제한. 활성(비보관) 월드 수 기준(= 기존 MAX_WORLDS 의미).
 * 새 월드를 보유하게 되는 모든 경로(생성·삽입·등록·양도수락·복구)에서 호출해 "N개 초과 보유 불가" 불변식을 유지한다.
 * 통과면 null, 초과면 차단 응답 반환. (보관 월드는 서버에서 내려가 활성 슬롯을 차지하지 않지만 디스크 쿼터에는 계속 포함된다.)
 */
async function worldCountLimitError(profile: { id: string; role: string | null }) {
  const limit = getMaxWorlds(profile.role);
  if (!Number.isFinite(limit)) return null; // 무제한(official/staff)
  const activeCount = await prisma.minecraftWorld.count({ where: { owner_id: profile.id, status: { not: "archived" } } });
  if (activeCount >= limit) {
    return { success: false as const, error: `월드는 최대 ${limit}개까지 보유할 수 있습니다. 기존 월드를 삭제하거나 정리한 뒤 다시 시도해주세요.` };
  }
  return null;
}

const QUOTA_LOCKED_MSG = "클라우드 용량 초과로 잠겨 있습니다. 월드를 삭제해 용량을 확보하면 다시 사용할 수 있습니다. (지금은 다운로드/삭제만 가능)";

/** 쿼터 잠금(locked) 상태면 차단 응답을 반환. 다운로드/삭제 외 기능에 가드로 사용. */
function lockedResponse(profile: { world_quota_state: string }) {
  return profile.world_quota_state === "locked" ? { success: false as const, error: QUOTA_LOCKED_MSG } : null;
}

/** 같은 소유자의 (보관 제외) 월드 중 동일 표시 이름이 있는지. 이름 변경은 해시를 안 바꾸므로 표시명 중복은 별도 차단. */
async function displayNameTaken(profileId: string, name: string, exceptId?: string) {
  const dup = await prisma.minecraftWorld.findFirst({
    where: { owner_id: profileId, name, status: { not: "archived" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
  });
  return !!dup;
}

// 닉네임 → 마크 UUID 해석은 @/lib/minecraftResolve 로 분리(스키매틱 공유와 공용).

/** 월드 편집 권한(소유자 + 초대자 uuid)을 플러그인에 동기화(베스트에포트). 인게임 빌드 보호가 이걸 참조. */
async function pushWorldAccess(mvWorld: string | null, ownerUuid: string | null, trustedJson: string | null) {
  if (!mvWorld) return;
  const editors: string[] = [];
  if (ownerUuid) editors.push(ownerUuid);
  for (const t of parseTrusted(trustedJson)) if (t.uuid && t.perms.edit) editors.push(t.uuid); // 편집 권한 멤버만
  try {
    await setMinecraftWorldAccess(mvWorld, editors, ownerUuid); // owner = 소유자 전용 동작(/setworldspawn) 게이트 기준
  } catch { /* best-effort */ }
}

/** 월드 소유자의 마크 uuid. 부반장(위임 멤버)이 invite/kick 할 때 소유자 기준으로 access 동기화하기 위함. */
async function ownerUuidOf(world: { owner_id: string }, profile: { id: string; minecraft_uuid: string | null }): Promise<string | null> {
  if (world.owner_id === profile.id) return profile.minecraft_uuid;
  const o = await prisma.profile.findUnique({ where: { id: world.owner_id }, select: { minecraft_uuid: true } });
  return o?.minecraft_uuid ?? null;
}

/** 기본 월드 생성(평지/야생). DB 레코드 + 서버 프로비저닝(베스트에포트). 폴더명은 {닉}_{이름} 해시. */
export async function createWorld(name: string, generator: string, icon?: string, generateStructures: boolean = true) {
  try {
    const profile = await getAuthenticatedProfile();
    const locked = lockedResponse(profile);
    if (locked) return locked;
    const v = validateWorldName(name);
    if (!v.ok) return { success: false as const, error: v.error };
    const cleanName = v.name;
    const gen = generator === "wild" ? "wild" : "flat";
    const validIcon = icon && WORLD_ICON_KEYS.includes(icon) ? icon : null;
    const nick = profile.minecraft_username || profile.creator_name;

    const cap = await worldCountLimitError(profile);
    if (cap) return cap;

    const { worldKey, folder, dup } = await reserveWorldKey(profile.id, nick, cleanName);
    if (dup) {
      return {
        success: false as const,
        error: dup.status === "archived" ? "같은 이름의 보관된 월드가 있습니다. 복구하거나 다른 이름을 쓰세요." : "같은 이름의 월드가 이미 있습니다.",
      };
    }
    if (await displayNameTaken(profile.id, cleanName)) {
      return { success: false as const, error: "같은 이름의 월드가 이미 있습니다." };
    }

    const world = await prisma.minecraftWorld.create({
      data: {
        owner_id: profile.id,
        name: cleanName,
        world_key: worldKey,
        mv_world: folder,
        source: "basic",
        generator: gen,
        icon: validIcon,
        status: "provisioning",
        last_active_at: new Date(),
      },
    });

    const provision = await createMinecraftWorld(folder, gen, 3000, generateStructures);
    if (provision.success) {
      await prisma.minecraftWorld.update({
        where: { id: world.id },
        // 플러그인이 mv modify 로 기본 게임모드 creative 적용 → flags 에도 반영(서버가 되읽지 못하므로).
        data: { size_bytes: BigInt(provision.sizeBytes ?? 0), version: provision.version ?? null, status: "active", flags: JSON.stringify({ gamemode: "creative" }) },
      });
    }
    await pushWorldAccess(folder, profile.minecraft_uuid, null); // 소유자 빌드 권한 등록

    await logWorld(profile.creator_name, "WORLD_CREATE", `월드 생성: ${cleanName} (${gen}, 구조물 ${generateStructures ? "ON" : "OFF"})`);
    try { await evaluateQuota(profile.id); } catch { /* 평가 실패는 무시 */ }
    return { success: true as const, worldId: world.id, provisioned: provision.success };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * .zip 업로드로 월드 삽입. 업로드 라우트가 디스크에 zip 을 저장한 뒤 호출한다(stagingPath=절대경로).
 * 쿼터는 라우트에서 1차 검사 후 여기서 레코드를 만든다. 서버 삽입 실패 시 레코드를 롤백한다.
 */
export async function importWorld(
  name: string,
  icon: string | undefined,
  stagingPath: string,
  sizeBytes: number,
  opts?: { keepStaging?: boolean; importKey?: string }
) {
  // keepStaging=true 면 스테이징 파일을 여기서 지우지 않는다(청크 라우트가 재시도 위해 수명주기를 직접 관리).
  const cleanup = () => (opts?.keepStaging ? Promise.resolve() : fs.unlink(stagingPath).catch(() => {}));
  try {
    const profile = await getAuthenticatedProfile();
    const locked = lockedResponse(profile);
    if (locked) { await cleanup(); return locked; }

    // 멱등: 같은 importKey(=업로드 uploadId)로 이미 삽입된 월드가 있으면 재삽입하지 않고 그 결과를 반환한다.
    // 응답 유실·재시도·재클릭이 겹쳐도 중복 월드가 생기지 않게 하는 최종 방어선(파일 마커보다 견고).
    if (opts?.importKey) {
      const existing = await prisma.minecraftWorld.findFirst({ where: { import_key: opts.importKey, owner_id: profile.id } });
      if (existing && existing.status !== "provisioning") {
        // 이미 삽입 완료 — 재삽입하지 않고 기존 결과를 반환(멱등).
        await cleanup();
        return { success: true as const, worldId: existing.id, name: existing.name };
      }
      if (existing) {
        // 프로비저닝 중 크래시로 멈춘 잔여 레코드 — 정리 후 재삽입(unique 제약 충돌 방지).
        // 키+소유자+상태로 스코프한 deleteMany(멱등 — 0/1행, 남의 행 오삭제 없음). 유실 시엔 아래 create 의 P2002 처리가 방어.
        if (existing.mv_world) await deleteMinecraftWorld(existing.mv_world).catch(() => {});
        await prisma.minecraftWorld.deleteMany({ where: { import_key: opts.importKey, owner_id: profile.id, status: "provisioning" } }).catch(() => {});
      }
    }
    const v = validateWorldName(name);
    if (!v.ok) { await cleanup(); return { success: false as const, error: v.error }; }
    const cleanName = v.name;
    const validIcon = icon && WORLD_ICON_KEYS.includes(icon) ? icon : null;
    const nick = profile.minecraft_username || profile.creator_name;

    const cap = await worldCountLimitError(profile);
    if (cap) { await cleanup(); return cap; }

    // 같은 맵 재삽입 허용: 이름이 겹치면 "이름 (2)", "이름 (3)" … 으로 자동 번호 → 폴더 해시도 자연히 고유.
    const reserved = await reserveUniqueWorld(profile.id, nick, cleanName);
    if (!reserved) {
      await cleanup();
      return { success: false as const, error: "같은 이름의 월드가 너무 많습니다. 다른 이름을 사용해 주세요." };
    }
    const { name: finalName, worldKey, folder } = reserved;

    let world;
    try {
      world = await prisma.minecraftWorld.create({
        data: {
          owner_id: profile.id,
          name: finalName,
          world_key: worldKey,
          mv_world: folder,
          source: "import",
          generator: "import",
          icon: validIcon,
          size_bytes: BigInt(Math.max(0, Math.floor(sizeBytes))),
          status: "provisioning",
          last_active_at: new Date(),
          import_key: opts?.importKey ?? null, // 멱등 키(청크 업로드 uploadId). 재시도 시 중복 삽입 차단.
        },
      });
    } catch (e: unknown) {
      // import_key unique 충돌(P2002) — 직전 시도의 롤백/정리 삭제가 유실된 드문 DB 경합. 원자적으로 멱등 처리.
      if ((e as { code?: string })?.code === "P2002" && opts?.importKey) {
        await deleteMinecraftWorld(folder).catch(() => {}); // 방금 예약한 폴더 되돌림
        const again = await prisma.minecraftWorld.findFirst({ where: { import_key: opts.importKey, owner_id: profile.id } });
        await cleanup();
        if (again && again.status !== "provisioning") return { success: true as const, worldId: again.id, name: again.name };
        return { success: false as const, error: "이전 업로드를 정리하는 중입니다. 잠시 후 다시 시도해 주세요." };
      }
      throw e;
    }

    const res = await importMinecraftWorld(folder, stagingPath, 3000);
    await cleanup(); // 스테이징 zip 정리(성공/실패 무관 — 플러그인이 이미 풀었음)

    if (!res.success) {
      // 삽입 실패 시 서버에 잔존물(부분 삽입된 폴더)을 남기지 않는다: 폴더 제거 + DB 레코드 롤백.
      // 단 409(world_exists=이미 로드된 실제 월드)는 우리가 만든 게 아니므로 삭제하지 않는다.
      if (res.status !== 409) await deleteMinecraftWorld(folder).catch(() => {});
      await prisma.minecraftWorld.delete({ where: { id: world.id } }).catch(() => {});
      return { success: false as const, error: res.error || "서버에 월드를 삽입하지 못했습니다. (서버 연결/zip 확인)" };
    }
    await prisma.minecraftWorld.update({
      where: { id: world.id },
      data: { size_bytes: BigInt(res.sizeBytes ?? Math.floor(sizeBytes)), version: res.version ?? null, status: "active", flags: JSON.stringify({ gamemode: "creative" }) },
    });

    // 압축 해제 후 실제 용량이 쿼터를 넘으면 등록 취소(롤백) — zip 사전검사를 통과해도 확정 차단. 공동 풀(월드+스키매틱) 기준.
    const total = effectiveQuotaBytes(profile.role, subscriptionQuotaBonus(profile.subscription_until));
    if (Number.isFinite(total)) {
      const agg = await prisma.minecraftWorld.aggregate({ where: { owner_id: profile.id }, _sum: { size_bytes: true } });
      const schemBytes = profile.minecraft_uuid ? await playerSchematicsBytes(profile.minecraft_uuid) : 0;
      const usedAll = Number(agg._sum.size_bytes ?? BigInt(0)) + schemBytes;
      if (usedAll > total) {
        if (world.mv_world) await deleteMinecraftWorld(world.mv_world);
        await prisma.minecraftWorld.delete({ where: { id: world.id } }).catch(() => {});
        return { success: false as const, error: "압축 해제 후 용량이 클라우드 쿼터를 초과합니다. 월드가 등록되지 않았습니다." };
      }
    }
    await pushWorldAccess(folder, profile.minecraft_uuid, null); // 소유자 빌드 권한 등록
    await logWorld(profile.creator_name, "WORLD_IMPORT", `월드 삽입: ${finalName}`);
    try { await evaluateQuota(profile.id); } catch { /* 평가 실패는 무시 */ }
    return { success: true as const, worldId: world.id, name: finalName };
  } catch (e: unknown) {
    await cleanup();
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 서버에서 월드 실시간 정보(크기·게임룰·보더)를 가져와 반환한다.
 * 소유자 조회 시 DB 캐시(size_bytes/flags/border/status)에 반영한다. 초대(trusted)자는 읽기만.
 */
export async function getWorldLive(worldId: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world) return { success: false as const, error: "월드를 찾을 수 없습니다." };

    const isOwner = world.owner_id === profile.id;
    const isTrusted = !!profile.minecraft_uuid && (world.trusted_players || "").includes(profile.minecraft_uuid);
    if (!isOwner && !isTrusted) return { success: false as const, error: "권한이 없습니다." };
    if (!world.mv_world) return { success: false as const, error: "아직 서버에 프로비저닝되지 않았습니다." };

    const info = await getMinecraftWorldInfo(world.mv_world);
    if (!info.success || !info.exists) {
      return { success: false as const, error: "서버에서 월드를 찾을 수 없습니다. (서버 연결/프로비저닝 확인)" };
    }
    // 기존 flags(gamemode 등 서버가 되읽지 못하는 값) 위에 라이브 값(게임룰/난이도/랜덤틱/폭발방지)을 덮어쓴다.
    const settings: Record<string, unknown> = { ...parseFlags(world.flags), ...(info.gamerules || {}) };
    if (info.difficulty !== undefined) settings.difficulty = info.difficulty;
    if (info.randomTickSpeed !== undefined) settings.randomTickSpeed = info.randomTickSpeed;
    if (info.explosionBlocked !== undefined) settings.explosionBlocked = info.explosionBlocked;
    const sizeBytes = info.sizeBytes ?? Number(world.size_bytes);
    const border = typeof info.border === "number" ? info.border : world.border;
    const version = info.version ?? world.version;

    if (isOwner) {
      // 소유자 열람 = "사용" → last_active_at 갱신(30일 수명주기 리셋).
      await prisma.minecraftWorld.update({
        where: { id: world.id },
        data: {
          size_bytes: BigInt(sizeBytes),
          flags: JSON.stringify(settings),
          border,
          version,
          status: world.status === "provisioning" ? "active" : world.status,
          last_saved: new Date(),
          last_active_at: new Date(),
        },
      });
      try { await evaluateQuota(world.owner_id); } catch { /* 평가 실패는 무시 */ } // 크기 갱신 → 경고/잠금 반영
      try { await pushWorldAccess(world.mv_world, profile.minecraft_uuid, world.trusted_players); } catch { /* best-effort */ } // 빌드 권한 재동기화
    }

    return { success: true as const, live: { loaded: !!info.loaded, sizeBytes, border, gamerules: settings, version } };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 월드 게임룰 변경(소유자 전용). 서버에 즉시 적용 후 DB flags 캐시에 반영한다. */
export async function setWorldGamerule(worldId: string, rule: string, value: boolean) {
  try {
    const profile = await getAuthenticatedProfile();
    const locked = lockedResponse(profile);
    if (locked) return locked;
    if (!GAMERULE_KEYS.includes(rule)) {
      return { success: false as const, error: "지원하지 않는 게임룰입니다." };
    }
    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world) {
      return { success: false as const, error: "월드를 찾을 수 없습니다." };
    }
    if (!hasCapability(world, profile, "gamerule")) {
      return { success: false as const, error: "게임룰 권한이 없습니다." };
    }
    if (!world.mv_world) {
      return { success: false as const, error: "아직 서버에 프로비저닝되지 않았습니다." };
    }

    const res = await setMinecraftWorldGamerule(world.mv_world, rule, value);
    if (!res.success) {
      return { success: false as const, error: res.error || "서버에 적용하지 못했습니다. (서버 연결 확인)" };
    }
    // 서버가 돌려준 스냅샷을 신뢰하되, 없으면 기존 flags 에 변경분만 병합.
    const flags: Record<string, unknown> = res.gamerules ?? { ...parseFlags(world.flags), [rule]: value };
    await prisma.minecraftWorld.update({ where: { id: world.id }, data: { flags: JSON.stringify(flags) } });
    return { success: true as const, flags };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 게임룰이 아닌 월드 설정 변경(소유자 전용): 난이도/랜덤틱속도/폭발방지 + 개인월드 보호 오버라이드
 *  (allowItemDrop/allowRedstone/allowPhysics/trampleProtect). 서버 적용 후 flags 캐시 반영. */
export async function setWorldSetting(worldId: string, key: string, value: string | number | boolean) {
  try {
    const profile = await getAuthenticatedProfile();
    const locked = lockedResponse(profile);
    if (locked) return locked;
    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world) return { success: false as const, error: "월드를 찾을 수 없습니다." };
    if (!hasCapability(world, profile, "gamerule")) return { success: false as const, error: "게임룰/설정 권한이 없습니다." };
    if (!world.mv_world) return { success: false as const, error: "아직 서버에 프로비저닝되지 않았습니다." };

    let v: string | number | boolean = value;
    if (key === "difficulty") {
      if (typeof value !== "string" || !DIFFICULTIES.includes(value)) return { success: false as const, error: "잘못된 난이도입니다." };
    } else if (key === "gamemode") {
      if (typeof value !== "string" || !GAMEMODES.includes(value)) return { success: false as const, error: "잘못된 게임모드입니다." };
    } else if (key === "randomTickSpeed") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 40) return { success: false as const, error: "랜덤 틱 속도는 0~40 사이여야 합니다." };
      v = n;
    } else if (key === "explosionBlocked") {
      v = !!value;
    } else if (key === "allowItemDrop" || key === "allowRedstone" || key === "allowPhysics" || key === "trampleProtect") {
      v = !!value; // 개인(w_) 월드 보호 오버라이드 — 플러그인이 w_ 월드에서만 enforcement
    } else {
      return { success: false as const, error: "지원하지 않는 설정입니다." };
    }

    const res = await setMinecraftWorldSetting(world.mv_world, key, v);
    if (!res.success) return { success: false as const, error: res.error || "서버에 적용하지 못했습니다. (서버 연결 확인)" };

    const flags: Record<string, unknown> = { ...parseFlags(world.flags) };
    if (res.difficulty !== undefined) flags.difficulty = res.difficulty;
    if (res.randomTickSpeed !== undefined) flags.randomTickSpeed = res.randomTickSpeed;
    if (res.explosionBlocked !== undefined) flags.explosionBlocked = res.explosionBlocked;
    if (res.gamemode !== undefined) flags.gamemode = res.gamemode;
    flags[key] = v; // 서버 스냅샷이 비어도 최소 변경분은 반영
    await prisma.minecraftWorld.update({ where: { id: world.id }, data: { flags: JSON.stringify(flags) } });
    return { success: true as const, flags };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 월드 백업(소유자 전용). 서버에서 zip 생성 후 경로/시각 기록. 기본 24h 1회 제한(force=다운로드용 무시). */
export async function backupWorld(worldId: string, opts?: { force?: boolean }) {
  try {
    const profile = await getAuthenticatedProfile();
    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world) return { success: false as const, error: "월드를 찾을 수 없습니다." };
    // 다운로드(force)는 잠금/권한 검사 우회(다운로드 라우트가 자체 검사). 수동 백업은 잠금·권한 검사.
    if (!opts?.force) {
      const locked = lockedResponse(profile);
      if (locked) return locked;
      if (!hasCapability(world, profile, "backup")) return { success: false as const, error: "백업 권한이 없습니다." };
    }
    if (!world.mv_world || world.status !== "active") return { success: false as const, error: "활성 월드만 백업할 수 있습니다." };

    if (!opts?.force && world.last_backup_at && Date.now() - world.last_backup_at.getTime() < 24 * 60 * 60 * 1000) {
      return { success: false as const, error: "백업은 24시간에 한 번만 가능합니다." };
    }

    const res = await backupMinecraftWorld(world.mv_world);
    if (!res.success || !res.backupPath) {
      return { success: false as const, error: res.error || "백업에 실패했습니다. (서버 연결 확인)" };
    }
    // 백업 리스트(최신순 최대 5개)에 추가 — 초과분 zip 은 recordBackup 이 삭제, backup_path 도 갱신.
    const list = await recordBackup(world.id, res.backupPath, res.zipBytes ?? 0);
    await prisma.minecraftWorld.update({ where: { id: world.id }, data: { last_backup_at: new Date() } });
    return {
      success: true as const,
      backupPath: res.backupPath,
      zipBytes: res.zipBytes ?? 0,
      backups: list.map((b) => ({ ts: b.ts, bytes: b.bytes })),
    };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 월드 영구 삭제(소유자 전용). 서버 제거 + 백업 zip 삭제 + DB 레코드 삭제. 되돌릴 수 없음. */
export async function deleteWorld(worldId: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world || world.owner_id !== profile.id) return { success: false as const, error: "월드를 찾을 수 없습니다." };

    if (world.mv_world) await deleteMinecraftWorld(world.mv_world); // 서버 제거(베스트 에포트)
    await unlinkAllBackups(world.backups); // 백업 리스트의 모든 zip 삭제
    if (world.backup_path) await fs.unlink(world.backup_path).catch(() => {}); // 리스트에 없던 레거시 경로 대비
    await prisma.minecraftWorld.delete({ where: { id: world.id } });
    await logWorld(profile.creator_name, "WORLD_DELETE", `월드 삭제: ${world.name}`);
    try { await evaluateQuota(profile.id); } catch { /* 평가 실패는 무시 */ } // 삭제로 용량 확보 → 잠금 해제 가능
    return { success: true as const };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 월드 수동 비활성화(소유자 전용). 백업 후 서버에서 내려(unload·제거) 아카이브로 이동. 90일 후 자동 삭제, 그 전엔 활성화 가능. */
export async function deactivateWorld(worldId: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world || world.owner_id !== profile.id) return { success: false as const, error: "월드를 찾을 수 없습니다." };
    if (world.status !== "active") return { success: false as const, error: "활성 월드만 비활성화할 수 있습니다." };

    const ok = await archiveWorldLifecycle(world); // 백업 zip 생성 + 서버에서 제거 + status=archived
    if (!ok) return { success: false as const, error: "비활성화에 실패했습니다. (백업/서버 연결 확인)" };
    await logWorld(profile.creator_name, "WORLD_DEACTIVATE", `월드 비활성화: ${world.name}`);
    return { success: true as const };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 월드에 멤버 초대(소유자 전용). trusted_players 에 {uuid,name} 추가.
 * 등록된 유저면 uuid 를 채워(상대 "초대된 월드" 목록에 노출), 아니면 이름만 기록.
 * (인게임 입장/빌드 권한 enforcement 는 플러그인 연동 후 — 현재는 목록 관리만.)
 */
export async function inviteWorldMember(worldId: string, playerName: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const name = (playerName || "").trim();
    if (name.length < 2 || name.length > 16) return { success: false as const, error: "올바른 닉네임을 입력하세요." };

    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world) return { success: false as const, error: "월드를 찾을 수 없습니다." };
    if (!hasCapability(world, profile, "invite")) return { success: false as const, error: "초대 권한이 없습니다." };

    const trusted = parseTrusted(world.trusted_players);
    if (trusted.some((t) => (t.name || "").toLowerCase() === name.toLowerCase())) {
      return { success: false as const, error: "이미 초대된 멤버입니다." };
    }
    if (profile.minecraft_username && profile.minecraft_username.toLowerCase() === name.toLowerCase()) {
      return { success: false as const, error: "본인은 초대할 수 없습니다." };
    }
    if (await isInviteBlockedByName(name)) {
      return { success: false as const, error: "해당 플레이어는 초대할 수 없습니다." };
    }

    const uuid = await resolveMinecraftUuid(name);
    trusted.push({ uuid: uuid || "", name, perms: emptyPerms() }); // 기본 권한 없음 — 소유자가 개별 부여
    await prisma.minecraftWorld.update({ where: { id: world.id }, data: { trusted_players: JSON.stringify(trusted) } });
    await pushWorldAccess(world.mv_world, await ownerUuidOf(world, profile), JSON.stringify(trusted)); // 빌드 권한 동기화(소유자 기준)
    await logWorld(profile.creator_name, "WORLD_INVITE", `월드 초대: ${world.name} ← ${name}`);
    // 미연동 유저는 uuid 를 못 채움 — 상대가 연동 후 본인이 조회할 때 worldInvites 가 자동 매칭/백필
    const warning = uuid ? undefined : "이 유저는 아직 웹 연동(/웹연동)을 안 했어요. 연동하면 본인 대시보드·인게임에 자동으로 나타납니다.";
    return { success: true as const, trusted, warning };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 월드 멤버 제외(소유자 전용). 이름으로 trusted_players 에서 제거. */
export async function kickWorldMember(worldId: string, memberName: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world) return { success: false as const, error: "월드를 찾을 수 없습니다." };
    if (!hasCapability(world, profile, "kick")) return { success: false as const, error: "추방 권한이 없습니다." };

    const target = (memberName || "").trim().toLowerCase();
    const trusted = parseTrusted(world.trusted_players).filter((t) => (t.name || "").toLowerCase() !== target);
    await prisma.minecraftWorld.update({ where: { id: world.id }, data: { trusted_players: JSON.stringify(trusted) } });
    await pushWorldAccess(world.mv_world, await ownerUuidOf(world, profile), JSON.stringify(trusted)); // 빌드 권한 동기화(소유자 기준)
    await logWorld(profile.creator_name, "WORLD_KICK", `월드 제외: ${world.name} → ${memberName}`);
    return { success: true as const, trusted };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 초대받은 월드에서 본인이 스스로 나간다(원치 않은 초대 탈퇴). 소유자는 사용 불가(삭제/양도 사용). */
export async function leaveWorld(worldId: string) {
  try {
    const profile = await getAuthenticatedProfile();
    if (!profile.minecraft_uuid) return { success: false as const, error: "마인크래프트 계정 연동이 필요합니다." };

    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world) return { success: false as const, error: "월드를 찾을 수 없습니다." };
    if (world.owner_id === profile.id) return { success: false as const, error: "소유한 월드는 나갈 수 없습니다. (삭제 또는 양도를 사용하세요)" };

    const myName = (profile.minecraft_username || "").toLowerCase();
    const isMe = (t: { uuid: string; name: string }) =>
      (!!t.uuid && t.uuid === profile.minecraft_uuid) || (!!myName && (t.name || "").toLowerCase() === myName);

    const trusted = parseTrusted(world.trusted_players);
    if (!trusted.some(isMe)) return { success: false as const, error: "초대된 월드가 아닙니다." };

    const next = trusted.filter((t) => !isMe(t));
    await prisma.minecraftWorld.update({ where: { id: world.id }, data: { trusted_players: JSON.stringify(next) } });
    await pushWorldAccess(world.mv_world, await ownerUuidOf(world, profile), JSON.stringify(next)); // 소유자 기준 빌드권한 재동기화(내 권한 회수)
    await logWorld(profile.creator_name, "WORLD_LEAVE", `월드 나가기: ${world.name}`);
    return { success: true as const };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 초대 멤버의 권한(edit/gamerule/backup/download) on/off (소유자 전용). edit 변경 시 인게임 빌드 권한 재동기화. */
export async function setMemberPermission(worldId: string, memberName: string, perm: string, value: boolean) {
  try {
    const profile = await getAuthenticatedProfile();
    if (!PERM_KEYS.includes(perm as keyof MemberPerms)) return { success: false as const, error: "지원하지 않는 권한입니다." };
    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world || world.owner_id !== profile.id) return { success: false as const, error: "월드를 찾을 수 없습니다." };

    const target = (memberName || "").trim().toLowerCase();
    const trusted = parseTrusted(world.trusted_players);
    const member = trusted.find((t) => (t.name || "").toLowerCase() === target);
    if (!member) return { success: false as const, error: "해당 멤버를 찾을 수 없습니다." };
    member.perms[perm as keyof MemberPerms] = !!value;

    await prisma.minecraftWorld.update({ where: { id: world.id }, data: { trusted_players: JSON.stringify(trusted) } });
    if (perm === "edit") {
      await pushWorldAccess(world.mv_world, profile.minecraft_uuid, JSON.stringify(trusted)); // 인게임 편집 권한 반영
    }
    await logWorld(profile.creator_name, "WORLD_PERM", `권한 변경: ${world.name} / ${memberName} / ${perm}=${value}`);
    return { success: true as const, trusted };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 월드 소유권 양도 요청(소유자 전용). 받는 사람이 수락해야 완료(플롯 양도와 동일한 흐름). */
export async function transferWorld(worldId: string, recipientName: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const name = (recipientName || "").trim();
    if (name.length < 2 || name.length > 16) return { success: false as const, error: "올바른 닉네임을 입력하세요." };

    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world || world.owner_id !== profile.id) return { success: false as const, error: "월드를 찾을 수 없습니다." };
    if (world.status !== "active") return { success: false as const, error: "활성 월드만 양도할 수 있습니다." };
    if (world.pending_transfer_to) return { success: false as const, error: "이미 양도 대기 중입니다." };
    if (profile.minecraft_username && profile.minecraft_username.toLowerCase() === name.toLowerCase())
      return { success: false as const, error: "본인에게는 양도할 수 없습니다." };

    const uuid = await resolveMinecraftUuid(name);
    const recipient = uuid ? await prisma.profile.findUnique({ where: { minecraft_uuid: uuid } }) : null;
    if (!recipient) return { success: false as const, error: "받는 사람이 웹 계정을 연동하지 않았습니다. (양도받으려면 먼저 연동 필요)" };
    if (recipient.id === profile.id) return { success: false as const, error: "본인에게는 양도할 수 없습니다." };

    await prisma.minecraftWorld.update({
      where: { id: world.id },
      data: { pending_transfer_to: recipient.id, pending_transfer_at: new Date() },
    });
    await logWorld(profile.creator_name, "WORLD_TRANSFER_REQ", `양도 요청: ${world.name} → ${name}`);
    return { success: true as const, recipientName: name };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 양도 수락(받는 사람 전용). owner_id 이전 + 양쪽 쿼터 재평가 + 인게임 빌드 권한 새 소유자 기준 동기화. */
export async function acceptWorldTransfer(worldId: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world || world.pending_transfer_to !== profile.id) return { success: false as const, error: "양도 대기 중인 월드가 아닙니다." };
    // 양도 수락도 새 월드를 보유하게 되므로 보유 한도를 적용(대안 계정으로 월드를 몰아 우회하는 것 차단).
    const cap = await worldCountLimitError(profile);
    if (cap) return cap;

    const prevOwnerId = world.owner_id;
    await prisma.minecraftWorld.update({
      where: { id: world.id },
      data: { owner_id: profile.id, pending_transfer_to: null, pending_transfer_at: null },
    });
    try { await pushWorldAccess(world.mv_world, profile.minecraft_uuid, world.trusted_players || "[]"); } catch { /* 서버 미연결 무시 */ }
    try { await evaluateQuota(profile.id); } catch { /* */ } // 월드 용량이 새 소유자 쪽으로 이동
    try { await evaluateQuota(prevOwnerId); } catch { /* */ } // 이전 소유자는 용량 확보
    await logWorld(profile.creator_name, "WORLD_TRANSFER_ACCEPT", `양도 수락: ${world.name}`);
    return { success: true as const };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 양도 취소(소유자) 또는 거절(받는 사람). 양쪽 다 호출 가능 — pending 해제. */
export async function cancelWorldTransfer(worldId: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world || !world.pending_transfer_to) return { success: false as const, error: "양도 대기 중인 월드가 아닙니다." };
    if (world.owner_id !== profile.id && world.pending_transfer_to !== profile.id)
      return { success: false as const, error: "권한이 없습니다." };

    const isOwner = world.owner_id === profile.id;
    await prisma.minecraftWorld.update({
      where: { id: world.id },
      data: { pending_transfer_to: null, pending_transfer_at: null },
    });
    await logWorld(profile.creator_name, isOwner ? "WORLD_TRANSFER_CANCEL" : "WORLD_TRANSFER_REJECT", `양도 ${isOwner ? "취소" : "거절"}: ${world.name}`);
    return { success: true as const };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 나에게 양도 요청된 월드들(받는 사람용 — 수락/거절 UI). */
export async function getIncomingTransfers(viewAs?: string) {
  try {
    const { profile } = await resolveViewProfile(viewAs);
    const worlds = await prisma.minecraftWorld.findMany({
      where: { pending_transfer_to: profile.id },
      select: { id: true, name: true, icon: true, version: true, size_bytes: true, owner: { select: { creator_name: true, minecraft_username: true } } },
    });
    return worlds.map((w) => ({
      id: w.id,
      name: w.name,
      icon: w.icon,
      version: w.version,
      sizeBytes: Number(w.size_bytes),
      fromName: w.owner?.minecraft_username || w.owner?.creator_name || "?",
    }));
  } catch {
    return [];
  }
}

/** 아카이브된 월드 복구(소유자 전용). 백업 zip 으로 서버에 재삽입 후 활성화. */
export async function restoreWorld(worldId: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const locked = lockedResponse(profile);
    if (locked) return locked;
    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world || world.owner_id !== profile.id) return { success: false as const, error: "월드를 찾을 수 없습니다." };
    if (world.status !== "archived") return { success: false as const, error: "보관된 월드만 복구할 수 있습니다." };
    if (!world.mv_world || !world.backup_path) return { success: false as const, error: "복구할 백업이 없습니다." };
    // 복구는 보관(비활성)→활성이라 보유 한도를 소비한다. 한도 초과면 먼저 정리해야 복구 가능(전체 한도 불변식 유지).
    const cap = await worldCountLimitError(profile);
    if (cap) return cap;

    const res = await importMinecraftWorld(world.mv_world, world.backup_path, world.border);
    if (!res.success) return { success: false as const, error: res.error || "복구에 실패했습니다. (서버 연결 확인)" };

    await prisma.minecraftWorld.update({
      where: { id: world.id },
      data: {
        status: "active",
        archived_at: null,
        last_active_at: new Date(),
        size_bytes: BigInt(res.sizeBytes ?? Number(world.size_bytes)),
        version: res.version ?? world.version,
      },
    });
    await logWorld(profile.creator_name, "WORLD_RESTORE", `월드 복구: ${world.name}`);
    return { success: true as const };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 월드 표시 이름 변경(소유자 전용). 해시(world_key)와 서버 폴더(mv_world)는 그대로 둔다
 * → 서버 폴더 이동/재생성/재프로비저닝 없이 표시 이름만 바뀐다. 표시명 중복만 차단.
 */
export async function renameWorld(worldId: string, newName: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const locked = lockedResponse(profile);
    if (locked) return locked;
    const v = validateWorldName(newName);
    if (!v.ok) return { success: false as const, error: v.error };
    const cleanName = v.name;

    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world || world.owner_id !== profile.id) return { success: false as const, error: "월드를 찾을 수 없습니다." };
    if (world.name === cleanName) return { success: true as const, name: cleanName };

    if (await displayNameTaken(profile.id, cleanName, worldId)) {
      return { success: false as const, error: "같은 이름의 월드가 이미 있습니다." };
    }
    await prisma.minecraftWorld.update({ where: { id: world.id }, data: { name: cleanName } });
    await logWorld(profile.creator_name, "WORLD_RENAME", `월드 이름 변경: ${world.name} → ${cleanName}`);
    return { success: true as const, name: cleanName };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 월드 아이콘 변경(소유자 전용). 프리셋 키(WORLD_ICON_KEYS)만 허용하고, null 이면 기본 아이콘으로.
 * 표시용 메타데이터라 서버 폴더/프로비저닝과 무관하다(rename 과 동일하게 키만 갱신).
 */
export async function setWorldIcon(worldId: string, icon: string | null) {
  try {
    const profile = await getAuthenticatedProfile();
    const locked = lockedResponse(profile);
    if (locked) return locked;
    const validIcon = icon && WORLD_ICON_KEYS.includes(icon) ? icon : null;

    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world || world.owner_id !== profile.id) return { success: false as const, error: "월드를 찾을 수 없습니다." };
    if (world.icon === validIcon) return { success: true as const, icon: validIcon };

    await prisma.minecraftWorld.update({ where: { id: world.id }, data: { icon: validIcon } });
    await logWorld(profile.creator_name, "WORLD_ICON", `월드 아이콘 변경: ${world.name} → ${validIcon ?? "기본"}`);
    return { success: true as const, icon: validIcon };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 유저당 탐방 공유 가능 월드 수. */
const EXPLORE_SHARE_MAX = 9;

/**
 * 탐방 공유 토글(소유자 전용). 켤 때 유저당 최대 EXPLORE_SHARE_MAX 개로 제한.
 * 실제 /탐방 목록 노출 조건은 (explore_shared && !explore_suspended && status=active) — 별도 API 에서 필터.
 */
export async function setWorldExploreShare(worldId: string, shared: boolean) {
  try {
    const profile = await getAuthenticatedProfile();
    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world || world.owner_id !== profile.id) return { success: false as const, error: "월드를 찾을 수 없습니다." };
    if (world.explore_shared === shared) return { success: true as const, shared };
    if (shared) {
      if (world.explore_suspended) return { success: false as const, error: "관리자가 이 월드의 탐방 공유를 정지했습니다." };
      const sharedCount = await prisma.minecraftWorld.count({ where: { owner_id: profile.id, explore_shared: true } });
      if (sharedCount >= EXPLORE_SHARE_MAX) {
        return { success: false as const, error: `탐방 공유는 최대 ${EXPLORE_SHARE_MAX}개까지 가능합니다.` };
      }
    }
    await prisma.minecraftWorld.update({ where: { id: world.id }, data: { explore_shared: shared } });
    await logWorld(profile.creator_name, "WORLD_EXPLORE_SHARE", `탐방 공유 ${shared ? "ON" : "OFF"}: ${world.name}`);
    return { success: true as const, shared };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 탐방 공유 정지/해제(관리자·스태프 전용 — canModerate). 소유자 토글과 무관하게 목록에서 숨긴다(어뷰징 차단).
 * 정지 시 explore_shared 도 함께 끄지 않고 그대로 둬, 정지 해제하면 소유자의 기존 공유 의사가 복원되게 한다.
 */
export async function setWorldExploreSuspended(worldId: string, suspended: boolean) {
  try {
    const profile = await getAuthenticatedProfile();
    if (!canModerate(profile.role)) return { success: false as const, error: "권한이 없습니다." };
    const world = await prisma.minecraftWorld.findUnique({ where: { id: worldId } });
    if (!world) return { success: false as const, error: "월드를 찾을 수 없습니다." };
    if (world.explore_suspended === suspended) return { success: true as const, suspended };
    await prisma.minecraftWorld.update({ where: { id: world.id }, data: { explore_suspended: suspended } });
    await logWorld(profile.creator_name, "WORLD_EXPLORE_SUSPEND", `탐방 공유 ${suspended ? "정지" : "정지해제"}: ${world.name} (owner ${world.owner_id})`);
    return { success: true as const, suspended };
  } catch (e: unknown) {
    return { success: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}
