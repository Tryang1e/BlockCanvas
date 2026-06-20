'use server'

import crypto from 'crypto'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword } from '@/lib/hash'
import { deleteUserPhysicalFiles } from '@/lib/file-delete'
import { signSession, verifySession } from '@/lib/session'
import { generateTotpSecret, getOtpauthUrl, verifyTotpToken } from '@/lib/totp'
import { rateLimit } from '@/lib/rate-limit'
import { sendEmail, verificationEmailHtml, passwordResetEmailHtml, findHandleEmailHtml } from '@/lib/email'
import { validatePassword } from '@/lib/password-policy'

/**
 * Get dynamic domain and protocol based on the current request host
 */
async function getDynamicConfig() {
  const host = (await headers()).get('host') || 'craftopia.work'
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1')
  const isDev = process.env.NODE_ENV !== 'production'
  
  const protoHeader = (await headers()).get('x-forwarded-proto')
  const protocol = protoHeader === 'https' ? 'https' : 'http'
  
  return {
    isLocal,
    protocol,
    baseDomain: isLocal ? 'localhost:3000' : 'craftopia.work',
    // 터널 개발 환경(craftopia.work)에서는 서브도메인 간 세션 공유를 위해 쿠키 도메인을 '.craftopia.work'로 설정하고, 순수 localhost인 경우에만 도메인을 생략합니다.
    cookieDomain: isLocal ? undefined : '.craftopia.work'
  }
}

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // 무차별 대입 방어: IP당 15분 내 10회 제한
  const _h = await headers()
  const _ip = (_h.get('cf-connecting-ip') || (_h.get('x-forwarded-for') || '').split(',')[0] || '').trim()
  if (!rateLimit('login:' + _ip, 10, 15 * 60 * 1000)) {
    return { error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' }
  }

  const profile = await prisma.profile.findFirst({
    where: { email }
  })

  if (!profile) {
    return { error: '이메일 또는 비밀번호가 일치하지 않습니다. 입력 내용을 다시 확인해 주세요.' }
  }

  // If the profile exists and has a password, verify it
  if (profile && profile.password) {
    const isMatch = await verifyPassword(password, profile.password)
    if (!isMatch) {
      return { error: '이메일 또는 비밀번호가 일치하지 않습니다. 입력 내용을 다시 확인해 주세요.' }
    }
  }

  // 만약 2차 인증(2FA)이 활성화되어 있는 경우, 로그인 성공 토큰 대신 5분 임시 인증 토큰 반환
  if (profile.two_factor_enabled) {
    // 2FA 챌린지용 임시 토큰은 5분만 유효하도록 짧은 TTL 적용.
    const tempToken = signSession(profile.creator_name + ':temp_2fa', 5 * 60 * 1000)
    return { requires2FA: true, tempToken }
  }

  const { protocol, baseDomain, cookieDomain } = await getDynamicConfig()
  const isDev = process.env.NODE_ENV !== 'production'

  const cookieStore = await cookies()
  const signedToken = signSession(profile.creator_name)
  cookieStore.set('session', signedToken, {
    httpOnly: true,
    secure: isDev ? false : (protocol === 'https'),
    sameSite: 'lax',
    path: '/',
    domain: cookieDomain,
    maxAge: 60 * 60 * 24 * 30 // 30 days
  })

  // 사용자(크리에이터) 핵심 액션 기록: 로그인. (로깅 실패가 로그인 자체를 막지 않도록 격리)
  try {
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: 'LOGIN', details: `로그인 (${profile.role || 'creator'})` }
    })
  } catch { /* 로그 기록 실패는 무시 */ }

  let redirectUrl = `${protocol}://${profile.creator_name}.${baseDomain}/dashboard`
  if (profile.role === 'admin') {
    redirectUrl = '/adminpage'
  }
  
  return { success: true, redirectUrl }
}

/**
 * 이메일/비밀번호 회원가입 — 이메일 인증 메일 발송까지.
 *  - 인증 전에는 Profile 을 만들지 않고 EmailVerification(대기열)에만 저장한다.
 *    (핸들 선점·미인증 계정 방지). 메일 링크 클릭 시 /api/auth/verify-email 이 Profile(role=user)을 생성.
 *  - 킬스위치: ENABLE_SIGNUP=false 면 비활성(기본은 활성).
 */
