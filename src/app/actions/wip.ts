'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/server-auth'

/**
 * 새로운 WIP 작업 로그 생성
 */
export async function createWipLogAction(
  creatorName: string,
  title: string,
  description?: string,
  mediaUrl?: string,
  projectId?: string,
  customDate?: string
) {
  const authCreatorId = await requireAuth(creatorName)

  if (!title || title.trim() === '') {
    throw new Error('제목은 필수 입력 항목입니다.')
  }

  const newLog = await prisma.wipLog.create({
    data: {
      creator_id: authCreatorId,
      title: title.trim(),
      description: description ? description.trim() : null,
      media_url: mediaUrl || null,
      project_id: projectId || null,
      created_at: customDate ? new Date(customDate) : undefined,
    },
    include: {
      project: true
    }
  })

  revalidatePath(`/creator/${creatorName}`)
  return newLog
}

/**
 * 기존 WIP 작업 로그 삭제
 */
export async function deleteWipLogAction(creatorName: string, logId: string) {
  const authCreatorId = await requireAuth(creatorName)

  // 소유권 검증
  const log = await prisma.wipLog.findUnique({
    where: { id: logId }
  })

  if (!log) {
    throw new Error('로그를 찾을 수 없습니다.')
  }

  if (log.creator_id !== authCreatorId) {
    throw new Error('권한이 없습니다.')
  }

  await prisma.wipLog.delete({
    where: { id: logId }
  })

  revalidatePath(`/creator/${creatorName}`)
  return { success: true }
}

/**
 * 기존 WIP 작업 로그 수정 (날짜, 서체 테마 포함)
 */
export async function updateWipLogAction(
  creatorName: string,
  logId: string,
  title: string,
  description?: string,
  mediaUrl?: string,
  projectId?: string,
  customDate?: string
) {
  const authCreatorId = await requireAuth(creatorName)

  // 소유권 검증
  const log = await prisma.wipLog.findUnique({
    where: { id: logId }
  })

  if (!log) {
    throw new Error('로그를 찾을 수 없습니다.')
  }

  if (log.creator_id !== authCreatorId) {
    throw new Error('권한이 없습니다.')
  }

  if (!title || title.trim() === '') {
    throw new Error('제목은 필수 입력 항목입니다.')
  }

  const updatedLog = await prisma.wipLog.update({
    where: { id: logId },
    data: {
      title: title.trim(),
      description: description ? description.trim() : null,
      media_url: mediaUrl || null,
      project_id: projectId || null,
      created_at: customDate ? new Date(customDate) : undefined,
    },
    include: {
      project: true
    }
  })

  revalidatePath(`/creator/${creatorName}`)
  return updatedLog
}
