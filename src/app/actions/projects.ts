'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/server-auth'

export async function deleteProjectAction(projectId: string, creatorName: string) {
  const authCreatorId = await requireAuth(creatorName)
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    await prisma.project.deleteMany({
      where: { id: projectId, creator_id: authCreatorId }
    })
    
    if (project) {
      await prisma.creatorLog.create({
        data: {
          creator_name: creatorName,
          action: 'DELETE_PROJECT',
          target_id: projectId,
          details: `Deleted project: ${project.title}`
        }
      })
    }
  } catch (error) {
    console.error('Delete Error:', error)
    throw new Error('프로젝트 삭제에 실패했습니다.')
  }

  revalidatePath(`/creator/${creatorName}`)
  return { success: true }
}

export async function updateProjectOrderAction(
  updates: { id: string; section_id: string | null; sort_order: number }[],
  creatorName: string
) {
  const authCreatorId = await requireAuth(creatorName)

  const promises = updates.map(update => 
    prisma.project.updateMany({
      where: { id: update.id, creator_id: authCreatorId },
      data: {
        section_id: update.section_id,
        sort_order: update.sort_order
      }
    })
  )

  try {
    await Promise.all(promises)
  } catch (error) {
    console.error('Update Project Order Error:', error)
    throw new Error('프로젝트 순서 업데이트에 실패했습니다.')
  }

  revalidatePath(`/creator/${creatorName}`)
  return { success: true }
}

export async function createSimpleVideoProjectAction(
  creatorId: string, 
  title: string, 
  youtubeUrl: string, 
  sectionId: string, 
  creatorName: string
) {
  const authCreatorId = await requireAuth(creatorName)
  if (authCreatorId !== creatorId) throw new Error('Unauthorized creator mismatch')

  const maxOrderProject = await prisma.project.findFirst({
    where: { section_id: sectionId, creator_id: authCreatorId },
    orderBy: { sort_order: 'desc' },
    select: { sort_order: true }
  })

  const newOrder = maxOrderProject ? maxOrderProject.sort_order + 1 : 0

  try {
    const newProject = await prisma.project.create({
      data: {
        creator_id: creatorId,
        title,
        youtube_url: youtubeUrl,
        section_id: sectionId,
        sort_order: newOrder,
        category_id: "1", // default
        is_published: true,
        thumbnail_url: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&q=80&w=1000" // generic video thumbnail
      }
    })

    await prisma.creatorLog.create({
      data: {
        creator_name: creatorName,
        action: 'CREATE_VIDEO_PROJECT',
        target_id: newProject.id,
        details: `Created video project: ${newProject.title}`
      }
    })

    revalidatePath(`/creator/${creatorName}`)
    return { success: true, project: newProject }
  } catch (error) {
    console.error('Create Video Project Error:', error)
    throw new Error('비디오 프로젝트 생성에 실패했습니다.')
  }
}
