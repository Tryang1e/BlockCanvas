// Resend REST API 로 트랜잭션 메일 발송 (SDK 의존성 없이 fetch 직접 호출).
// 환경변수: RESEND_API_KEY(필수), EMAIL_FROM(선택, 미설정 시 기본 발신자).
// RESEND_API_KEY 미설정 시 ok:false + 'not_configured' 를 반환 — 호출부(가입 흐름)가 이를 처리한다.

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

function fromAddress(): string {
  // Resend 는 검증된 도메인의 발신자만 허용. 운영 전 craftopia.work 도메인을 Resend 에 등록해야 한다.
  return process.env.EMAIL_FROM || 'craftopia <noreply@craftopia.work>'
}

/** 단일 메일 발송. 성공 시 { ok:true }, 실패 시 { ok:false, error }. */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'not_configured' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddress(), to, subject, html }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      return { ok: false, error: `resend_${res.status}: ${t.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 회원가입 이메일 인증 메일 본문(브랜드 톤의 미니멀 HTML). */
export function verificationEmailHtml(verifyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ko"><body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">
  <div style="max-width:460px;margin:40px auto;background:#ffffff;border:1px solid #ececec;border-radius:20px;padding:40px 36px;">
    <h1 style="font-size:20px;font-weight:800;color:#111;margin:0 0 8px;">craftopia 이메일 인증</h1>
    <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 28px;">
      아래 버튼을 눌러 이메일 인증을 완료하면 회원가입이 마무리됩니다.<br/>
      본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.
    </p>
    <a href="${verifyUrl}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 28px;border-radius:14px;">
      이메일 인증하고 가입 완료
    </a>
    <p style="font-size:11px;color:#aaa;line-height:1.6;margin:28px 0 0;">
      버튼이 동작하지 않으면 아래 주소를 브라우저에 붙여넣으세요:<br/>
      <span style="color:#888;word-break:break-all;">${verifyUrl}</span>
    </p>
    <p style="font-size:11px;color:#bbb;margin:20px 0 0;">* 이 링크는 24시간 동안 유효합니다.</p>
  </div>
</body></html>`
}

/** 비밀번호 재설정(비밀번호 찾기) 메일 본문. */
export function passwordResetEmailHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ko"><body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">
  <div style="max-width:460px;margin:40px auto;background:#ffffff;border:1px solid #ececec;border-radius:20px;padding:40px 36px;">
    <h1 style="font-size:20px;font-weight:800;color:#111;margin:0 0 8px;">craftopia 비밀번호 재설정</h1>
    <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 28px;">
      아래 버튼을 눌러 새 비밀번호를 설정해 주세요.<br/>
      본인이 요청하지 않았다면 이 메일을 무시하셔도 되며, 비밀번호는 변경되지 않습니다.
    </p>
    <a href="${resetUrl}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 28px;border-radius:14px;">
      비밀번호 재설정하기
    </a>
    <p style="font-size:11px;color:#aaa;line-height:1.6;margin:28px 0 0;">
      버튼이 동작하지 않으면 아래 주소를 브라우저에 붙여넣으세요:<br/>
      <span style="color:#888;word-break:break-all;">${resetUrl}</span>
    </p>
    <p style="font-size:11px;color:#bbb;margin:20px 0 0;">* 이 링크는 1시간 동안 유효합니다.</p>
  </div>
</body></html>`
}

/** 아이디(핸들)·포트폴리오 주소 안내 메일 본문. */
export function findHandleEmailHtml(handle: string, siteUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ko"><body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">
  <div style="max-width:460px;margin:40px auto;background:#ffffff;border:1px solid #ececec;border-radius:20px;padding:40px 36px;">
    <h1 style="font-size:20px;font-weight:800;color:#111;margin:0 0 8px;">craftopia 계정 안내</h1>
    <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 20px;">
      요청하신 계정 정보입니다. 로그인은 이 이메일 주소와 비밀번호로 진행하실 수 있습니다.
    </p>
    <div style="background:#fafafa;border:1px solid #ececec;border-radius:14px;padding:16px 18px;margin:0 0 24px;">
      <p style="font-size:12px;color:#888;margin:0 0 4px;">내 아이디(핸들)</p>
      <p style="font-size:16px;font-weight:800;color:#111;margin:0 0 14px;">@${handle}</p>
      <p style="font-size:12px;color:#888;margin:0 0 4px;">내 포트폴리오 주소</p>
      <a href="${siteUrl}" style="font-size:14px;font-weight:700;color:#0a0a0a;word-break:break-all;">${siteUrl}</a>
    </div>
    <p style="font-size:11px;color:#bbb;margin:0;">본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>
  </div>
</body></html>`
}
