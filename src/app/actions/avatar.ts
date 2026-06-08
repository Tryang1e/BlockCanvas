'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/server-auth'

export async function updateAvatarAction(creatorName: string, avatarUrl: string | null) {
  // 세션이 본인(또는 관리자)인지 검증하고, 검증된 프로필 ID로만 수정한다.
  const authCreatorId = await requireAuth(creatorName)

  await prisma.profile.update({
    where: { id: authCreatorId },
    data: { avatar_url: avatarUrl }
  })

  revalidatePath(`/sites/${creatorName}`)
  return { success: true }
}
