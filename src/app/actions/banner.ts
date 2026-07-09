'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/server-auth'

export async function updateBannerAction(creatorName: string, bannerUrl: string | null) {
  // 세션이 본인(또는 관리자)인지 검증하고, 검증된 프로필 ID로만 수정한다.
  const authCreatorId = await requireAuth(creatorName)

  // 교체/제거 전 기존 배너 URL을 확보(잉여 파일 정리용)
  const existing = await prisma.portfolio.findUnique({
    where: { creator_id: authCreatorId },
    select: { banner_url: true }
  })

  await prisma.portfolio.upsert({
    where: { creator_id: authCreatorId },
    update: { banner_url: bannerUrl },
    create: { creator_id: authCreatorId, banner_url: bannerUrl }
  })

  // 이전 배너가 새 URL과 다르면(교체 또는 제거) 디스크 잉여 파일 삭제(로컬 업로드만, 기본 이미지는 자동 보호)
  const oldUrl = existing?.banner_url
  if (oldUrl && oldUrl !== bannerUrl) {
    const { deleteUploadUrls } = await import('@/lib/file-delete')
    await deleteUploadUrls([oldUrl])
  }

  revalidatePath(`/sites/${creatorName}`)
  return { success: true }
}
