'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { verifySession } from '@/lib/session'

// ───── 입력 검증 & 남용 방지 헬퍼 (#19) ─────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function cleanContactInput(data: { name: string; email: string; message: string }):
  { error: string } | { name: string; email: string; message: string } {
  const name = (data?.name || '').trim()
  const email = (data?.email || '').trim()
  const message = (data?.message || '').trim()
  if (!name || !email || !message) return { error: '모든 항목을 입력해주세요.' }
  if (name.length > 100) return { error: '이름은 100자 이하로 입력해주세요.' }
  if (email.length > 254 || !EMAIL_RE.test(email)) return { error: '올바른 이메일 주소를 입력해주세요.' }
  if (message.length > 5000) return { error: '메시지는 5000자 이내로 입력해주세요.' }
  return { name, email, message }
}

// 프로세스 단위 인메모리 IP 레이트리밋 (받은편지함 도배 완화)
const ipHits = new Map<string, number[]>()
function checkIpRateLimit(ip: string, maxCount: number, windowMs: number): boolean {
  if (!ip) return true
  const now = Date.now()
  const arr = (ipHits.get(ip) || []).filter((t) => now - t < windowMs)
  if (arr.length >= maxCount) {
    ipHits.set(ip, arr)
    return false
  }
  arr.push(now)
  ipHits.set(ip, arr)
  if (ipHits.size > 5000) {
    for (const [k, v] of ipHits) {
      if (v.every((t) => now - t >= windowMs)) ipHits.delete(k)
    }
  }
  return true
}

