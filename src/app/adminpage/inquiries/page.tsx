import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AdminInquiriesClient from './AdminInquiriesClient'

export const dynamic = 'force-dynamic'

export default async function AdminInquiriesPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = verifySession(sessionToken)

  if (!session) {
    redirect('/login')
  }

  // Double check admin credentials
  let isAdmin = session === 'admin'
  if (!isAdmin) {
    const profile = await prisma.profile.findUnique({
      where: { creator_name: session }
    })
    if (profile && profile.role?.toLowerCase() === 'admin') {
      isAdmin = true
    }
  }

  if (!isAdmin) {
    redirect('/login')
  }

  // Fetch inquiries sent to admin creators starting with specific prefixes
  const inquiries = await prisma.contactMessage.findMany({
    where: {
      creator: {
        role: 'admin'
      },
      OR: [
        { message: { startsWith: '[고객센터]' } },
        { message: { startsWith: '[의견 보내기]' } }
      ]
    },
    orderBy: {
      created_at: 'desc'
    }
  })

  // Format date and map to simple types for client consumption
  const initialInquiries = inquiries.map(inquiry => {
    // Determine type: message text starting with [의견 보내기] is feedback, else support
    const isFeedback = inquiry.message.startsWith('[의견 보내기]')
    const typeLabel = isFeedback ? '서비스 의견' : '1:1 문의'
    const typeCode: 'support' | 'feedback' = isFeedback ? 'feedback' : 'support'
    const displayMessage = isFeedback 
      ? inquiry.message.replace('[의견 보내기]', '').trim() 
      : inquiry.message.replace('[고객센터]', '').trim()

    return {
      id: inquiry.id,
      name: inquiry.name,
      email: inquiry.email,
      message: displayMessage,
      is_read: inquiry.is_read,
      reply: inquiry.reply,
      replied_at: inquiry.replied_at ? inquiry.replied_at.toISOString() : null,
      created_at: inquiry.created_at.toISOString(),
      typeLabel,
      typeCode
    }
  })

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900">고객 문의 및 피드백 관리</h2>
        <p className="text-neutral-500 text-sm mt-1">
          사용자들이 고객지원 센터를 통해 보낸 1:1 고객문의와 서비스 개선 의견을 한곳에서 모니터링하고 관리합니다.
        </p>
      </div>

      <AdminInquiriesClient initialInquiries={initialInquiries} />
    </div>
  )
}
