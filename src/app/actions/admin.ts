'use server'

import { prisma } from '@/lib/prisma'
import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { hashPassword } from '@/lib/hash'
import { deleteUserPhysicalFiles } from '@/lib/file-delete'
import { signSession } from '@/lib/session'
import { roleToLpGroup, isAdminPanelAccess } from '@/lib/roles'
import { setMinecraftLuckPermsGroup } from '@/lib/minecraft'
import { requireStaff, requireSuperAdmin, currentAdminIdentity, assertCanActOn } from '@/lib/admin-auth'

async function getDynamicConfig() {
  const host = (await headers()).get('host') || 'craftopia.work'
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1')
  const isDev = process.env.NODE_ENV !== 'production'
  
  const protoHeader = (await headers()).get('x-forwarded-proto')
  const protocol = protoHeader === 'https' ? 'https' : 'http'
  
  return {
    isLocal,
    isDev,
    protocol,
    baseDomain: isLocal ? 'localhost:3000' : 'craftopia.work',
    // 터널 개발 환경(craftopia.work)에서는 서브도메인 간 세션 공유를 위해 쿠키 도메인을 '.craftopia.work'로 설정하고, 순수 localhost인 경우에만 도메인을 생략합니다.
    cookieDomain: isLocal ? undefined : '.craftopia.work'
  }
}

export async function deleteUserAction(id: string) {
  try {
    const admin = await requireSuperAdmin()
    const user = await prisma.profile.findUnique({ where: { id } })
    if (!user) return { error: '대상 회원을 찾을 수 없습니다.' }

    if (user.creator_name === 'admin') return { error: '슈퍼 관리자 계정은 삭제할 수 없습니다.' }

    // 1. Delete physical files from local storage first (before DB records are gone)
    await deleteUserPhysicalFiles(id)

    // 2. Cascade delete from DB
    await prisma.profile.delete({
      where: { id }
    })

    await prisma.auditLog.create({
      data: { admin_name: admin, action: 'DELETE_USER', target_id: id, details: `Deleted user: ${user.creator_name}` }
    })

    revalidatePath('/adminpage')
    return { success: true }
  } catch (err: any) {
    console.error('Admin Action Error:', err)
    return { error: err?.message || '서버 처리 중 문제가 발생했습니다.' }
  }
}

const ASSIGNABLE_ROLES = ['user', 'creator', 'official', 'manager', 'admin']

export async function updateUserRoleAction(id: string, role: string) {
  try {
    const admin = await requireSuperAdmin()
    // 역할 화이트리스트 검증 — 임의 문자열이 Profile.role 에 저장돼 롤 랭크/권한 판정이 깨지는 것을 막는다.
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return { error: '알 수 없는 역할입니다.' }
    }
    // 슈퍼 관리자 계정의 역할은 변경 불가(자기 강등/타 계정 admin 남발 방지의 최소 방어).
    const existing = await prisma.profile.findUnique({ where: { id }, select: { creator_name: true } })
    if (!existing) return { error: '대상 회원을 찾을 수 없습니다.' }
    if (existing.creator_name === 'admin') return { error: '슈퍼 관리자 계정의 역할은 변경할 수 없습니다.' }
    const user = await prisma.profile.update({
      where: { id },
      data: { role }
    })
    
    if (admin) {
      await prisma.auditLog.create({
        data: { admin_name: admin, action: 'UPDATE_ROLE', target_id: id, details: `Changed ${user.creator_name}'s role to ${role}` }
      })
    }

    // 웹 → 인게임: 연동된 계정이면 LuckPerms 그룹도 맞춰 변경(베스트에포트)
    if (user.minecraft_uuid) {
      const group = roleToLpGroup(role)
      if (group) {
        await setMinecraftLuckPermsGroup(user.minecraft_uuid, group).catch((e) =>
          console.warn('web→ingame role sync failed:', e instanceof Error ? e.message : String(e))
        )
      }
    }

    revalidatePath('/adminpage')
    return { success: true }
  } catch (err: any) {
    console.error('Admin Action Error:', err)
    return { error: '서버 처리 중 문제가 발생했습니다.' }
  }
}

