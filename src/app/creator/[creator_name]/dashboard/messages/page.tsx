import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import MessagesDashboardClient from '@/components/creator/MessagesDashboardClient'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

export default async function DashboardMessagesPage({
  params,
}: {
  params: Promise<{ creator_name: string }>
}) {
  const { creator_name } = await params
  
  const profile = await prisma.profile.findUnique({
    where: { creator_name },
    include: { messages: { orderBy: { created_at: 'desc' } } }
  })

  if (!profile) {
    notFound()
  }

  // Format messages for the UI
  const initialMessages = profile.messages.map(msg => ({
    id: msg.id,
    title: msg.name,
    subtitle: msg.email,
    content: msg.message, // Used in detailed view
    time: formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ko }),
    is_read: msg.is_read
  }))

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-neutral-900 tracking-tight mb-2">메시지 관리</h1>
        <p className="text-neutral-500 font-medium">팬이나 클라이언트로부터 도착한 연락을 확인하고 관리하세요.</p>
      </div>

      <MessagesDashboardClient initialMessages={initialMessages} creatorName={creator_name} />
    </div>
  )
}
