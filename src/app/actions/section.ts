'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/server-auth'

export async function createSectionAction(creatorId: string, name: string, sectionType: string = 'image_grid', content: string = '', creatorName: string) {
  const authCreatorId = await requireAuth(creatorName)
  if (authCreatorId !== creatorId) throw new Error('Unauthorized creator mismatch')

  const maxOrderSection = await prisma.portfolioSection.findFirst({
    where: { creator_id: creatorId },
    orderBy: { sort_order: 'desc' },
    select: { sort_order: true }
  })

  const newOrder = maxOrderSection ? maxOrderSection.sort_order + 1 : 0

  const newSection = await prisma.portfolioSection.create({
    data: {
      creator_id: creatorId,
      name,
      section_type: sectionType,
      content,
      sort_order: newOrder
    }
  })

  revalidatePath(`/creator/${creatorName}`)
  return { success: true, section: newSection }
}

export async function updateSectionOrderAction(sectionIds: string[], creatorName: string) {
  const authCreatorId = await requireAuth(creatorName)

  const promises = sectionIds.map((id, index) => 
    prisma.portfolioSection.updateMany({
      where: { id, creator_id: authCreatorId },
      data: { sort_order: index }
    })
  )

  await Promise.all(promises)

  revalidatePath(`/creator/${creatorName}`)
  return { success: true }
}

export async function updateSectionTitleVisibilityAction(sectionId: string, showTitle: boolean, creatorName: string) {
  const authCreatorId = await requireAuth(creatorName)
  try {
    await prisma.portfolioSection.updateMany({
      where: { id: sectionId, creator_id: authCreatorId },
      data: { show_title: showTitle }
    })
  } catch (error) {
    console.error('Update Section Title Visibility Error:', error)
    return { success: false }
  }

  revalidatePath(`/creator/${creatorName}`)
  return { success: true }
}

export async function updateSectionVisibilityAction(sectionId: string, is_visible: boolean, creatorName: string) {
  const authCreatorId = await requireAuth(creatorName)
  try {
    await prisma.portfolioSection.updateMany({
      where: { id: sectionId, creator_id: authCreatorId },
      data: { is_visible }
    })
  } catch (error) {
    console.error('Update Section Visibility Error:', error)
    return { success: false }
  }

  revalidatePath(`/creator/${creatorName}`)
  return { success: true }
}

export async function deleteSectionAction(sectionId: string, creatorName: string) {
  const authCreatorId = await requireAuth(creatorName)
  // deleteMany to enforce creator_id ownership
  await prisma.portfolioSection.deleteMany({
    where: { id: sectionId, creator_id: authCreatorId }
  })

  revalidatePath(`/creator/${creatorName}`)
  return { success: true }
}

export async function updateSectionNameAction(sectionId: string, name: string, creatorName: string) {
  const authCreatorId = await requireAuth(creatorName)
  await prisma.portfolioSection.updateMany({
    where: { id: sectionId, creator_id: authCreatorId },
    data: { name }
  })

  revalidatePath(`/creator/${creatorName}`)
  return { success: true }
}

export async function updateSectionContentAction(sectionId: string, content: string, creatorName: string) {
  const authCreatorId = await requireAuth(creatorName)
  await prisma.portfolioSection.updateMany({
    where: { id: sectionId, creator_id: authCreatorId },
    data: { content }
  })

  revalidatePath(`/creator/${creatorName}`)
  return { success: true }
}

export async function updateSectionAnimationAction(sectionId: string, animation_type: string, creatorName: string) {
  const authCreatorId = await requireAuth(creatorName)
  await prisma.portfolioSection.updateMany({
    where: { id: sectionId, creator_id: authCreatorId },
    data: { animation_type }
  })

  revalidatePath(`/creator/${creatorName}`)
  return { success: true }
}