export async function deleteProjectAdminAction(id: string) {
  try {
    const admin = await requireStaff()
    const project = await prisma.project.findUnique({ where: { id } })
    await prisma.project.delete({
      where: { id }
    })
    
    if (project && admin) {
      await prisma.auditLog.create({
        data: { admin_name: admin, action: 'DELETE_PROJECT', target_id: id, details: `Deleted project: ${project.title}` }
      })
    }
    
    revalidatePath('/adminpage/projects')
    return { success: true }
  } catch (err: any) {
    console.error('Admin Action Error:', err)
    return { error: '서버 처리 중 문제가 발생했습니다.' }
  }
}

export async function toggleProjectPublishAdminAction(id: string, is_published: boolean) {
  try {
    const admin = await requireStaff()
    const project = await prisma.project.update({
      where: { id },
      data: { is_published }
    })
    
    if (admin) {
      await prisma.auditLog.create({
        data: { admin_name: admin, action: 'TOGGLE_PUBLISH', target_id: id, details: `${is_published ? 'Published' : 'Hid'} project: ${project.title}` }
      })
    }
    
    revalidatePath('/adminpage/projects')
    return { success: true }
  } catch (err: any) {
    console.error('Admin Action Error:', err)
    return { error: '서버 처리 중 문제가 발생했습니다.' }
  }
}

export async function updateSiteSettingsAction(settings: { key: string, value: string }[]) {
  try {
    await requireSuperAdmin()
    
    // We will upsert each setting
    for (const setting of settings) {
      await prisma.siteSetting.upsert({
        where: { key: setting.key },
        update: { value: setting.value },
        create: { key: setting.key, value: setting.value }
      })
    }
    
    revalidatePath('/adminpage/settings')
    revalidatePath('/') // Revalidate homepage to apply banner/maintenance mode changes
    return { success: true }
  } catch (err: any) {
    console.error('Admin Action Error:', err)
    return { error: '서버 처리 중 문제가 발생했습니다.' }
  }
}

export async function createCategoryAction(name: string, slug: string) {
  try {
    const admin = await requireSuperAdmin()
    const category = await prisma.category.create({
      data: { name, slug }
    })
    
    if (admin) {
      await prisma.auditLog.create({
        data: { admin_name: admin, action: 'CREATE_CATEGORY', target_id: category.id, details: `Created category: ${name} (${slug})` }
      })
    }
    
    revalidatePath('/adminpage/categories')
    return { success: true }
  } catch (err: any) {
    if (err.code === 'P2002') return { error: '이미 존재하는 카테고리 이름이거나 슬러그입니다.' }
    console.error('Admin Action Error:', err)
    return { error: '서버 처리 중 문제가 발생했습니다.' }
  }
}

export async function deleteCategoryAction(id: string) {
  try {
    const admin = await requireSuperAdmin()
    const category = await prisma.category.findUnique({ where: { id } })
    await prisma.category.delete({
      where: { id }
    })
    
    if (category && admin) {
      await prisma.auditLog.create({
        data: { admin_name: admin, action: 'DELETE_CATEGORY', target_id: id, details: `Deleted category: ${category.name}` }
      })
    }
    
    revalidatePath('/adminpage/categories')
    return { success: true }
  } catch (err: any) {
    console.error('Admin Action Error:', err)
    return { error: '서버 처리 중 문제가 발생했습니다.' }
  }
}

