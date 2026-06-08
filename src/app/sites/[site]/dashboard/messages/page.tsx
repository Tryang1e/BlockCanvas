import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import MessagesDashboardClient from '@/components/creator/MessagesDashboardClient'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

export default async function DashboardMessagesPage({
  params,
}: {
  params: Promise<{ site: string }>
}) {
  const { site } = await params
  const creator_name = site
  
  const profile = await prisma.profile.findUnique({
    where: { creator_name },
    include: { 
      messages: { 
        where: {
          NOT: [
            { message: { startsWith: '[고객센터]' } },
            { message: { startsWith: '[의견 보내기]' } }
          ]
        },
        orderBy: { created_at: 'desc' } 
      } 
    }
  })

  if (!profile) {
    notFound()
  }

  // Fetch support inquiries submitted by this user (matched by sender_name or registered email)
  const supportInquiries = await prisma.contactMessage.findMany({
    where: {
      creator: {
        role: 'admin'
      },
      OR: [
        { sender_name: profile.creator_name },
        ...(profile.email ? [{ email: profile.email }] : [])
      ]
    },
    orderBy: { created_at: 'desc' }
  })

  // Format incoming received messages (only for creators/admins, not for normal users)
  const initialMessages = profile.role === 'user' ? [] : profile.messages.map(msg => ({
    id: msg.id,
    title: msg.name,
    subtitle: msg.email,
    content: msg.message,
    time: formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ko }),
    is_read: msg.is_read
  }))

  // Format support inquiries for the UI
  const initialSupportInquiries = supportInquiries.map(msg => {
    // Determine type (support or feedback)
    let typeLabel = '고객지원'
    let messageText = msg.message
    if (msg.message.startsWith('[고객센터]')) {
      typeLabel = '1:1 문의'
      messageText = msg.message.replace('[고객센터]', '').trim()
    } else if (msg.message.startsWith('[의견 보내기]')) {
      typeLabel = '의견 제안'
      messageText = msg.message.replace('[의견 보내기]', '').trim()
    }

    return {
      id: msg.id,
      name: msg.name,
      email: msg.email,
      message: messageText,
      typeLabel,
      is_read: msg.is_read,
      reply: msg.reply,
      replied_at: msg.replied_at ? msg.replied_at.toISOString() : null,
      reply_read: msg.reply_read,
      created_at: msg.created_at.toISOString(),
      time: formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ko })
    }
  })

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-neutral-900 tracking-tight mb-2">
          {profile.role === 'user' ? '문의 및 답변 보관함' : '메시지 및 문의 관리'}
        </h1>
        <p className="text-neutral-500 font-medium">
          {profile.role === 'user'
            ? '관리자에게 보낸 1:1 문의와 피드백 답변 내역을 확인하세요.'
            : '팬이나 클라이언트로부터 도착한 메시지 및 플랫폼 문의 내역을 확인하세요.'}
        </p>
      </div>

      <MessagesDashboardClient 
        initialMessages={initialMessages} 
        initialSupportInquiries={initialSupportInquiries}
        creatorName={creator_name}
        userRole={profile.role}
      />
    </div>
  )
}