async function getClientIp(): Promise<string> {
  const h = await headers()
  return (h.get('cf-connecting-ip') || (h.get('x-forwarded-for') || '').split(',')[0] || '').trim()
}


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

    const _v = cleanContactInput(data)
    if ('error' in _v) {
      return { success: false, error: _v.error }
    }

    // IP 기준 도배 방지: 시간당 10건
    const _ip = await getClientIp()
    if (!checkIpRateLimit(_ip, 10, 60 * 60 * 1000)) {
      return { success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
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
    // 본인 또는 관리자만 해당 크리에이터의 메시지를 조회할 수 있다. (미인증 시 throw -> 빈 배열 반환)
    const { requireAuth } = await import('@/lib/server-auth')
    const creatorId = await requireAuth(creator_name)

    const messages = await prisma.contactMessage.findMany({
      where: { creator_id: creatorId },
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
    // 관리자이거나 해당 메시지를 수신한 크리에이터 본인만 읽음 처리 가능.
    const cookieStore = await cookies()
    const session = verifySession(cookieStore.get('session')?.value)
    if (!session) return { success: false }

    const message = await prisma.contactMessage.findUnique({ where: { id: messageId } })
    if (!message) return { success: false }

    let authorized = session === 'admin'
    if (!authorized) {
      const sessionProfile = await prisma.profile.findUnique({
        where: { creator_name: session },
        select: { id: true, role: true }
      })
      if (sessionProfile && (sessionProfile.role?.toLowerCase() === 'admin' || sessionProfile.id === message.creator_id)) {
        authorized = true
      }
    }
    if (!authorized) return { success: false }

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

export async function submitSystemSupport(data: { name: string; email: string; message: string }) {
  try {
    const _v = cleanContactInput(data)
    if ('error' in _v) {
      return { success: false, error: _v.error }
    }

    // IP 기준 도배 방지: 시간당 10건
    const _ip = await getClientIp()
    if (!checkIpRateLimit(_ip, 10, 60 * 60 * 1000)) {
      return { success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
    }

    // Find first admin profile
    const admin = await prisma.profile.findFirst({
      where: { role: 'admin' },
      select: { id: true, creator_name: true }
    })

    if (!admin) {
      return { success: false, error: '시스템 관리자 계정을 찾을 수 없습니다.' }
    }

    // Retrieve sender session
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = verifySession(sessionToken)
    const senderName = session || 'guest'

    // 1. Cookie-based Rate Limiting (1 message per minute per browser)
    const lastSentTime = cookieStore.get('last_message_sent')?.value
    if (lastSentTime && Date.now() - parseInt(lastSentTime) < 60 * 1000) {
      return { success: false, error: '메시지를 너무 자주 보낼 수 없습니다. 잠시 후 다시 시도해주세요.' }
    }

    // 2. Database Email Rate Limiting (1 message per 5 minutes per email)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const recentMessage = await prisma.contactMessage.findFirst({
      where: {
        creator_id: admin.id,
        email: data.email,
        created_at: { gte: fiveMinutesAgo }
      }
    })

    if (recentMessage) {
      return { success: false, error: '해당 이메일로 방금 문의를 보냈습니다. 5분 후에 다시 시도해주세요.' }
    }

    // 3. Max Unread Limit (Max 200 unread messages for admin)
    const unreadCount = await prisma.contactMessage.count({
      where: {
        creator_id: admin.id,
        is_read: false
      }
    })

    if (unreadCount >= 200) {
      return { success: false, error: '관리자의 문의 수신함이 가득 차서 더 이상 문의를 접수할 수 없습니다.' }
    }

    await prisma.contactMessage.create({
      data: {
        creator_id: admin.id,
        name: data.name,
        email: data.email,
        message: `[고객센터] ${data.message}`,
        sender_name: session || null
      }
    })

    // Log the action
    await prisma.creatorLog.create({
      data: {
        creator_name: senderName,
        action: 'SYSTEM_SUPPORT',
        details: `고객센터 문의 접수 (이메일: ${data.email})`
      }
    })

    // Set cookie for 1 minute to prevent rapid clicks
    cookieStore.set('last_message_sent', Date.now().toString(), { maxAge: 60 })

    return { success: true }
  } catch (error) {
    console.error('Failed to submit system support inquiry:', error)
    return { success: false, error: '문의 접수 중 예외가 발생했습니다.' }
  }
}

export async function submitSystemFeedback(data: { name: string; email: string; message: string }) {
  try {
    const _v = cleanContactInput(data)
    if ('error' in _v) {
      return { success: false, error: _v.error }
    }

    // IP 기준 도배 방지: 시간당 10건
    const _ip = await getClientIp()
    if (!checkIpRateLimit(_ip, 10, 60 * 60 * 1000)) {
      return { success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
    }

    // Find first admin profile
    const admin = await prisma.profile.findFirst({
      where: { role: 'admin' },
      select: { id: true, creator_name: true }
    })

    if (!admin) {
      return { success: false, error: '시스템 관리자 계정을 찾을 수 없습니다.' }
    }

    // Retrieve sender session
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = verifySession(sessionToken)
    const senderName = session || 'guest'

    // 1. Cookie-based Rate Limiting (1 message per minute per browser)
    const lastSentTime = cookieStore.get('last_message_sent')?.value
    if (lastSentTime && Date.now() - parseInt(lastSentTime) < 60 * 1000) {
      return { success: false, error: '메시지를 너무 자주 보낼 수 없습니다. 잠시 후 다시 시도해주세요.' }
    }

    // 2. Database Email Rate Limiting (1 message per 5 minutes per email)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const recentMessage = await prisma.contactMessage.findFirst({
      where: {
        creator_id: admin.id,
        email: data.email,
        created_at: { gte: fiveMinutesAgo }
      }
    })

    if (recentMessage) {
      return { success: false, error: '해당 이메일로 방금 의견을 보냈습니다. 5분 후에 다시 시도해주세요.' }
    }

    // 3. Max Unread Limit (Max 200 unread messages for admin)
    const unreadCount = await prisma.contactMessage.count({
      where: {
        creator_id: admin.id,
        is_read: false
      }
    })

    if (unreadCount >= 200) {
      return { success: false, error: '관리자의 문의 수신함이 가득 차서 더 이상 피드백을 접수할 수 없습니다.' }
    }

    await prisma.contactMessage.create({
      data: {
        creator_id: admin.id,
        name: data.name,
        email: data.email,
        message: `[의견 보내기] ${data.message}`,
        sender_name: session || null
      }
    })

    // Log the action
    await prisma.creatorLog.create({
      data: {
        creator_name: senderName,
        action: 'SYSTEM_FEEDBACK',
        details: `의견 보내기 피드백 접수 (이메일: ${data.email})`
      }
    })

    // Set cookie for 1 minute to prevent rapid clicks
    cookieStore.set('last_message_sent', Date.now().toString(), { maxAge: 60 })

    return { success: true }
  } catch (error) {
    console.error('Failed to submit system feedback:', error)
    return { success: false, error: '의견 전송 중 예외가 발생했습니다.' }
  }
}

export async function deleteContactMessage(messageId: string) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = verifySession(sessionToken)

    if (!session) {
      return { success: false, error: '로그인이 필요합니다.' }
    }

    const message = await prisma.contactMessage.findUnique({
      where: { id: messageId }
    })

    if (!message) {
      return { success: false, error: '메시지를 찾을 수 없습니다.' }
    }

    let isAuthorized = false
    let sessionProfile = null
    let actorName = session
    let isAdmin = session === 'admin'

    if (session === 'admin') {
      isAuthorized = true
    } else {
      sessionProfile = await prisma.profile.findUnique({
        where: { creator_name: session }
      })
      if (sessionProfile) {
        actorName = sessionProfile.creator_name
        isAdmin = sessionProfile.role?.toLowerCase() === 'admin'
        
        if (
          isAdmin || 
          sessionProfile.id === message.creator_id || 
          (sessionProfile.email && sessionProfile.email === message.email)
        ) {
          isAuthorized = true
        }
      }
    }

    if (!isAuthorized) {
      return { success: false, error: '삭제 권한이 없습니다.' }
    }

    await prisma.contactMessage.delete({
      where: { id: messageId }
    })

    if (isAdmin) {
      // Log in AuditLog
      await prisma.auditLog.create({
        data: {
          admin_name: actorName,
          action: 'DELETE_INQUIRY',
          target_id: messageId,
          details: `관리자가 문의 및 메시지 삭제 (ID: ${messageId})`
        }
      })
    } else {
      // Log in CreatorLog
      await prisma.creatorLog.create({
        data: {
          creator_name: actorName,
          action: 'DELETE_MESSAGE',
          target_id: messageId,
          details: `사용자가 메시지/문의 내역 삭제 (ID: ${messageId})`
        }
      })
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to delete contact message:', error)
    return { success: false, error: '삭제 중 예외가 발생했습니다.' }
  }
}

export async function replyToContactMessage(messageId: string, replyText: string) {
  try {
    if (!replyText.trim()) {
      return { success: false, error: '답장 내용을 입력해주세요.' }
    }

    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = verifySession(sessionToken)

    let isAdmin = session === 'admin'
    let adminName = session || 'unknown'

    if (!isAdmin && session) {
      const profile = await prisma.profile.findUnique({
        where: { creator_name: session }
      })
      if (profile && profile.role?.toLowerCase() === 'admin') {
        isAdmin = true
        adminName = profile.creator_name
      }
    }

    if (!isAdmin) {
      return { success: false, error: '권한이 없습니다: 관리자만 답장 가능합니다.' }
    }

    await prisma.contactMessage.update({
      where: { id: messageId },
      data: {
        reply: replyText,
        replied_at: new Date(),
        is_read: true, // Automatically mark as read when replying
        reply_read: false
      }
    })

    // Log in AuditLog
    await prisma.auditLog.create({
      data: {
        admin_name: adminName,
        action: 'REPLY_INQUIRY',
        target_id: messageId,
        details: `고객 문의 답변 등록`
      }
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to reply to contact message:', error)
    return { success: false, error: '답장 처리 중 예외가 발생했습니다.' }
  }
}

export async function markReplyAsRead(messageId: string) {
  try {
    // 관리자, 메시지 소유자, 또는 해당 문의를 보낸 발신자(sender_name/email)만 답변 읽음 처리 가능.
    const cookieStore = await cookies()
    const session = verifySession(cookieStore.get('session')?.value)
    if (!session) return { success: false }

    const message = await prisma.contactMessage.findUnique({ where: { id: messageId } })
    if (!message) return { success: false }

    let authorized = session === 'admin'
    if (!authorized) {
      const sessionProfile = await prisma.profile.findUnique({
        where: { creator_name: session },
        select: { id: true, role: true, email: true, creator_name: true }
      })
      if (sessionProfile) {
        if (
          sessionProfile.role?.toLowerCase() === 'admin' ||
          sessionProfile.id === message.creator_id ||
          (message.sender_name && message.sender_name === sessionProfile.creator_name) ||
          (sessionProfile.email && message.email === sessionProfile.email)
        ) {
          authorized = true
        }
      }
    }
    if (!authorized) return { success: false }

    await prisma.contactMessage.update({
      where: { id: messageId },
      data: { reply_read: true }
    })
    return { success: true }
  } catch (error) {
    console.error('Failed to mark reply as read:', error)
    return { success: false }
  }
}

export async function deleteContactMessageReply(messageId: string) {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value
    const session = verifySession(sessionToken)

    let isAdmin = session === 'admin'
    let adminName = session || 'unknown'

    if (!isAdmin && session) {
      const profile = await prisma.profile.findUnique({
        where: { creator_name: session }
      })
      if (profile && profile.role?.toLowerCase() === 'admin') {
        isAdmin = true
        adminName = profile.creator_name
      }
    }

    if (!isAdmin) {
      return { success: false, error: '권한이 없습니다: 관리자만 답변을 삭제할 수 있습니다.' }
    }

    await prisma.contactMessage.update({
      where: { id: messageId },
      data: {
        reply: null,
        replied_at: null,
        reply_read: false
      }
    })

    // Log in AuditLog
    await prisma.auditLog.create({
      data: {
        admin_name: adminName,
        action: 'DELETE_REPLY',
        target_id: messageId,
        details: `관리자가 문의 답변 삭제 (ID: ${messageId})`
      }
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to delete reply:', error)
    return { success: false, error: '답변 삭제 중 에러가 발생했습니다.' }
  }
}



