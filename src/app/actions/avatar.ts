'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/server-auth'

export async function updateAvatarAction(creatorName: string, avatarUrl: string | null) {
  // 세션이 본인(또는 관리자)인지 검증하고, 검증된 프로필 ID로만 수정한다.
  const authCreatorId = await requireAuth(creatorName)

  // 교체 전 기존 아바타 URL을 확보(잉여 파일 정리용)
  const existing = await prisma.profile.findUnique({
    where: { id: authCreatorId },
    select: { avatar_url: true }
  })

  await prisma.profile.update({
    where: { id: authCreatorId },
    data: { avatar_url: avatarUrl }
  })

  // 이전 아바타가 새 URL과 다르면 디스크 잉여 파일 삭제(로컬 업로드만, 기본 이미지는 자동 보호)
  const oldUrl = existing?.avatar_url
  if (oldUrl && oldUrl !== avatarUrl) {
    const { deleteUploadUrls } = await import('@/lib/file-delete')
    await deleteUploadUrls([oldUrl])
  }

  revalidatePath(`/sites/${creatorName}`)
  return { success: true }
}
