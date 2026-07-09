// 웹 역할 체계 + 인게임 LuckPerms 그룹 매핑 + 역할별 권한(capability)의 단일 출처(single source of truth).
// 역할 위계(낮→높): user(LP builder) < creator(LP creator) < official(LP offcial) < admin(LP manager·admin).
//   LP default(미가입 MC 유저)는 웹 계정이 없어 해당 없음. 역할별 월드 쿼터는 worldQuota.ts.
// 런타임 동기화: 인게임 접속/연동 시 플러그인이 LP 그룹을 push → lpGroupToRole 로 매핑 → roleSync.ts 가 Profile.role 갱신.

export type WebRole = "user" | "creator" | "official" | "manager" | "admin";

// 위계(낮→높): user < creator < official < manager(중간관리자/staff) < admin(최종관리자).
// manager 와 admin 은 둘 다 어드민 패널 접근·조정 권한을 갖지만, 파괴적·구조적 권한(삭제·역할변경·
// 사이트설정·관리자 임명)은 admin(=isSuperAdmin) 전용이다.
export const ROLE_RANK: Record<string, number> = {
  user: 1,
  creator: 2,
  official: 3,
  manager: 4, // 중간 관리자(staff) — 조정 권한
  admin: 5,   // 최종 관리자 — 전권
};

/**
 * LuckPerms 그룹명 → 웹 role.
 * 모르는 그룹/`default`(기본 미가입) 는 null → 런타임 동기화에서 "역할 변경 안 함".
 */
export function lpGroupToRole(group: string | null | undefined): WebRole | null {
  switch ((group || "").toLowerCase()) {
    case "admin":
      return "admin";
    case "manager":
      return "manager"; // 중간 관리자(staff) — 웹 manager 와 별개 위계로 분리
    case "offcial": // LP 그룹명 오타(=official). 정타도 함께 수용.
    case "official":
      return "official";
    case "creator":
      return "creator";
    case "builder":
      return "user";
    case "default": // 기본 그룹(웹 미가입 유저) → 웹 role 변경하지 않음
      return null;
    default:
      return null;
  }
}

/** 어드민 패널 접근 권한 — admin(최종) + manager(중간/staff). */
export function isAdminPanelAccess(role: string | null | undefined): boolean {
  const r = (role || "").toLowerCase();
  return r === "admin" || r === "manager";
}

/** 조정(moderation) 권한 — 뮤트·정지·메시지/공지·코인지급·유저정보 열람. admin + manager. */
export function canModerate(role: string | null | undefined): boolean {
  return isAdminPanelAccess(role);
}

/** 최종 관리자 전용 — 회원 영구삭제·역할변경·사이트설정·관리자 임명. admin 만. */
export function isSuperAdmin(role: string | null | undefined): boolean {
  return (role || "").toLowerCase() === "admin";
}

/**
 * @deprecated 의미가 모호하므로 신규 코드는 목적에 맞는 헬퍼를 쓸 것:
 *  - 패널 접근: isAdminPanelAccess, 조정: canModerate, 최종관리자 전용: isSuperAdmin.
 * 호환을 위해 admin|manager(패널 접근) 의미를 유지한다.
 */
export function isAdminRole(role: string | null | undefined): boolean {
  return isAdminPanelAccess(role);
}

/** 포트폴리오(크리에이터 기능) 사용 가능 — 일반 사용자(user) 만 제외. */
export function canManagePortfolio(role: string | null | undefined): boolean {
  return (role || "").toLowerCase() !== "user";
}

/** creator 이상(creator·official·manager·admin) — 전송 속도 2배 등 등급 혜택 게이트. user/미가입 제외. */
export function isCreatorOrAbove(role: string | null | undefined): boolean {
  return (ROLE_RANK[(role || "").toLowerCase()] ?? 0) >= ROLE_RANK.creator;
}

/** 공식 크리에이터 — 인증 뱃지 + explore 공식 섹션 노출 대상. */
export function isOfficialCreator(role: string | null | undefined): boolean {
  const r = (role || "").toLowerCase();
  return r === "official" || r === "admin";
}

/** official 이상(official·manager·admin) — 서버 월드 자체 로드/등록 등 고급 기능 게이트. isOfficialCreator 와 달리 manager(staff) 포함. */
export function isOfficialOrAbove(role: string | null | undefined): boolean {
  return (ROLE_RANK[(role || "").toLowerCase()] ?? 0) >= ROLE_RANK.official;
}

/** 한국어 역할 라벨. */
export function roleLabel(role: string | null | undefined): string {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "최종 관리자";
    case "manager":
      return "중간 관리자";
    case "official":
      return "공식 크리에이터";
    case "creator":
      return "일반 크리에이터";
    case "user":
      return "일반 사용자";
    default:
      return role || "-";
  }
}

/**
 * 웹 role → LuckPerms 그룹명 (웹→인게임 동기화: 어드민 패널 role 변경 시 인게임 그룹 set).
 * lpGroupToRole 의 역방향. 모르는 role 은 null(전송 안 함).
 */
export function roleToLpGroup(role: string | null | undefined): string | null {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "admin";
    case "manager":
      return "manager"; // 중간 관리자(staff) ↔ LP manager 그룹
    case "official":
      return "offcial"; // ⚠️ LP 그룹명 오타. 인게임에서 /lp rename offcial official 하면 여기도 'official' 로.
    case "creator":
      return "creator";
    case "user":
      return "builder";
    default:
      return null;
  }
}

type VerifiableProfile = {
  role?: string | null;
  discord_id?: string | null;
  // 현재 Discord 길드 멤버 여부. 필수 필드로 둬(옵셔널 아님) 이 게이트를 쓰는 모든 호출부가
  // 반드시 select 하도록 컴파일 타임에 강제한다(누락 시 조용히 미인증 처리되는 사고 방지).
  discord_in_guild: boolean | null;
  minecraft_uuid?: string | null;
  email?: string | null;
  password?: string | null;
};

/**
 * 3종 인증 완료 여부 — 디스코드(연동 + **현재 길드 멤버**) + 마인크래프트(정품) + 웹 회원가입(이메일/비밀번호).
 * 인게임 건축 권한(LP builder, roleSync.evaluateBuildAccess) 과 웹 건축 대시보드 접근의 단일 기준.
 * Discord 서버를 이탈하면 discord_in_guild=false 가 되어 즉시 미인증으로 떨어진다(권한 자동 회수).
 */
export function hasFullVerification(p: VerifiableProfile): boolean {
  return !!(p.discord_id && p.discord_in_guild && p.minecraft_uuid && p.email && p.password);
}

/**
 * 건축 대시보드/플롯 사용 가능 여부.
 *  - 일반 사용자(user): 3종 인증(디스코드+마크+웹가입) 모두 완료해야 함.
 *  - 관리/유료 등급(creator/official/manager/admin): 마인크래프트 연동만 있으면 됨(소비자 3종 게이트 면제 — evaluateBuildAccess 와 동일 철학).
 */
export function canUseBuildDashboard(p: VerifiableProfile): boolean {
  if (!p.minecraft_uuid) return false; // 대시보드는 마크 연동 전제(없으면 무의미)
  if ((p.role || "").toLowerCase() !== "user") return true; // 관리/유료 등급 면제
  return hasFullVerification(p);
}
