// 처벌(제재) 체계의 단일 출처 — 프리셋 티어·상태 계산·게이트 헬퍼.
// 웹 DB(Profile.status/suspended_until/muted_until)가 원장이고, 마크/디스코드는 best-effort 전파(actions/moderation).
//   - status: active | suspended(이용정지·DB 보관) | banned(항소 후 영구차단=삭제 대상)
//   - suspended_until: null + status='suspended' = 무기한 정지. 미래시각 = 그때까지. 과거시각 = 만료(활성 취급).
//   - muted_until: 미래시각이면 뮤트 중. null/과거 = 뮤트 아님.

import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export type Severity = "low" | "medium" | "high" | "custom";

export interface Preset {
  label: string;
  muteDays: number | null;
  suspendDays: number | null;
  permanentSuspend: boolean; // true = 무기한 이용정지(suspended, until=null) — 영구차단(banned)과는 다름
  description: string;
}

// 사용자 정의 처벌 규정(요청):
//   경미 → 뮤트 5일 + 이용정지 3일 / 중간 → 뮤트 30일 + 이용정지 3주(21일) / 심각 → 무기한 이용정지
export const PUNISHMENT_PRESETS: Record<"low" | "medium" | "high", Preset> = {
  low: { label: "경미", muteDays: 5, suspendDays: 3, permanentSuspend: false, description: "커뮤니티에 적은 피해 — 뮤트 5일 + 이용정지 3일" },
  medium: { label: "중간", muteDays: 30, suspendDays: 21, permanentSuspend: false, description: "어느 정도의 피해 — 뮤트 30일 + 이용정지 3주(21일)" },
  high: { label: "심각", muteDays: null, suspendDays: null, permanentSuspend: true, description: "막대한 피해 — 무기한 이용정지" },
};

export interface CustomPunishment {
  muteDays?: number | null;
  suspendDays?: number | null;
  permanentSuspend?: boolean;
}

export interface ComputedPunishment {
  muteUntil: Date | null; // 이 액션이 설정할 뮤트 만료. null = 뮤트 미적용.
  suspendUntil: Date | null; // 이 액션이 설정할 정지 만료. null 이고 suspend=true 면 무기한.
  suspend: boolean; // 정지 적용 여부
}

/** 티어/커스텀 입력을 실제 만료 시각으로 환산. */
export function computePunishment(
  severity: Severity,
  custom?: CustomPunishment,
  now: number = Date.now()
): ComputedPunishment {
  let muteDays: number | null;
  let suspendDays: number | null;
  let permanent: boolean;

  if (severity === "custom") {
    muteDays = custom?.muteDays ?? null;
    suspendDays = custom?.suspendDays ?? null;
    permanent = !!custom?.permanentSuspend;
  } else {
    const p = PUNISHMENT_PRESETS[severity];
    muteDays = p.muteDays;
    suspendDays = p.suspendDays;
    permanent = p.permanentSuspend;
  }

  const muteUntil = muteDays && muteDays > 0 ? new Date(now + muteDays * DAY_MS) : null;
  let suspend = false;
  let suspendUntil: Date | null = null;
  if (permanent) {
    suspend = true;
    suspendUntil = null; // 무기한
  } else if (suspendDays && suspendDays > 0) {
    suspend = true;
    suspendUntil = new Date(now + suspendDays * DAY_MS);
  }
  return { muteUntil, suspendUntil, suspend };
}

export interface ModerationStatusInput {
  status?: string | null;
  suspended_until?: Date | null;
  muted_until?: Date | null;
  moderation_reason?: string | null;
}

export interface ModerationState {
  isBanned: boolean;
  isSuspended: boolean; // 활성 정지(무기한 또는 미래 만료)
  isMuted: boolean;
  isBlocked: boolean; // 로그인/접근 차단 = banned || 활성 정지
  suspendedUntil: Date | null; // null + isSuspended = 무기한
  mutedUntil: Date | null;
  reason: string | null;
}

/** Profile 의 제재 필드 → 현재 상태(만료 시각은 읽기 시 lazy 판정). */
export function getModerationState(p: ModerationStatusInput, now: number = Date.now()): ModerationState {
  const status = (p.status || "active").toLowerCase();
  const isBanned = status === "banned";
  const suspendedUntil = p.suspended_until ?? null;
  let isSuspended = false;
  if (status === "suspended") {
    isSuspended = !suspendedUntil || suspendedUntil.getTime() > now;
  }
  const mutedUntil = p.muted_until ?? null;
  const isMuted = !!mutedUntil && mutedUntil.getTime() > now;
  return {
    isBanned,
    isSuspended,
    isMuted,
    isBlocked: isBanned || isSuspended,
    suspendedUntil,
    mutedUntil,
    reason: p.moderation_reason ?? null,
  };
}

/** 한국어 만료 표기. null = 무기한. */
export function fmtUntil(d: Date | null): string {
  if (!d) return "무기한";
  return new Date(d).toLocaleString("ko-KR");
}

/** 로그인/접근 차단 시 사용자에게 보여줄 안내 메시지. */
export function blockedMessage(st: ModerationState): string {
  if (st.isBanned) return `계정이 영구 정지(차단)되었습니다. 사유: ${st.reason || "관리자 문의"}`;
  return `계정이 이용정지되었습니다 (${fmtUntil(st.suspendedUntil)} 까지). 사유: ${st.reason || "관리자 문의"}`;
}

/**
 * 콘텐츠 생성 차단용 게이트. profileId 가 뮤트/정지/차단 상태면 안내 메시지를, 아니면 null 을 반환.
 * 서버 액션에서: `const m = await checkMuted(id); if (m) return { error: m }`.
 */
export async function checkMuted(profileId: string): Promise<string | null> {
  const p = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { status: true, suspended_until: true, muted_until: true, moderation_reason: true },
  });
  if (!p) return null;
  const st = getModerationState(p);
  if (st.isBlocked) return blockedMessage(st);
  if (st.isMuted) return `현재 뮤트 상태로 작성이 제한됩니다 (${fmtUntil(st.mutedUntil)} 까지). 사유: ${st.reason || "관리자 문의"}`;
  return null;
}
