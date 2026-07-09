"use server";

import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { sessionProfile } from "@/lib/server-auth";
import {
  listSchemDir,
  walkSchematics,
  countSchematics,
  schemPathExists,
  deletePlayerSchematic,
  savePlayerSchematic,
  createSchemFolder,
  deleteSchemFolder,
  listAllFolders,
  moveSchemPath,
  resolveSchemAbs,
  safeRelFile,
  safeRelFolder,
  hasValidMagic,
  MAX_FILES,
  MAX_FILE_BYTES,
} from "@/lib/schematics";

// 다중 선택/이동 항목.
type SchemItem = { path: string; isFolder: boolean };
import { resolveSchemAccess, isSchemPerm, permLabel } from "@/lib/schematicShares";
import { resolveGranteeProfile } from "@/lib/minecraftResolve";
import { getQuotaUsage, evaluateQuota } from "@/lib/worldQuotaEnforcement";
import { runSchemConvert, targetConvertExt } from "@/lib/schematicConvert";
import { formatBytes } from "@/lib/worldQuota";

async function getAuthenticatedProfile() {
  const profile = await sessionProfile(); // 서명·만료·token_version 대조까지 (무효화 세션 거부)
  if (!profile) throw new Error("Unauthorized: Please log in first.");
  return profile;
}

/** 내 스키매틱 목록(subPath 폴더의 하위 폴더 + 파일) + 업로드 제한 + 공동 쿼터. */
export async function getMySchematics(subPath?: string) {
  const empty = { folders: [] as string[], files: [], path: "", maxFiles: MAX_FILES, maxBytes: MAX_FILE_BYTES };
  try {
    const profile = await getAuthenticatedProfile();
    if (!profile.minecraft_uuid) {
      return { success: false as const, error: "먼저 마인크래프트 계정을 연동해주세요.", ...empty };
    }
    const folder = safeRelFolder(subPath || "");
    if (folder === null) return { success: false as const, error: "잘못된 폴더 경로입니다.", ...empty };
    const listing = await listSchemDir(profile.minecraft_uuid, folder);
    const quota = await getQuotaUsage(profile.id); // 월드 클라우드와 공동 풀(월드+스키매틱)
    return { success: true as const, folders: listing.folders, files: listing.files, path: folder, maxFiles: MAX_FILES, maxBytes: MAX_FILE_BYTES, quota };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : String(error), ...empty };
  }
}

