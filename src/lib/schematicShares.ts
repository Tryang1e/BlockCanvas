import { prisma } from "@/lib/prisma";

// 스키매틱 폴더 공유 권한 해석 (서버 액션 + 라우트 핸들러 공용).
// view = 보기/다운로드, edit = +업로드/삭제. (월드 멤버 권한과 동일한 "권한 형식" 철학)

export type SchemPerm = "view" | "edit";

export function isSchemPerm(v: unknown): v is SchemPerm {
  return v === "view" || v === "edit";
}

export function permLabel(p: string): string {
  return p === "edit" ? "편집" : "보기";
}

export interface SchemAccess {
  uuid: string; // 접근 대상 폴더의 minecraft_uuid
  ownerId: string; // 폴더 소유자 Profile.id
  canWrite: boolean; // 업로드/삭제 가능(본인 또는 edit 공유)
  isOwner: boolean; // 본인 폴더인지
}

/**
 * 스키매틱 폴더 접근 권한 해석.
 *  - ownerId 없음/본인 → 본인 폴더(전권 = 업로드/다운로드/삭제).
 *  - 타인 → SchematicShare 확인. view=다운로드만(canWrite=false), edit=+업로드/삭제. 공유 없으면 null(거부).
 *
 * me 는 인증된 본인 프로필. 라우트/액션이 폴더 작업 전 호출해 대상 폴더 uuid + 권한을 얻는다.
 */
export async function resolveSchemAccess(
  me: { id: string; minecraft_uuid: string | null },
  ownerId?: string | null
): Promise<SchemAccess | null> {
  if (!ownerId || ownerId === me.id) {
    if (!me.minecraft_uuid) return null; // 본인 폴더인데 연동 안 됨
    return { uuid: me.minecraft_uuid, ownerId: me.id, canWrite: true, isOwner: true };
  }
  const share = await prisma.schematicShare.findUnique({
    where: { owner_id_grantee_id: { owner_id: ownerId, grantee_id: me.id } },
    select: { perm: true },
  });
  if (!share) return null; // 나에게 공유되지 않음
  const owner = await prisma.profile.findUnique({ where: { id: ownerId }, select: { minecraft_uuid: true } });
  if (!owner?.minecraft_uuid) return null; // 소유자 폴더 없음
  return { uuid: owner.minecraft_uuid, ownerId, canWrite: share.perm === "edit", isOwner: false };
}