export async function signup(formData: FormData) {
  if (process.env.ENABLE_SIGNUP === 'false') {
    return { error: '현재 회원가입을 받고 있지 않습니다.' }
  }

  const email = ((formData.get('email') as string) || '').trim().toLowerCase()
  const password = (formData.get('password') as string) || ''
  const passwordConfirm = (formData.get('password_confirm') as string) || ''
  const nickname = ((formData.get('nickname') as string) || '').trim()
  const consent = formData.get('privacy_consent')

  // 무차별 가입 방어: IP당 15분 내 5회 제한
  const _h = await headers()
  const _ip = (_h.get('cf-connecting-ip') || (_h.get('x-forwarded-for') || '').split(',')[0] || '').trim()
  if (!rateLimit('signup:' + _ip, 5, 15 * 60 * 1000)) {
    return { error: '가입 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' }
  }

  // 입력 검증
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: '올바른 이메일 주소를 입력해 주세요.' }
  }
  if (!nickname || nickname.length < 2 || nickname.length > 20) {
    return { error: '닉네임을 2자 이상 20자 이하로 입력해 주세요.' }
  }
  const pwCheck = validatePassword(password)
  if (!pwCheck.ok) {
    return { error: pwCheck.error }
  }
  if (password !== passwordConfirm) {
    return { error: '비밀번호와 비밀번호 확인이 일치하지 않습니다.' }
  }
  if (!consent) {
    return { error: '개인정보 처리방침에 동의해 주세요.' }
  }

  // 이미 가입된 이메일이면 차단(로그인 안내)
  const existing = await prisma.profile.findFirst({ where: { email } })
  if (existing) {
    return { error: '이미 가입된 이메일입니다. 로그인해 주세요.' }
  }

  // 인증 토큰 + 비번 해시 → 대기열 upsert(동일 이메일 재시도 시 토큰 갱신)
  const token = crypto.randomBytes(32).toString('hex')
  const password_hash = await hashPassword(password)
  await prisma.emailVerification.upsert({
    where: { email },
    update: { token, password_hash, display_name: nickname, created_at: new Date() },
    create: { email, token, password_hash, display_name: nickname },
  })

  // 인증 메일 발송(링크는 메인 도메인 기준)
  const { protocol, baseDomain } = await getDynamicConfig()
  const verifyUrl = `${protocol}://${baseDomain}/api/auth/verify-email?token=${token}`
  const sent = await sendEmail(email, 'craftopia 이메일 인증', verificationEmailHtml(verifyUrl))
  if (!sent.ok) {
    // 메일을 못 보내면 대기열을 정리(미인증 잔여 방지)하고 오류 반환
    await prisma.emailVerification.deleteMany({ where: { email } }).catch(() => {})
    if (sent.error === 'not_configured') {
      return { error: '메일 발송이 아직 설정되지 않았습니다. 관리자에게 문의해 주세요.' }
    }
    console.error('Signup email send failed:', sent.error)
    return { error: '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  return {
    success: true,
    message: `${email} 로 인증 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료해 주세요.`,
  }
}

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000 // 1시간

/**
 * 비밀번호 찾기 — 재설정 링크 발송.
 * 계정 존재 여부를 노출하지 않기 위해(이메일 열거 방지) 항상 동일한 성공 메시지를 반환한다.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = ((formData.get('email') as string) || '').trim().toLowerCase()

  const _h = await headers()
  const _ip = (_h.get('cf-connecting-ip') || (_h.get('x-forwarded-for') || '').split(',')[0] || '').trim()
  if (!rateLimit('pwreset:' + _ip, 5, 15 * 60 * 1000)) {
    return { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }
  }

  const generic = {
    success: true,
    message: '입력하신 이메일이 가입되어 있다면 비밀번호 재설정 링크를 보냈습니다. 메일함을 확인해 주세요.',
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return generic

  const profile = await prisma.profile.findFirst({ where: { email } })
  if (!profile) return generic // 존재 여부 비공개

  const token = crypto.randomBytes(32).toString('hex')
  await prisma.passwordReset.upsert({
    where: { email },
    update: { token, created_at: new Date() },
    create: { email, token },
  })

  const { protocol, baseDomain } = await getDynamicConfig()
  const resetUrl = `${protocol}://${baseDomain}/reset-password?token=${token}`
  await sendEmail(email, 'craftopia 비밀번호 재설정', passwordResetEmailHtml(resetUrl)).catch(() => {})

  return generic
}

/**
 * 비밀번호 재설정 — 메일 링크의 토큰으로 새 비밀번호를 설정한다.
 */
