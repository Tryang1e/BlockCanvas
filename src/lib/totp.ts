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
    // 시간 불일치(Clock Skew / Time Drift) 완화: epochTolerance를 60초(±1분)로 설정.
    // 과거 300초(±5분)는 동시에 유효한 OTP 창이 너무 넓어 무차별 대입에 취약했기에 축소함.
    const result = verifySync({
      token: cleanToken,
      secret,
      epochTolerance: 60
    });
    return result.valid;
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
}