/** 새 폴더 생성(현재 폴더 parentPath 아래 folderName). ownerId 있으면 공유 폴더(edit 필요). */
export async function createSchematicFolderAction(parentPath: string, folderName: string, ownerId?: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const access = await resolveSchemAccess(profile, ownerId);
    if (!access) return { success: false, error: "권한이 없거나 마인크래프트 계정이 연동되지 않았습니다." };
    if (!access.canWrite) return { success: false, error: "폴더 생성 권한이 없습니다 (보기 전용 공유)." };
    const parent = safeRelFolder(parentPath || "");
    if (parent === null) return { success: false, error: "잘못된 폴더 경로입니다." };
    // 폴더명은 단일 세그먼트만(슬래시/위험문자 차단) → safeRelFolder 로 검증.
    const seg = safeRelFolder(folderName);
    if (!seg || seg.includes("/")) return { success: false, error: "폴더 이름이 잘못되었습니다." };
    const rel = parent ? `${parent}/${seg}` : seg;
    if (safeRelFolder(rel) === null) return { success: false, error: "폴더 깊이가 너무 깊습니다." };
    if (await schemPathExists(access.uuid, rel)) return { success: false, error: "같은 이름의 폴더/파일이 이미 있습니다." };
    const ok = await createSchemFolder(access.uuid, rel);
    if (!ok) return { success: false, error: "폴더를 생성하지 못했습니다." };
    return { success: true, message: `폴더 '${seg}' 생성됨.` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** 폴더 삭제(재귀 — 안의 파일까지 모두 삭제). ownerId 있으면 공유 폴더(edit 필요). */
export async function deleteSchematicFolderAction(relFolder: string, ownerId?: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const access = await resolveSchemAccess(profile, ownerId);
    if (!access) return { success: false, error: "권한이 없거나 마인크래프트 계정이 연동되지 않았습니다." };
    if (!access.canWrite) return { success: false, error: "삭제 권한이 없습니다 (보기 전용 공유)." };
    const folder = safeRelFolder(relFolder);
    if (folder === null || folder === "") return { success: false, error: "삭제할 폴더 경로가 잘못되었습니다." };
    const ok = await deleteSchemFolder(access.uuid, folder);
    if (!ok) return { success: false, error: "폴더를 삭제하지 못했습니다." };
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "mc_schem_folder_delete", target_id: folder, details: access.isOwner ? "" : `shared:${access.ownerId}` },
    });
    try { await evaluateQuota(access.ownerId); } catch { /* 용량 확보 반영(베스트에포트) */ }
    return { success: true, message: `폴더 삭제됨.` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** 내 모든 폴더(재귀) 경로 목록 — 이동 대상 선택 모달용. */
export async function getSchemFolderTree() {
  try {
    const profile = await getAuthenticatedProfile();
    if (!profile.minecraft_uuid) return { success: false as const, error: "먼저 마인크래프트 계정을 연동해주세요.", folders: [] as string[] };
    const folders = await listAllFolders(profile.minecraft_uuid);
    return { success: true as const, folders };
  } catch (error: unknown) {
    return { success: false as const, error: error instanceof Error ? error.message : String(error), folders: [] as string[] };
  }
}

/** 선택한 파일/폴더들을 destFolder 로 이동(본인 폴더 내). 같은 트리 내 rename 이라 쿼터 불변. */
export async function moveSchematicsAction(items: SchemItem[], destFolder: string) {
  try {
    const profile = await getAuthenticatedProfile();
    if (!profile.minecraft_uuid) return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };
    const uuid = profile.minecraft_uuid;
    const dest = safeRelFolder(destFolder);
    if (dest === null) return { success: false, error: "잘못된 대상 폴더입니다." };

    let moved = 0;
    const errors: string[] = [];
    for (const item of items || []) {
      const srcRel = item.isFolder ? safeRelFolder(item.path) : safeRelFile(item.path);
      if (!srcRel) { errors.push("잘못된 항목"); continue; }
      const baseName: string = srcRel.includes("/") ? srcRel.slice(srcRel.lastIndexOf("/") + 1) : srcRel;
      const destRel: string = dest ? `${dest}/${baseName}` : baseName;
      const destValid = item.isFolder ? safeRelFolder(destRel) : safeRelFile(destRel);
      if (!destValid) { errors.push(`${baseName}: 대상 경로 무효`); continue; }
      if (destRel === srcRel) continue; // 이미 그 위치(no-op)
      // 폴더를 자기 자신/하위로 이동 금지(무한/오류 방지).
      if (item.isFolder && (dest === srcRel || dest.startsWith(`${srcRel}/`))) { errors.push(`${baseName}: 자기 하위로는 이동 불가`); continue; }
      if (await schemPathExists(uuid, destRel)) { errors.push(`${baseName}: 대상에 같은 이름 존재`); continue; }
      if (await moveSchemPath(uuid, srcRel, destRel)) moved++;
      else errors.push(`${baseName}: 이동 실패`);
    }
    await prisma.profile.update({ where: { id: profile.id }, data: { last_seen_at: new Date() } }).catch(() => {});
    if (moved === 0) return { success: false, error: errors[0] || "이동할 항목이 없습니다." };
    return { success: true, message: `${moved}개 이동${errors.length ? ` · ${errors.length}개 실패` : ""}.`, moved, errors };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** 선택한 파일/폴더들 일괄 삭제(본인 폴더). 폴더는 재귀. */
export async function deleteSchematicsAction(items: SchemItem[]) {
  try {
    const profile = await getAuthenticatedProfile();
    if (!profile.minecraft_uuid) return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };
    const uuid = profile.minecraft_uuid;
    let deleted = 0;
    const errors: string[] = [];
    for (const item of items || []) {
      if (item.isFolder) {
        const f = safeRelFolder(item.path);
        if (!f) { errors.push("잘못된 폴더"); continue; }
        if (await deleteSchemFolder(uuid, f)) deleted++; else errors.push(`${f}: 삭제 실패`);
      } else {
        const f = safeRelFile(item.path);
        if (!f) { errors.push("잘못된 파일"); continue; }
        if (await deletePlayerSchematic(uuid, f)) deleted++; else errors.push(`${f}: 삭제 실패`);
      }
    }
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "mc_schem_bulk_delete", target_id: String(deleted), details: "" },
    }).catch(() => {});
    try { await evaluateQuota(profile.id); } catch { /* 용량 확보 반영(베스트에포트) */ }
    if (deleted === 0) return { success: false, error: errors[0] || "삭제할 항목이 없습니다." };
    return { success: true, message: `${deleted}개 삭제${errors.length ? ` · ${errors.length}개 실패` : ""}.`, deleted };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** 스키매틱 파일 삭제(상대경로). ownerId 없으면 본인 폴더, 있으면 공유받은 폴더(edit 권한 필요). */
