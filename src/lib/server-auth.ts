import { cookies } from 'next/headers'
import type { Profile } from '@prisma/client'
import { prisma } from './prisma'
import { verifySessionFull } from './session'
import { isSuperAdmin, isAdminPanelAccess } from './roles'

/**
 * 현재 세션의 Profile 을 반환한다(없거나 무효화된 세션이면 null).
 * 서명·만료(verifySessionFull) + DB token_version 대조까지 하므로, 비밀번호 변경/재설정으로
 * token_version 이 올라간 뒤의 구(舊) 세션 토큰은 null 을 반환한다(=무효화).
 * 대시보드/액션의 인증 헬퍼(getAuthenticatedProfile/authedProfile)들이 공유한다.
 */
export async function sessionProfile(): Promise<Profile | null> {
  const cookieStore = await cookies()
  const full = verifySessionFull(cookieStore.get('session')?.value)
  if (!full) return null
  const profile = await prisma.profile.findUnique({ where: { creator_name: full.name } })
  if (!profile || profile.token_version !== full.version) return null
  return profile
}

/**
 * 읽기 액션의 "조회 대상" 프로필을 해석한다(어드민의 유저 건축 대시보드 읽기 전용 조회용).
 *
 * - viewAs 없음(또는 본인) → 세션 본인 프로필, readOnly=false (기존 동작 그대로).
 * - viewAs 가 타인 → 세션 유저가 어드민/매니저(isAdminPanelAccess)일 때만 허용하고
 *   대상 유저 프로필을 readOnly=true 로 반환. 권한 없으면 throw(무단접근).
 *
 * 주의: 이 헬퍼는 "읽기"에만 쓴다. 변경 액션은 세션 본인 기준(getAuthenticatedProfile)을 유지해
 * 어드민이 대상 유저의 데이터를 대신 수정하지 못하게 한다(읽기 전용 보장).
 */
export async function resolveViewProfile(
  viewAs?: string | null
): Promise<{ profile: Profile; readOnly: boolean }> {
  const me = await sessionProfile()
  if (!me) throw new Error('Unauthorized: Please log in first.')

  const target = viewAs?.trim().toLowerCase()
  if (!target || target === me.creator_name.toLowerCase()) {
    return { profile: me, readOnly: false }
  }

  if (!isAdminPanelAccess(me.role)) {
    throw new Error('Unauthorized Access')
  }
  const targetProfile = await prisma.profile.findUnique({ where: { creator_name: target } })
  if (!targetProfile) throw new Error('Profile not found')
  return { profile: targetProfile, readOnly: true }
}

/**
 * 세션이 요청한 creatorName 과 일치(또는 관리자)하는지 확인한다. 무단접근 시 throw.
 * 안전한 DB 질의용 Profile ID 를 반환한다.
 *
 * 세션 사용자(호출자)의 현재 token_version 과 토큰의 버전을 대조해, 비밀번호 변경/재설정으로
 * 무효화된 구 세션은 거부한다.
 */
export async function requireAuth(creatorName: string): Promise<string> {
  const cookieStore = await cookies()
  const full = verifySessionFull(cookieStore.get('session')?.value)
  if (!full) {
    throw new Error('Unauthorized Access')
  }
  const session = full.name
  const creatorNameLower = creatorName.toLowerCase()

  // 세션 사용자(호출자) 프로필 로드 + token_version 대조(무효화 세션 거부). 세션은 항상 실제 Profile 로 발급된다.
  const sessionProfileRow = await prisma.profile.findUnique({
    where: { creator_name: session },
    select: { role: true, token_version: true },
  })
  if (!sessionProfileRow || sessionProfileRow.token_version !== full.version) {
    throw new Error('Unauthorized Access')
  }

  // 셀프서비스 write 액션의 소유권 게이트. 어드민 바이패스는 최종관리자(admin)로만 제한한다 —
  // 예전엔 isAdminRole(=admin|manager) 이라 매니저가 타인의 프로필/포트폴리오/서브도메인을 수정할 수 있었다
  // (resolveViewProfile 의 "관리자=읽기전용" 계약과 모순). manager 는 여기서 타인 데이터를 쓸 수 없다.
  const isAuthorized =
    session === creatorNameLower ||
    session === 'admin' ||
    isSuperAdmin(sessionProfileRow.role)
  if (!isAuthorized) {
    throw new Error('Unauthorized Access')
  }

  const profile = await prisma.profile.findUnique({
    where: { creator_name: creatorNameLower },
    select: { id: true },
  })
  if (!profile) {
    throw new Error('Profile not found')
  }

  return profile.id
}
