// 비밀번호 정책: 10자 이상 + 특수문자 1개 이상.
// 클라이언트(login 폼·재설정 폼)와 서버(액션) 양쪽에서 import 하는 순수 모듈(서버 전용 의존성 없음).

export const PASSWORD_MIN_LENGTH = 10

/** 특수문자 = 영문/숫자/공백 이외의 문자(예: ! @ # $ % ^ & * 등). */
const SPECIAL_CHAR_RE = /[^A-Za-z0-9\s]/

/** 사람이 읽는 정책 안내 문구(폼 힌트/플레이스홀더 등에 재사용). */
export const PASSWORD_POLICY_HINT = `${PASSWORD_MIN_LENGTH}자 이상, 특수문자 1개 이상 포함`

/** 비밀번호 정책 검증. 통과 시 { ok:true }, 실패 시 사용자에게 보여줄 한국어 사유를 담아 반환. */
export function validatePassword(pw: string): { ok: boolean; error?: string } {
  if (!pw || pw.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `비밀번호는 최소 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.` }
  }
  if (!SPECIAL_CHAR_RE.test(pw)) {
    return { ok: false, error: '비밀번호에 특수문자(!@#$ 등)를 1개 이상 포함해 주세요.' }
  }
  return { ok: true }
}
