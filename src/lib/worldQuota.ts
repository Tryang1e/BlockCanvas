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
