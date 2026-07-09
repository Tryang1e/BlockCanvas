import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signSession } from '@/lib/session'
import { generateUniqueHandle } from '@/lib/handle'
import { getPublicOrigin, cookieDomain } from '@/lib/publicUrl'
import { PRIVACY_POLICY_VERSION } from '@/lib/privacy-policy'
import { evaluateBuildAccess } from '@/lib/roleSync'
import { isIdentityBlockedStrict } from '@/lib/blocklist'

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

  // 접근 차단 목록 대조 — 제재 회피(재가입) 방지. 차단된 이메일은 가입/이메일 추가를 거부한다.
  // DB 조회 장애 시 fail-closed: 가입/연동을 완료하지 않고 재시도 안내(차단 우회 방지).
  try {
    if (await isIdentityBlockedStrict('email', pending.email)) {
      await prisma.emailVerification.delete({ where: { id: pending.id } }).catch(() => {})
      return loginRedirect('이 이메일은 이용이 제한되어 가입할 수 없습니다. 문의: 운영진.')
    }
  } catch {
    return loginRedirect('일시적인 오류로 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }

  // ── 기존 계정에 이메일/비번 추가(Discord-only 가입자의 3종 충족용) ──
  if (pending.profile_id) {
    const clash = await prisma.profile.findFirst({ where: { email: pending.email } })
    if (clash && clash.id !== pending.profile_id) {
      await prisma.emailVerification.delete({ where: { id: pending.id } }).catch(() => {})
      return loginRedirect('이미 다른 계정에서 사용 중인 이메일입니다.')
    }
    const profile = await prisma.profile.findUnique({ where: { id: pending.profile_id } })
    if (!profile) {
      await prisma.emailVerification.delete({ where: { id: pending.id } }).catch(() => {})
      return loginRedirect('계정을 찾을 수 없습니다.')
    }
    await prisma.profile.update({
      where: { id: profile.id },
      data: { email: pending.email, password: pending.password_hash },
    })
    await prisma.emailVerification.delete({ where: { id: pending.id } }).catch(() => {})
    await evaluateBuildAccess(profile.id).catch(() => {}) // 3종 충족 시 인게임 건축 권한 자동 부여

    try {
      await prisma.creatorLog.create({
        data: { creator_name: profile.creator_name, action: 'EMAIL_ADDED', details: '이메일/비밀번호 추가 인증 완료' },
      })
    } catch {
      /* 로그 실패 무시 */
    }

    // 다른 기기에서 링크를 눌렀어도 로그인되도록 세션 발급 후 대시보드로
    const res = NextResponse.redirect(`${proto}://${profile.creator_name}.${baseDomain}/dashboard`)
    res.cookies.set('session', signSession(profile.creator_name, profile.token_version), {
      httpOnly: true,
      secure: proto === 'https',
      sameSite: 'lax',
      path: '/',
      domain: cookieDomain(req),
      maxAge: 60 * 60 * 24 * 30, // 30일
    })
    return res
  }

  // ── 신규 가입 ──
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

  try {
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
  } catch {
    // 동시 인증(링크 더블클릭 등)으로 이미 같은 이메일/핸들 계정이 만들어진 경우 — email/creator_name
    // @unique 제약이 중복 생성을 막는다(P2002). 사용자에겐 로그인 안내로 깔끔히 마무리.
    await prisma.emailVerification.delete({ where: { id: pending.id } }).catch(() => {})
    return loginRedirect('이미 가입이 완료된 계정입니다. 로그인해 주세요.')
  }
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
  res.cookies.set('session', signSession(handle, 0), {
    httpOnly: true,
    secure: proto === 'https',
    sameSite: 'lax',
    path: '/',
    domain: cookieDomain(req),
    maxAge: 60 * 60 * 24 * 30, // 30일
  })
  return res
}
