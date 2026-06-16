// 월드 멤버별 위임 권한 모델 (순수 함수 — 서버 액션/라우트/클라이언트 공용).
// edit = 인게임 빌드(플러그인 enforce), gamerule/backup/download = 웹 기능.
// invite/kick = 멤버 관리 위임("부반장"). 권한 부여(setMemberPermission) 자체는 소유자(반장) 전용.
export type MemberPerms = { edit: boolean; gamerule: boolean; backup: boolean; download: boolean; invite: boolean; kick: boolean };
export const PERM_KEYS: (keyof MemberPerms)[] = ["edit", "gamerule", "backup", "download", "invite", "kick"];

export function emptyPerms(): MemberPerms {
  return { edit: false, gamerule: false, backup: false, download: false, invite: false, kick: false };
}

export function normalizePerms(p: unknown): MemberPerms {
  const o = p && typeof p === "object" ? (p as Record<string, unknown>) : {};
  return { edit: !!o.edit, gamerule: !!o.gamerule, backup: !!o.backup, download: !!o.download, invite: !!o.invite, kick: !!o.kick };
}

export interface TrustedMember {
  uuid: string;
  name: string;
  perms: MemberPerms;
}

export function parseTrusted(value: string | null): TrustedMember[] {
  if (!value) return [];
  try {
    const p = JSON.parse(value);
    if (!Array.isArray(p)) return [];
    return p
      .map((m: Record<string, unknown>) => ({
        uuid: typeof m.uuid === "string" ? m.uuid : "",
        name: String(m.name ?? ""),
        perms: normalizePerms(m.perms),
      }))
      .filter((m) => m.name);
  } catch {
    return [];
  }
}

/** 소유자거나, 해당 권한을 부여받은 초대 멤버인지. (gamerule/backup/download 게이트용) */
export function hasCapability(
  world: { owner_id: string; trusted_players: string | null },
  profile: { id: string; minecraft_uuid: string | null },
  perm: keyof MemberPerms
): boolean {
  if (world.owner_id === profile.id) return true;
  if (!profile.minecraft_uuid) return false;
  const me = parseTrusted(world.trusted_players).find((t) => t.uuid && t.uuid === profile.minecraft_uuid);
  return !!me && me.perms[perm];
}

/** 특정 유저의 권한을 반환(없으면 전부 false). 초대된 월드에서 내 권한 계산용. */
export function permsFor(trustedJson: string | null, myUuid: string | null): MemberPerms {
  if (!myUuid) return emptyPerms();
  const me = parseTrusted(trustedJson).find((t) => t.uuid && t.uuid === myUuid);
  return me ? me.perms : emptyPerms();
}