export async function resetPassword(token: string, newPassword: string, confirm: string) {
  if (!token) return { error: '유효하지 않은 재설정 링크입니다.' }

  const pwCheck = validatePassword(newPassword || '')
  if (!pwCheck.ok) return { error: pwCheck.error }
  if (newPassword !== confirm) return { error: '비밀번호와 비밀번호 확인이 일치하지 않습니다.' }

  const reset = await prisma.passwordReset.findUnique({ where: { token } })
  if (!reset) return { error: '유효하지 않거나 이미 사용된 재설정 링크입니다.' }

  if (Date.now() - new Date(reset.created_at).getTime() > PASSWORD_RESET_TTL_MS) {
    await prisma.passwordReset.delete({ where: { id: reset.id } }).catch(() => {})
    return { error: '재설정 링크가 만료되었습니다. 다시 요청해 주세요.' }
  }

  const profile = await prisma.profile.findFirst({ where: { email: reset.email } })
  if (!profile) {
    await prisma.passwordReset.delete({ where: { id: reset.id } }).catch(() => {})
    return { error: '계정을 찾을 수 없습니다.' }
  }

  const hashed = await hashPassword(newPassword)
  await prisma.profile.update({ where: { id: profile.id }, data: { password: hashed } })
  await prisma.passwordReset.deleteMany({ where: { email: reset.email } }).catch(() => {})

  try {
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: 'PASSWORD_RESET', details: '비밀번호 찾기로 재설정' },
    })
  } catch { /* 로그 실패 무시 */ }

  return { success: true, message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.' }
}

/**
 * 아이디 찾기 — 가입 이메일로 핸들(@아이디)과 포트폴리오 주소를 안내한다.
 * 계정 존재 여부 비공개를 위해 항상 동일한 성공 메시지를 반환한다.
 */
