// 역할별 클라우드(월드) 저장 쿼터 (MyIdea §2-4).
// 웹 역할 ↔ 인게임 LuckPerms 그룹: user(=LP builder) / creator(=LP creator, 일반) / official(=LP offcial, 공식) / admin(=LP manager·admin).
//   user 1GB / creator 5GB / official 50GB / admin 무제한. LP default(미가입 MC 유저)는 웹 계정 없음. 플랜 조정은 이 함수만 수정하면 됨.
// Infinity = 무제한(액션 경계에서 null 로 직렬화).
const GB = 1024 * 1024 * 1024;

export function getWorldQuotaBytes(role: string | null | undefined): number {
  switch ((role || "").toLowerCase()) {
    case "admin":
    case "manager": // LP manager = 웹 admin
      return Infinity;
    case "official":
      return 50 * GB; // 공식 크리에이터 (LP offcial)
    case "creator":
      return 5 * GB; // 일반 크리에이터 (LP creator)
    case "pro": // Premium 폐지 → creator 이관. 잔존 행 안전망(동일 5GB)
      return 5 * GB;
    case "user":
      return 1 * GB; // 일반 사용자 (LP builder)
    default:
      return 1 * GB; // 알 수 없는 역할 → 보수적으로 1GB
  }
}

/**
 * 유효 쿼터(바이트) = 역할 기본 + 보너스(예: 구독 혜택). 무제한(admin) 역할은 보너스와 무관하게 무제한.
 * bonusBytes 0 이면 역할 기본과 동일(미구독자 동작 무변경). 보너스 출처는 호출측이 계산(subscriptionQuotaBonus 등).
 */
export function effectiveQuotaBytes(role: string | null | undefined, bonusBytes: number): number {
  const base = getWorldQuotaBytes(role);
  if (!Number.isFinite(base)) return base; // 무제한
  return base + Math.max(0, Number.isFinite(bonusBytes) ? bonusBytes : 0);
}

/**
 * 역할별 월드 총 보유 한도(전체 한도 — 하루 레이트리밋이 아니라 동시 보유 상한).
 *  - user(LP builder) 7 / creator 14 / official·manager·admin 무제한(Infinity).
 * "동시에 보유할 수 있는 (비보관) 월드 수"의 상한. 기존 MAX_WORLDS(20 고정)를 역할별로 대체한다.
 * getWorldQuotaBytes 와 같은 역할 매핑을 쓰며, 무제한(Infinity)은 액션 경계에서 검사를 생략한다(디스크 쿼터로만 제한).
 * 생성·삽입·등록·양도수락·복구 모든 경로에서 이 한도를 적용해 "N개 초과 보유 불가" 불변식을 유지한다. 조정은 이 함수만 수정.
 */
export function getMaxWorlds(role: string | null | undefined): number {
  switch ((role || "").toLowerCase()) {
    case "admin":
    case "manager": // LP manager = 웹 admin
    case "official": // 공식 크리에이터 — 무제한(디스크 쿼터로만 제한)
      return Infinity;
    case "creator":
    case "pro": // Premium 폐지 → creator 이관. 잔존 행 안전망(동일 14)
      return 14; // 일반 크리에이터 (LP creator)
    case "user":
      return 7; // 일반 사용자 (LP builder)
    default:
      return 7; // 알 수 없는 역할 → 보수적으로 builder 한도
  }
}

// 쿼터 경고 임계치(90% 사용 = 10% 남음).
export const QUOTA_WARN_RATIO = 0.9;

/** 사용량/총량으로 쿼터 상태를 판정. admin(무제한)은 항상 ok. */
export function desiredQuotaState(usedBytes: number, totalBytes: number): "ok" | "warned" | "locked" {
  if (!Number.isFinite(totalBytes)) return "ok"; // 무제한
  if (usedBytes >= totalBytes) return "locked";
  if (usedBytes >= totalBytes * QUOTA_WARN_RATIO) return "warned";
  return "ok";
}

/** 바이트를 사람이 읽는 단위로 변환. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "∞";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
