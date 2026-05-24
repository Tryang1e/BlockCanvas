'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword } from '@/lib/hash'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  let profile = await prisma.profile.findFirst({
    where: { email }
  })

  if (!profile) {
    return redirect('/login?message=Authentication Failed. Check credentials.')
  }

  // If the profile exists and has a password, verify it
  if (profile && profile.password) {
    const isMatch = await verifyPassword(password, profile.password)
    if (!isMatch) {
      return redirect('/login?message=Authentication Failed. Incorrect password.')
    }
  }

  const cookieStore = await cookies()
  const sessionValue = profile.creator_name
  cookieStore.set('session', sessionValue, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30 // 30 days
  })

  if (profile.role === 'admin') {
    return redirect('/adminpage')
  }
  return redirect(`/creator/${sessionValue}/dashboard`)
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  // MOCK SIGNUP FOR LOCAL DEV
  try {
    const creator_name = email.split('@')[0] + Math.floor(Math.random() * 1000)
    const hashedPassword = await hashPassword(password)
    await prisma.profile.create({
      data: {
        email,
        password: hashedPassword,
        creator_name,
        display_name: email.split('@')[0],
      }
    })
  } catch (err) {
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

export async function deleteAccountAction(creatorName: string) {
  const { requireAuth } = await import('@/lib/server-auth')
  let authCreatorId: string
  try {
    authCreatorId = await requireAuth(creatorName)
  } catch (error) {
    throw new Error('Unauthorized Access')
  }

  // Delete the profile (this cascades to projects, sections, etc. if cascade is set in schema)
  await prisma.profile.delete({
    where: { id: authCreatorId }
  })

  // Delete session cookie
  const cookieStore = await cookies()
  cookieStore.delete('session')

  return redirect('/')
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  return redirect('/')
}

export async function resetUserPasswordByAdminAction(formData: FormData) {
  // 1. 어드민 세션 권한 검증
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
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
