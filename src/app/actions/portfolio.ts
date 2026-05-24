'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/server-auth'

export async function createPortfolioAction(creatorName: string) {
  const authCreatorId = await requireAuth(creatorName)

  await prisma.portfolio.create({
    data: {
      creator_id: authCreatorId,
      headline: '나의 멋진 포트폴리오',
      about_text: '포트폴리오 소개글을 입력해주세요.',
    }
  })

  // Create default section
  await prisma.portfolioSection.create({
    data: {
      creator_id: authCreatorId,
      name: 'Main Projects',
      sort_order: 0,
      is_visible: true
    }
  })

  revalidatePath(`/creator/${creatorName}/dashboard`)
  revalidatePath(`/creator/${creatorName}/dashboard/portfolio`)
  return { success: true }
}

export async function deletePortfolioAction(creatorName: string) {
  const authCreatorId = await requireAuth(creatorName)

  await prisma.portfolio.deleteMany({
    where: { creator_id: authCreatorId }
  })

  revalidatePath(`/creator/${creatorName}/dashboard`)
  revalidatePath(`/creator/${creatorName}/dashboard/portfolio`)
  return { success: true }
}

export async function togglePortfolioPublishAction(creatorName: string, is_published: boolean) {
  const authCreatorId = await requireAuth(creatorName)

  await prisma.portfolio.updateMany({
    where: { creator_id: authCreatorId },
    data: { is_published }
  })

  revalidatePath(`/creator/${creatorName}`)
  revalidatePath(`/creator/${creatorName}/dashboard`)
  return { success: true }
}