export async function deleteSchematicAction(relPath: string, ownerId?: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const access = await resolveSchemAccess(profile, ownerId);
    if (!access) return { success: false, error: "권한이 없거나 마인크래프트 계정이 연동되지 않았습니다." };
    if (!access.canWrite) return { success: false, error: "삭제 권한이 없습니다 (보기 전용 공유)." };
    const safe = safeRelFile(relPath);
    if (!safe) return { success: false, error: "잘못된 파일 경로입니다." };
    const ok = await deletePlayerSchematic(access.uuid, safe);
    if (!ok) return { success: false, error: "삭제에 실패했습니다 (파일을 찾을 수 없음)." };
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "mc_schem_delete", target_id: safe, details: access.isOwner ? "" : `shared:${access.ownerId}` },
    });
    try { await evaluateQuota(access.ownerId); } catch { /* 용량 확보 → 잠금 해제 등 반영(베스트에포트) */ }
    return { success: true, message: `${path.basename(safe)} 삭제했습니다.` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * .schem ↔ .bp(Axiom 블루프린트) 변환. 결과 파일을 같은 폴더에 저장(공동 쿼터·개수 검사).
 * SchemConvert jar 를 서버 프로세스로 호출. ownerId 있으면 공유 폴더(edit 권한 필요).
 */
export async function convertSchematicAction(relPath: string, ownerId?: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const access = await resolveSchemAccess(profile, ownerId);
    if (!access) return { success: false, error: "권한이 없거나 마인크래프트 계정이 연동되지 않았습니다." };
    if (!access.canWrite) return { success: false, error: "변환 권한이 없습니다 (보기 전용 공유)." };

    const safe = safeRelFile(relPath);
    if (!safe) return { success: false, error: "잘못된 파일 경로입니다." };
    const targetExt = targetConvertExt(safe);
    if (!targetExt) return { success: false, error: "변환할 수 없는 형식입니다." };

    const inputPath = resolveSchemAbs(access.uuid, safe);
    if (!inputPath) return { success: false, error: "잘못된 경로입니다." };
    try { await fs.access(inputPath); } catch { return { success: false, error: "원본 파일을 찾을 수 없습니다." }; }

    // 출력은 원본과 같은 폴더에, 확장자만 교체.
    const slash = safe.lastIndexOf("/");
    const folder = slash >= 0 ? safe.slice(0, slash) : "";
    const base = slash >= 0 ? safe.slice(slash + 1) : safe;
    const baseNoExt = base.slice(0, base.length - path.extname(base).length);
    const outRel = safeRelFile(folder ? `${folder}/${baseNoExt}${targetExt}` : `${baseNoExt}${targetExt}`);
    if (!outRel) return { success: false, error: "출력 파일 경로가 잘못되었습니다." };
    const outName = path.basename(outRel);
    // 대상이 이미 있으면 덮어쓰기 방지(의도치 않은 손실 차단).
    if (await schemPathExists(access.uuid, outRel)) {
      return { success: false, error: `이미 ${outName} 파일이 있습니다. 삭제 후 다시 변환하세요.` };
    }

    // 개수 제한(신규 1개 추가).
    if (await countSchematics(access.uuid) >= MAX_FILES) {
      return { success: false, error: `스키매틱 개수 한도(${MAX_FILES})를 초과했습니다.` };
    }

    // 임시 파일로 변환 → 검증 → 공동 쿼터 → 폴더 저장(원자적으로 최종본만 폴더에 들어가도록).
    const tmp = path.join(os.tmpdir(), `bcschem-${randomUUID()}${targetExt}`);
    const res = await runSchemConvert(inputPath, tmp);
    if (!res.ok) {
      await fs.unlink(tmp).catch(() => {});
      return { success: false, error: res.error || "변환에 실패했습니다." };
    }
    let outBuf: Buffer;
    try {
      outBuf = await fs.readFile(tmp);
    } catch {
      return { success: false, error: "변환 결과를 읽지 못했습니다." };
    }
    if (!hasValidMagic(outName, outBuf)) {
      await fs.unlink(tmp).catch(() => {});
      return { success: false, error: "변환 결과 형식이 올바르지 않습니다." };
    }
    const quota = await getQuotaUsage(access.ownerId);
    if (quota.totalBytes !== null && quota.usedBytes + outBuf.length > quota.totalBytes) {
      await fs.unlink(tmp).catch(() => {});
      return { success: false, error: `클라우드 용량이 부족합니다 (${formatBytes(quota.usedBytes)} / ${formatBytes(quota.totalBytes)} 사용 중). 정리 후 변환하세요.` };
    }

    await savePlayerSchematic(access.uuid, outRel, outBuf);
    await fs.unlink(tmp).catch(() => {});
    await prisma.profile.update({ where: { id: access.ownerId }, data: { last_seen_at: new Date() } }).catch(() => {});
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "mc_schem_convert", target_id: outRel, details: `${safe}->${outRel}` },
    });
    try { await evaluateQuota(access.ownerId); } catch { /* 경고/잠금 전이 반영(베스트에포트) */ }
    return { success: true, message: `${outName} (으)로 변환했습니다.`, name: outRel };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ============================================================