export async function createUserAdminAction(formData: FormData) {
  try {
    const admin = await requireSuperAdmin()
    
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const creatorName = (formData.get('creator_name') as string).toLowerCase()
    const displayName = formData.get('display_name') as string
    const role = (formData.get('role') as string) || 'creator'

    if (!email || !password || !creatorName) {
      return { error: '이메일, 비밀번호, 닉네임(ID)은 필수입니다.' }
    }

    // Check if user already exists
    const existing = await prisma.profile.findFirst({
      where: {
        OR: [
          { email },
          { creator_name: creatorName }
        ]
      }
    })

    if (existing) {
      return { error: '이미 존재하는 이메일이거나 닉네임(ID)입니다.' }
    }

    const hashedPassword = await hashPassword(password)

    const newUser = await prisma.profile.create({
      data: {
        email,
        password: hashedPassword,
        creator_name: creatorName,
        display_name: displayName || creatorName,
        role
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

    if (admin) {
      await prisma.auditLog.create({
        data: { 
          admin_name: admin, 
          action: 'CREATE_USER', 
          target_id: newUser.id, 
          details: `Created user: ${newUser.creator_name} (${role})` 
        }
      })
    }
    
    revalidatePath('/adminpage')
    return { success: true }
  } catch (err: any) {
    console.error('Admin Action Error:', err)
    return { error: '서버 처리 중 문제가 발생했습니다.' }
  }
}

export async function impersonateUserAction(creatorName: string) {
  try {
    const admin = await requireStaff()

    // 대상 사용자가 존재하는지 확인
    const targetUser = await prisma.profile.findUnique({
      where: { creator_name: creatorName }
    })

    if (!targetUser) {
      return { error: '대상 크리에이터를 찾을 수 없습니다.' }
    }

    // 권한 상승 방지: 스태프(manager)는 관리자/스태프 계정으로 대행 로그인할 수 없다(최종관리자만 가능).
    const actor = await currentAdminIdentity()
    if (isAdminPanelAccess(targetUser.role) && actor?.role?.toLowerCase() !== 'admin') {
      return { error: '권한이 없습니다: 관리자/스태프 계정으로는 대행 로그인할 수 없습니다.' }
    }

    // 쿠키를 해당 크리에이터로 변경하여 강제 세션 가로채기 대리 로그인 가동!
    const { protocol, cookieDomain, isDev } = await getDynamicConfig()
    const cookieStore = await cookies()
    const signedToken = signSession(creatorName, targetUser.token_version)
    cookieStore.set('session', signedToken, { 
      httpOnly: true, 
      secure: isDev ? false : (protocol === 'https'),
      sameSite: 'lax',
      path: '/',
      domain: cookieDomain,
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    if (admin) {
      await prisma.auditLog.create({
        data: { 
          admin_name: admin, 
          action: 'IMPERSONATE_USER', 
          target_id: targetUser.id, 
          details: `Admin ${admin} impersonated user: ${creatorName}` 
        }
      })
    }

    return { success: true }
  } catch (err: any) {
    console.error('Impersonation Error:', err)
    return { error: err.message || '서버 처리 중 문제가 발생했습니다.' }
  }
}

export async function resetUser2FAAction(id: string) {
  try {
    const admin = await requireStaff()
    const user = await prisma.profile.findUnique({ where: { id } })
    if (!user) {
      return { error: '해당 사용자를 찾을 수 없습니다.' }
    }
    // 🔒 대상 보호(C-3): 스태프(manager)가 상위/동급 관리자의 2FA 를 해제해 계정을 탈취하지 못하게 한다.
    await assertCanActOn(user)

    await prisma.profile.update({
      where: { id },
      data: {
        two_factor_secret: null,
        two_factor_enabled: false
      }
    })
    
    if (admin) {
      await prisma.auditLog.create({
        data: { 
          admin_name: admin, 
          action: 'RESET_2FA', 
          target_id: id, 
          details: `Reset 2FA security for user: ${user.creator_name}` 
        }
      })
    }
    
    revalidatePath('/adminpage')
    return { success: true }
  } catch (err: any) {
    console.error('Admin Action Error:', err)
    return { error: err.message || '서버 처리 중 문제가 발생했습니다.' }
  }
}

