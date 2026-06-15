// 역할별 클라우드(월드) 저장 쿼터 (MyIdea §2-4).
// 역할 체계(AdminTable): user=일반 사용자, pro=유료 크리에이터(Premium), creator=공식 크리에이터(Official), admin=관리자.
//   user 1GB / pro 5GB / creator 50GB / admin 무제한. 플랜 조정은 이 함수만 수정하면 됨.
// Infinity = 무제한(액션 경계에서 null 로 직렬화).
const GB = 1024 * 1024 * 1024;

export function getWorldQuotaBytes(role: string | null | undefined): number {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return Infinity; // 관리자
    case "creator":
      return 50 * GB; // 공식 크리에이터 (Official)
    case "pro":
      return 5 * GB; // 유료 크리에이터 (Premium)
    case "user":
      return 1 * GB; // 일반 사용자
    default:
      return 1 * GB; // 알 수 없는 역할 → 보수적으로 1GB
  }
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