//  스키매틱 폴더 공유 (권한 형식: view=보기/다운로드, edit=+업로드/삭제)
// ============================================================

/** 내 스키매틱 폴더를 닉네임 유저에게 공유(부여/갱신). 권한 = view | edit. */
export async function shareSchematicAction(nick: string, perm: string) {
  try {
    const profile = await getAuthenticatedProfile();
    if (!profile.minecraft_uuid) return { success: false, error: "먼저 마인크래프트 계정을 연동해주세요." };
    if (!isSchemPerm(perm)) return { success: false, error: "잘못된 권한입니다." };
    const grantee = await resolveGranteeProfile(nick);
    if (!grantee) return { success: false, error: "그 유저를 찾을 수 없습니다 (웹 가입 + 마인크래프트 연동 필요)." };
    if (grantee.id === profile.id) return { success: false, error: "자기 자신에게는 공유할 수 없습니다." };
    await prisma.schematicShare.upsert({
      where: { owner_id_grantee_id: { owner_id: profile.id, grantee_id: grantee.id } },
      update: { perm },
      create: { owner_id: profile.id, grantee_id: grantee.id, perm },
    });
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "mc_schem_share", target_id: grantee.id, details: perm },
    });
    const who = grantee.minecraft_username || grantee.creator_name;
    return { success: true, message: `${who} 님에게 ${permLabel(perm)} 권한으로 공유했습니다.` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** 부여된 공유의 권한 변경(view ↔ edit). */
export async function setSharePermAction(granteeId: string, perm: string) {
  try {
    const profile = await getAuthenticatedProfile();
    if (!isSchemPerm(perm)) return { success: false, error: "잘못된 권한입니다." };
    const res = await prisma.schematicShare.updateMany({
      where: { owner_id: profile.id, grantee_id: granteeId },
      data: { perm },
    });
    if (res.count === 0) return { success: false, error: "공유를 찾을 수 없습니다." };
    return { success: true, message: `권한을 ${permLabel(perm)}(으)로 변경했습니다.` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** 공유 해제(본인이 부여한 것만). */
export async function unshareSchematicAction(granteeId: string) {
  try {
    const profile = await getAuthenticatedProfile();
    const res = await prisma.schematicShare.deleteMany({ where: { owner_id: profile.id, grantee_id: granteeId } });
    if (res.count === 0) return { success: false, error: "공유를 찾을 수 없습니다." };
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: "mc_schem_unshare", target_id: granteeId, details: "" },
    });
    return { success: true, message: "공유를 해제했습니다." };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** 내가 부여한 공유 목록(공유 관리 UI용). */
export async function getMyShares() {
  try {
    const profile = await getAuthenticatedProfile();
    const shares = await prisma.schematicShare.findMany({
      where: { owner_id: profile.id },
      orderBy: { created_at: "desc" },
      select: {
        grantee_id: true,
        perm: true,
        grantee: { select: { creator_name: true, minecraft_username: true, minecraft_uuid: true } },
      },
    });
    return {
      success: true,
      shares: shares.map((s) => ({
        granteeId: s.grantee_id,
        perm: s.perm,
        name: s.grantee.minecraft_username || s.grantee.creator_name,
        uuid: s.grantee.minecraft_uuid,
      })),
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error), shares: [] };
  }
}

/** 나에게 공유된 폴더 + 각 폴더의 파일 목록(공유받은 스키매틱 UI용). */
export async function getSharedWithMe() {
  try {
    const profile = await getAuthenticatedProfile();
    const shares = await prisma.schematicShare.findMany({
      where: { grantee_id: profile.id },
      orderBy: { created_at: "desc" },
      select: {
        owner_id: true,
        perm: true,
        owner: { select: { creator_name: true, minecraft_username: true, minecraft_uuid: true } },
      },
    });
    const out = [];
    for (const s of shares) {
      const files = s.owner.minecraft_uuid ? await walkSchematics(s.owner.minecraft_uuid) : [];
      out.push({
        ownerId: s.owner_id,
        perm: s.perm,
        canWrite: s.perm === "edit",
        ownerName: s.owner.minecraft_username || s.owner.creator_name,
        ownerUuid: s.owner.minecraft_uuid,
        files,
      });
    }
    return { success: true, shares: out, maxFiles: MAX_FILES, maxBytes: MAX_FILE_BYTES };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : String(error), shares: [], maxFiles: MAX_FILES, maxBytes: MAX_FILE_BYTES };
  }
}
