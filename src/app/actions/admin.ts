'use server'

import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { hashPassword } from '@/lib/hash'

async function requireAdmin() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  
  if (session === 'admin') return 'admin'

  if (session) {
    const profile = await prisma.profile.findUnique({
      where: { creator_name: session }
    })
    if (profile && profile.role?.toLowerCase() === 'admin') return profile.creator_name
  }
  
  throw new Error('권한이 없습니다: 관리자만 접근 가능합니다.')
}

export async function deleteUserAction(id: string) {
  try {
    const admin = await requireAdmin()
    const user = await prisma.profile.findUnique({ where: { id } })
    await prisma.profile.delete({
      where: { id }
    })
    
    if (user && admin) {
      await prisma.auditLog.create({
        data: { admin_name: admin, action: 'DELETE_USER', target_id: id, details: `Deleted user: ${user.creator_name}` }
      })
    }
    
    revalidatePath('/adminpage')
    return { success: true }
  } catch (err: any) {
    console.error('Admin Action Error:', err)
    return { error: '서버 처리 중 문제가 발생했습니다.' }
  }
}

export async function updateUserRoleAction(id: string, role: string) {
  try {
    const admin = await requireAdmin()
    const user = await prisma.profile.update({
      where: { id },
      data: { role }
    })
    
    if (admin) {
      await prisma.auditLog.create({
        data: { admin_name: admin, action: 'UPDATE_ROLE', target_id: id, details: `Changed ${user.creator_name}'s role to ${role}` }
      })
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
    const admin = await requireAdmin()
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
    const admin = await requireAdmin()
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
    await requireAdmin()
    
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
    const admin = await requireAdmin()
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
    const admin = await requireAdmin()
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
    const admin = await requireAdmin()
    
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const creatorName = formData.get('creator_name') as string
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
    const admin = await requireAdmin()
    
    // 대상 사용자가 존재하는지 확인
    const targetUser = await prisma.profile.findUnique({
      where: { creator_name: creatorName }
    })
    
    if (!targetUser) {
      return { error: '대상 크리에이터를 찾을 수 없습니다.' }
    }
    
    // 쿠키를 해당 크리에이터로 변경하여 강제 세션 가로채기 대리 로그인 가동!
    const cookieStore = await cookies()
    cookieStore.set('session', creatorName, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIE === 'true',
      sameSite: 'lax',
      path: '/',
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
