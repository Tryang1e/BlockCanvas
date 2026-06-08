'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/server-auth'

export async function updateBannerAction(creatorName: string, bannerUrl: string | null) {
  // 세션이 본인(또는 관리자)인지 검증하고, 검증된 프로필 ID로만 수정한다.
  const authCreatorId = await requireAuth(creatorName)

  await prisma.portfolio.upsert({
    where: { creator_id: authCreatorId },
    update: { banner_url: bannerUrl },
    create: { creator_id: authCreatorId, banner_url: bannerUrl }
  })

  revalidatePath(`/sites/${creatorName}`)
  return { success: true }
}
