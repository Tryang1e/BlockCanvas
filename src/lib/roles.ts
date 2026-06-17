// 웹 역할 체계 + 인게임 LuckPerms 그룹 매핑 + 역할별 권한(capability)의 단일 출처(single source of truth).
// 역할 위계(낮→높): user(LP builder) < creator(LP creator) < official(LP offcial) < admin(LP manager·admin).
//   LP default(미가입 MC 유저)는 웹 계정이 없어 해당 없음. 역할별 월드 쿼터는 worldQuota.ts.
// 런타임 동기화: 인게임 접속/연동 시 플러그인이 LP 그룹을 push → lpGroupToRole 로 매핑 → roleSync.ts 가 Profile.role 갱신.

export type WebRole = "user" | "creator" | "official" | "admin";

export const ROLE_RANK: Record<string, number> = {
  user: 1,
  creator: 2,
  official: 3,
  manager: 4, // LP manager = 웹 admin 동급
  admin: 4,
};

/**
 * LuckPerms 그룹명 → 웹 role.
 * 모르는 그룹/`default`(기본 미가입) 는 null → 런타임 동기화에서 "역할 변경 안 함".
 */
export function lpGroupToRole(group: string | null | undefined): WebRole | null {
  switch ((group || "").toLowerCase()) {
    case "admin":
    case "manager":
      return "admin";
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

/** 관리자 권한(어드민 패널·전체 관리). LP manager 도 웹에선 admin 동급. */
export function isAdminRole(role: string | null | undefined): boolean {
  const r = (role || "").toLowerCase();
  return r === "admin" || r === "manager";
}

/** 포트폴리오(크리에이터 기능) 사용 가능 — 일반 사용자(user) 만 제외. */
export function canManagePortfolio(role: string | null | undefined): boolean {
  return (role || "").toLowerCase() !== "user";
}

/** 공식 크리에이터 — 인증 뱃지 + explore 공식 섹션 노출 대상. */
export function isOfficialCreator(role: string | null | undefined): boolean {
  const r = (role || "").toLowerCase();
  return r === "official" || r === "admin";
}

/** 한국어 역할 라벨. */
export function roleLabel(role: string | null | undefined): string {
  switch ((role || "").toLowerCase()) {
    case "admin":
    case "manager":
      return "관리자";
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