export async function findMyHandle(formData: FormData) {
  const email = ((formData.get('email') as string) || '').trim().toLowerCase()

  const _h = await headers()
  const _ip = (_h.get('cf-connecting-ip') || (_h.get('x-forwarded-for') || '').split(',')[0] || '').trim()
  if (!rateLimit('findid:' + _ip, 5, 15 * 60 * 1000)) {
    return { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }
  }

  const generic = {
    success: true,
    message: '입력하신 이메일이 가입되어 있다면 아이디(핸들)와 주소를 메일로 보냈습니다. 메일함을 확인해 주세요.',
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return generic

  const profile = await prisma.profile.findFirst({ where: { email } })
  if (!profile) return generic // 존재 여부 비공개

  const { protocol, baseDomain } = await getDynamicConfig()
  const siteUrl = `${protocol}://${profile.creator_name}.${baseDomain}`
  await sendEmail(email, 'craftopia 아이디(핸들) 안내', findHandleEmailHtml(profile.creator_name, siteUrl)).catch(() => {})

  return generic
}

export async function changePasswordAction(creatorName: string, currentPass: string, newPass: string) {
  const { requireAuth } = await import('@/lib/server-auth')
  let authCreatorId: string
  try {
    authCreatorId = await requireAuth(creatorName)
  } catch (error) {
    return { error: 'Unauthorized Access' }
  }

  const profile = await prisma.profile.findUnique({
    where: { id: authCreatorId }
  })

  if (!profile) return { error: 'Profile not found' }
  
  // Verify current password using PBKDF2+Bcrypt
  if (profile.password) {
    const isMatch = await verifyPassword(currentPass, profile.password)
    if (!isMatch) {
      return { error: '현재 비밀번호가 일치하지 않습니다.' }
    }
  }

  // 새 비밀번호 정책(10자 이상 + 특수문자) 검증
  const pwCheck = validatePassword(newPass)
  if (!pwCheck.ok) {
    return { error: pwCheck.error }
  }

  const hashedNewPass = await hashPassword(newPass)

  await prisma.profile.update({
    where: { id: authCreatorId },
    data: { password: hashedNewPass }
  })

  return { success: true }
}

export async function deleteAccountAction(creatorName: string, password?: string, otpCode?: string) {
  const { requireAuth } = await import('@/lib/server-auth')
  let authCreatorId: string
  try {
    authCreatorId = await requireAuth(creatorName)
  } catch (error) {
    return { error: '권한이 없습니다. 다시 로그인해 주세요.' }
  }

  const profile = await prisma.profile.findUnique({
    where: { id: authCreatorId }
  })
  if (!profile) return { error: '크리에이터 프로필을 찾을 수 없습니다.' }

  // 1. 패스워드 재검증
  if (!password) {
    return { error: '비밀번호를 입력해 주세요.' }
  }
  if (profile.password) {
    const isMatch = await verifyPassword(password, profile.password)
    if (!isMatch) {
      return { error: '비밀번호가 올바르지 않습니다.' }
    }
  }

  // 2. 2FA 재검증 (활성화 시 필수)
  if (profile.two_factor_enabled && profile.two_factor_secret) {
    if (!otpCode) {
      return { error: '2FA 구글 OTP 인증 코드를 입력해 주세요.' }
    }
    const isValid = verifyTotpToken(otpCode, profile.two_factor_secret)
    if (!isValid) {
      return { error: '2FA 인증 코드가 일치하지 않습니다. 다시 입력해 주세요.' }
    }
  }

  // Delete physical files from local storage first (before DB records are gone)
  await deleteUserPhysicalFiles(authCreatorId)

  // Delete the profile (this cascades to projects, sections, etc. if cascade is set in schema)
  await prisma.profile.delete({
    where: { id: authCreatorId }
  })

  const { cookieDomain } = await getDynamicConfig()

  // Delete session cookie
  const cookieStore = await cookies()
  cookieStore.delete({
    name: 'session',
    domain: cookieDomain,
    path: '/'
  })

  return { success: true }
}

export async function logout() {
  const { cookieDomain } = await getDynamicConfig()

  const cookieStore = await cookies()
  cookieStore.delete({
    name: 'session',
    domain: cookieDomain,
    path: '/'
  })
  return redirect('/')
}

export async function resetUserPasswordByAdminAction(formData: FormData) {
  // 1. 어드민 세션 권한 검증
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = verifySession(sessionToken)
  if (!session) return { error: '로그인이 필요합니다.' }

  let isAdmin = false
  if (session === 'admin') {
    isAdmin = true
  } else {
    const adminProfile = await prisma.profile.findUnique({
      where: { creator_name: session }
    })
    if (adminProfile && adminProfile.role === 'admin') {
      isAdmin = true
    }
  }

  if (!isAdmin) return { error: '관리자 권한이 없습니다.' }

  // 2. 입력 데이터 파싱
  const targetEmail = formData.get('email') as string
  const newPassword = formData.get('newPassword') as string

  if (!targetEmail || !newPassword) {
    return { error: '이메일과 새 비밀번호를 모두 입력해 주세요.' }
  }

  // 3. 타겟 유저 존재 여부 검사
  const targetProfile = await prisma.profile.findFirst({
    where: { email: targetEmail }
  })

  if (!targetProfile) {
    return { error: '해당 이메일을 사용하는 크리에이터를 찾을 수 없습니다.' }
  }

  // 4. 비밀번호 암호화 후 업데이트 수행
  const hashedPassword = await hashPassword(newPassword)
  await prisma.profile.update({
    where: { id: targetProfile.id },
    data: { password: hashedPassword }
  })

  // 5. 어드민 오디트 로그(Audit Log) 적재
  try {
    await prisma.auditLog.create({
      data: {
        admin_name: session,
        action: 'PASSWORD_RESET',
        target_id: targetProfile.id,
        details: `Admin reset password for user: ${targetEmail}`
      }
    })
  } catch (logErr) {
    console.error('Audit log failed', logErr)
  }

  return { success: true, message: `성공적으로 ${targetEmail} 유저의 비밀번호를 초기화했습니다.` }
}

/**
 * 2FA 구글 OTP 연동 설정을 위한 Secret Key 및 QR용 URL을 생성합니다.
 */
export async function generate2faSetupAction(creatorName: string) {
  const { requireAuth } = await import('@/lib/server-auth')
  try {
    await requireAuth(creatorName)
  } catch (error) {
    return { error: '인증 권한이 없습니다.' }
  }

  const secret = generateTotpSecret()
  const otpauthUrl = getOtpauthUrl(creatorName, secret)
  return { secret, otpauthUrl }
}

/**
 * 구글 OTP 인증 코드가 정확한지 검증한 후, 최종적으로 2FA를 활성화 처리합니다.
 */
export async function enable2faAction(creatorName: string, code: string, secret: string) {
  const { requireAuth } = await import('@/lib/server-auth')
  let authCreatorId: string
  try {
    authCreatorId = await requireAuth(creatorName)
  } catch (error) {
    return { error: '인증 권한이 없습니다.' }
  }

  const isValid = verifyTotpToken(code, secret)
  if (!isValid) {
    return { error: '인증 코드가 일치하지 않습니다. Google Authenticator 화면의 최신 번호 6자리를 다시 확인하고 입력해 주세요.' }
  }

  await prisma.profile.update({
    where: { id: authCreatorId },
    data: {
      two_factor_secret: secret,
      two_factor_enabled: true
    }
  })

  return { success: true }
}

/**
 * 비밀번호 및 2FA OTP를 재확인하고 안전하게 2FA 기능을 차단/해제 처리합니다.
 */
export async function disable2faAction(creatorName: string, password?: string, code?: string) {
  const { requireAuth } = await import('@/lib/server-auth')
  let authCreatorId: string
  try {
    authCreatorId = await requireAuth(creatorName)
  } catch (error) {
    return { error: '인증 권한이 없습니다.' }
  }

  const profile = await prisma.profile.findUnique({
    where: { id: authCreatorId }
  })
  if (!profile) return { error: '크리에이터 프로필을 찾을 수 없습니다.' }

  // 1. 비밀번호 확인
  if (!password) {
    return { error: '비밀번호를 입력해 주세요.' }
  }
  if (profile.password) {
    const isMatch = await verifyPassword(password, profile.password)
    if (!isMatch) {
      return { error: '비밀번호가 올바르지 않습니다.' }
    }
  }

  // 2. OTP 코드 검증
  if (profile.two_factor_enabled && profile.two_factor_secret) {
    if (!code) {
      return { error: '2FA 구글 OTP 코드를 입력해 주세요.' }
    }
    const isValid = verifyTotpToken(code, profile.two_factor_secret)
    if (!isValid) {
      return { error: '2FA 인증 코드가 일치하지 않습니다.' }
    }
  }

  await prisma.profile.update({
    where: { id: authCreatorId },
    data: {
      two_factor_secret: null,
      two_factor_enabled: false
    }
  })

  return { success: true }
}

/**
 * 2FA가 활성화된 유저가 로그인 2차 관문에서 OTP를 최종 검증하고 쿠키 세션을 굽는 액션입니다.
 */
export async function verify2faLoginAction(tempToken: string, code: string) {
  if (!tempToken) {
    return { error: '임시 토큰이 누락되었습니다.' }
  }
  if (!code) {
    return { error: '인증 코드를 입력해 주세요.' }
  }

  // OTP 무차별 대입 방어: IP당 15분 내 10회 제한
  const _h = await headers()
  const _ip = (_h.get('cf-connecting-ip') || (_h.get('x-forwarded-for') || '').split(',')[0] || '').trim()
  if (!rateLimit('2fa:' + _ip, 10, 15 * 60 * 1000)) {
    return { error: '인증 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' }
  }

  const decrypted = verifySession(tempToken)
  if (!decrypted || !decrypted.endsWith(':temp_2fa')) {
    return { error: '만료되었거나 유효하지 않은 로그인 임시 세션입니다. 처음부터 다시 로그인해 주세요.' }
  }

  const creatorName = decrypted.replace(':temp_2fa', '')

  const profile = await prisma.profile.findUnique({
    where: { creator_name: creatorName }
  })
  if (!profile || !profile.two_factor_secret || !profile.two_factor_enabled) {
    return { error: '2FA 설정 정보를 찾을 수 없습니다.' }
  }

  const isDev = process.env.NODE_ENV !== 'production'
  const isValid = verifyTotpToken(code, profile.two_factor_secret)
  if (!isValid) {
    return { error: '인증 코드가 일치하지 않습니다. 다시 시도해 주세요.' }
  }

  // 대조 통과 성공! 정식 보안 세션 쿠키를 구워줍니다.
  const { protocol, baseDomain, cookieDomain } = await getDynamicConfig()

  const cookieStore = await cookies()
  const signedToken = signSession(profile.creator_name)
  cookieStore.set('session', signedToken, {
    httpOnly: true,
    secure: isDev ? false : (protocol === 'https'),
    sameSite: 'lax',
    path: '/',
    domain: cookieDomain,
    maxAge: 60 * 60 * 24 * 30 // 30 days
  })

  // 사용자(크리에이터) 핵심 액션 기록: 2FA 로그인.
  try {
    await prisma.creatorLog.create({
      data: { creator_name: profile.creator_name, action: 'LOGIN', details: `로그인 (2FA · ${profile.role || 'creator'})` }
    })
  } catch { /* 로그 기록 실패는 무시 */ }

  let redirectUrl = `${protocol}://${profile.creator_name}.${baseDomain}/dashboard`
  if (profile.role === 'admin') {
    redirectUrl = '/adminpage'
  }

  return { success: true, redirectUrl }
}
