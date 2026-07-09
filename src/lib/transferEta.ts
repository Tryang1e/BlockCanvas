// 사용자 노출용 예상 전송시간(ETA) — QoS 동적 배분(qosPolicy)을 반영한 속도 "범위"로 최소~최대 시간을 낸다.
//   빠른 쪽(max) = 방향 총 대역(혼자 전송할 때 전부 몰아받는 경우),
//   느린 쪽(min) = 역할 기본레벨(user 1 / creator+ 2 MB/s — 혼잡 시 가중 배분의 근사 하한, 등급 배수 적용).
// 순수 모듈(클라이언트/서버 공용). 실제 총량은 env 로 조정하지만, 표시 범위는 이 상수를 쓴다.
import { qosWeight, QOS_BASE_MBPS, QOS_TOTAL_DEFAULT_MBPS } from "@/lib/qosPolicy";

const MB = 1024 * 1024;
export const UPLOAD_ETA_BPS = { min: QOS_BASE_MBPS.user * MB, max: QOS_TOTAL_DEFAULT_MBPS * MB }; // 1 ~ 4 MB/s
export const DOWNLOAD_ETA_BPS = { min: QOS_BASE_MBPS.user * MB, max: QOS_TOTAL_DEFAULT_MBPS * MB }; // 1 ~ 4 MB/s

// 등급 속도 배수 — creator 이상은 혼잡 시 2배 지분(업로드/다운로드/ETA 동일 기준, qosPolicy 가중치 비율).
export const CREATOR_SPEED_MULTIPLIER = QOS_BASE_MBPS.creatorPlus / QOS_BASE_MBPS.user;
export function transferMultiplier(role: string | null | undefined): number {
  return qosWeight(role) / QOS_BASE_MBPS.user;
}

// 초 → "N초" / "N분" / "N시간 M분" (올림, 최소 1초).
function fmtDuration(secs: number): string {
  const s = Math.max(1, Math.ceil(secs));
  if (s < 60) return `${s}초`;
  const totalMin = Math.ceil(s / 60);
  if (totalMin < 60) return `${totalMin}분`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

// bytes 전송 시간 범위. 빠른 쪽 = 총 대역(max, 혼자일 때 — 역할 무관, 파이프 전체가 상한이라 mult 미적용),
// 느린 쪽 = 기본레벨(min)×mult(혼잡 시 등급 지분). 반환 예: "약 8분 ~ 34분" (양끝 같으면 "약 8분"). bytes 0/미상이면 "".
export function etaRangeText(bytes: number, bps: { min: number; max: number }, mult = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const m = mult > 0 ? mult : 1;
  const fast = fmtDuration(bytes / bps.max);
  const slow = fmtDuration(bytes / Math.min(bps.max, bps.min * m));
  return fast === slow ? `약 ${fast}` : `약 ${fast} ~ ${slow}`;
}
