import { generateSecret, generateURI, verifySync } from 'otplib';

/**
 * 새로운 2FA Base32 Secret Key를 생성합니다.
 */
export function generateTotpSecret(): string {
  return generateSecret();
}

/**
 * Google Authenticator 앱 연동을 위한 otpauth:// URI를 생성합니다.
 * @param creatorName 크리에이터 ID/이름
 * @param secret Base32 Secret Key
 */
export function getOtpauthUrl(creatorName: string, secret: string): string {
  return generateURI({
    secret,
    label: creatorName,
    issuer: 'BlockCanvas'
  });
}

/**
 * 사용자가 입력한 6자리 2FA 인증 코드를 검증합니다.
 * @param token 6자리 인증 코드
 * @param secret 사용자의 Base32 Secret Key
 */
export function verifyTotpToken(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  try {
    const cleanToken = token.trim();
    // 시간 불일치(Clock Skew / Time Drift) 방지: epochTolerance를 300초(앞뒤로 최대 5분 시간 차이 허용)로 설정하여 시간 동기화 오차 문제를 원천 방어합니다.
    const result = verifySync({
      token: cleanToken,
      secret,
      epochTolerance: 300
    });
    return result.valid;
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
}
