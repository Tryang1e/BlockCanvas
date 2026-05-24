'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

export async function submitContactMessage(
  creator_name: string,
  data: { name: string; email: string; message: string }
) {
  try {
    const profile = await prisma.profile.findUnique({
      where: { creator_name },
      select: { id: true }
    })

    if (!profile) {
      return { success: false, error: 'Creator not found' }
    }

    if (!data.name || !data.email || !data.message) {
      return { success: false, error: '모든 항목을 입력해주세요.' }
    }

    // 1. Cookie-based Rate Limiting (1 message per minute per browser)
    const cookieStore = await cookies()
    const lastSentTime = cookieStore.get('last_message_sent')?.value
    if (lastSentTime && Date.now() - parseInt(lastSentTime) < 60 * 1000) {
      return { success: false, error: '메시지를 너무 자주 보낼 수 없습니다. 잠시 후 다시 시도해주세요.' }
    }

    // 2. Database Email Rate Limiting (1 message per 5 minutes per email)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const recentMessage = await prisma.contactMessage.findFirst({
      where: {
        creator_id: profile.id,
        email: data.email,
        created_at: { gte: fiveMinutesAgo }
      }
    })

    if (recentMessage) {
      return { success: false, error: '해당 이메일로 방금 메시지를 보냈습니다. 5분 후에 다시 시도해주세요.' }
    }

    // 3. Max Unread Limit (Max 50 unread messages per creator)
    const unreadCount = await prisma.contactMessage.count({
      where: {
        creator_id: profile.id,
        is_read: false
      }
    })

    if (unreadCount >= 50) {
      return { success: false, error: '크리에이터의 메시지함이 가득 차서 더 이상 메시지를 받을 수 없습니다.' }
    }

    await prisma.contactMessage.create({
      data: {
        creator_id: profile.id,
        name: data.name,
        email: data.email,
        message: data.message
      }
    })

    // Set cookie for 1 minute to prevent rapid clicks
    cookieStore.set('last_message_sent', Date.now().toString(), { maxAge: 60 })

    return { success: true }
  } catch (error) {
    console.error('Failed to submit contact message:', error)
    return { success: false, error: '메시지 전송 중 오류가 발생했습니다.' }
  }
}

export async function getContactMessages(creator_name: string) {
  try {
    const profile = await prisma.profile.findUnique({
      where: { creator_name },
      select: { id: true }
    })

    if (!profile) return []

    const messages = await prisma.contactMessage.findMany({
      where: { creator_id: profile.id },
      orderBy: { created_at: 'desc' }
    })

    return messages
  } catch (error) {
    console.error('Failed to get contact messages:', error)
    return []
  }
}

export async function markMessageAsRead(messageId: string) {
  try {
    await prisma.contactMessage.update({
      where: { id: messageId },
      data: { is_read: true }
    })
    return { success: true }
  } catch (error) {
    console.error('Failed to mark message as read:', error)
    return { success: false }
  }
}
