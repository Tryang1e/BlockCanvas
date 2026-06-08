'use server'

import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword } from '@/lib/hash'
import { deleteUserPhysicalFiles } from '@/lib/file-delete'
import { signSession, verifySession } from '@/lib/session'
import { generateTotpSecret, getOtpauthUrl, verifyTotpToken } from '@/lib/totp'
import { rateLimit } from '@/lib/rate-limit'

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

  let profile = await prisma.profile.findFirst({
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
    const tempToken = signSession(profile.creator_name + ':temp_2fa')
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

  let redirectUrl = `${protocol}://${profile.creator_name}.${baseDomain}/dashboard`
  if (profile.role === 'admin') {
    redirectUrl = '/adminpage'
  }
  
  return { success: true, redirectUrl }
}

export async function signup(formData: FormData) {
  // 회원가입은 기본 비활성화 상태입니다. (UI뿐 아니라 서버 액션 직접 호출도 차단)
  // 다시 열려면 환경변수 ENABLE_SIGNUP=true 를 설정하세요.
  if (process.env.ENABLE_SIGNUP !== 'true') {
    return { error: '현재 회원가입은 받고 있지 않습니다.' }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  // MOCK SIGNUP FOR LOCAL DEV
  try {
    const creator_name = (email.split('@')[0] + Math.floor(Math.random() * 1000)).toLowerCase()
    const hashedPassword = await hashPassword(password)
    const newUser = await prisma.profile.create({
      data: {
        email,
        password: hashedPassword,
        creator_name,
        display_name: email.split('@')[0],
      }
    })

    // Create default Portfolio
    await prisma.portfolio.create({
      data: {
        creator_id: newUser.id,
        headline: '나의 멋진 포트폴리오',
        about_text: '포트폴리오 소개글을 입력해주세요.',
      }
    })

    // Create default section
    await prisma.portfolioSection.create({
      data: {
        creator_id: newUser.id,
        name: 'Main Projects',
        sort_order: 0,
        is_visible: true
      }
    })
  } catch (err) {
    console.error('Signup Error:', err)
    return redirect(`/login?message=Signup failed`)
  }

  return redirect('/login?message=Success! You can now log in.')
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

  let redirectUrl = `${protocol}://${profile.creator_name}.${baseDomain}/dashboard`
  if (profile.role === 'admin') {
    redirectUrl = '/adminpage'
  }

  return { success: true, redirectUrl }
}
