'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function updateAvatarAction(creatorName: string, avatarUrl: string | null) {
  const profile = await prisma.profile.findUnique({
    where: { creator_name: creatorName },
    select: { id: true }
  })

  if (!profile) throw new Error('프로필을 찾을 수 없습니다.')

  await prisma.profile.update({
    where: { id: profile.id },
    data: { avatar_url: avatarUrl }
  })

  revalidatePath(`/creator/${creatorName}`)
  return { success: true }
}
