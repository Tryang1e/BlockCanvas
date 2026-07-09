import { prisma } from "@/lib/prisma";

// 데이터 보존 정리(스케줄러 전용). 개인정보처리방침 §3 보유기간을 라이브 DB에 실제로 강제한다.
//   - 접속·이용/감사 로그(AuditLog·CreatorLog): 3개월(통신비밀보호법) 경과분 삭제.
//     ※ 재해 복구용 R2 백업본에는 정책 고지대로 최대 5년 동안 동반 보존된다(여기서는 라이브 DB만 정리).
//   - 만료된 인증/재설정 토큰(EmailVerification·PasswordReset): TTL 경과분 삭제.
//     특히 EmailVerification 은 미인증 시 email + password_hash 를 보관하므로, 재요청/소비가 없어도
//     TTL 경과분을 정기 삭제해 장기 잔존을 방지한다.
//   호출: scripts/run-backup.ps1 → POST /api/world/sweep (월드 수명주기 스윕과 동일 주기).
export const LOG_RETENTION_DAYS = 90; // 3개월(통신비밀보호법)
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24시간 (api/auth/verify-email 과 동일)
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1시간 (actions/auth 의 PASSWORD_RESET_TTL_MS 와 동일)

function msAgo(ms: number): Date {
  return new Date(Date.now() - ms);
}

export async function sweepDataRetention(): Promise<{
  auditLogsPurged: number;
  creatorLogsPurged: number;
  emailTokensPurged: number;
  resetTokensPurged: number;
}> {
  const logCutoff = msAgo(LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const [audit, creator, email, reset] = await Promise.all([
    prisma.auditLog.deleteMany({ where: { created_at: { lt: logCutoff } } }),
    prisma.creatorLog.deleteMany({ where: { created_at: { lt: logCutoff } } }),
    prisma.emailVerification.deleteMany({ where: { created_at: { lt: msAgo(EMAIL_VERIFICATION_TTL_MS) } } }),
    prisma.passwordReset.deleteMany({ where: { created_at: { lt: msAgo(PASSWORD_RESET_TTL_MS) } } }),
  ]);

  return {
    auditLogsPurged: audit.count,
    creatorLogsPurged: creator.count,
    emailTokensPurged: email.count,
    resetTokensPurged: reset.count,
  };
}
