import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signSession } from '@/lib/session'
import { generateUniqueHandle } from '@/lib/handle'
import { getPublicOrigin, cookieDomain } from '@/lib/publicUrl'
import { PRIVACY_POLICY_VERSION } from '@/lib/privacy-policy'

// GET /api/auth/verify-email?token=...
// 회원가입 인증 메일 링크의 종착점. 토큰을 검증하고 Profile(role=user)을 생성한 뒤
// 세션을 발급해 대시보드로 보낸다. 인증 전까지 Profile 은 존재하지 않는다(핸들 선점 방지).

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24시간

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token') || ''

  // 인증 링크는 메인 도메인에서 열리므로 현재 공개 호스트가 곧 베이스 도메인이다.
  const origin = getPublicOrigin(req)
  const host = new URL(origin).host
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1')
  const proto = origin.startsWith('https') ? 'https' : 'http'
  const baseDomain = host // 메인 도메인(craftopia.work 또는 localhost:3000)

  const loginRedirect = (msg: string) =>
    NextResponse.redirect(`${proto}://${baseDomain}/login?message=${encodeURIComponent(msg)}`)

  if (!token) return loginRedirect('인증 링크가 올바르지 않습니다.')

  const pending = await prisma.emailVerification.findUnique({ where: { token } })
  if (!pending) return loginRedirect('인증 링크가 유효하지 않거나 이미 사용되었습니다.')

  // 만료 검사
  if (Date.now() - new Date(pending.created_at).getTime() > TOKEN_TTL_MS) {
    await prisma.emailVerification.delete({ where: { id: pending.id } }).catch(() => {})
    return loginRedirect('인증 링크가 만료되었습니다. 다시 가입해 주세요.')
  }

  // 그 사이 동일 이메일로 가입이 완료됐는지 방어
  const existing = await prisma.profile.findFirst({ where: { email: pending.email } })
  if (existing) {
    await prisma.emailVerification.delete({ where: { id: pending.id } }).catch(() => {})
    return loginRedirect('이미 가입된 이메일입니다. 로그인해 주세요.')
  }

  const emailPrefix = pending.email.split('@')[0]
  const nickname = (pending.display_name || '').trim()
  // 핸들은 닉네임 기준(서브도메인-safe 아니면 이메일 앞부분으로 폴백). 표시명은 입력한 닉네임 우선.
  const handle = await generateUniqueHandle(nickname, emailPrefix)

  await prisma.profile.create({
    data: {
      role: 'user',
      creator_name: handle,
      display_name: nickname || emailPrefix,
      email: pending.email,
      password: pending.password_hash,
      privacy_consented: true,
      privacy_consented_at: new Date(),
      privacy_consent_version: PRIVACY_POLICY_VERSION,
    },
  })
  await prisma.emailVerification.delete({ where: { id: pending.id } }).catch(() => {})

  try {
    await prisma.creatorLog.create({
      data: { creator_name: handle, action: 'SIGNUP', details: '이메일 회원가입 (user)' },
    })
  } catch {
    /* 로그 실패는 가입을 막지 않음 */
  }

  // 세션 발급 후 본인 대시보드(서브도메인)로 이동
  const res = NextResponse.redirect(`${proto}://${handle}.${baseDomain}/dashboard`)
  res.cookies.set('session', signSession(handle), {
    httpOnly: true,
    secure: proto === 'https',
    sameSite: 'lax',
    path: '/',
    domain: cookieDomain(req),
    maxAge: 60 * 60 * 24 * 30, // 30일
  })
  return res
}
