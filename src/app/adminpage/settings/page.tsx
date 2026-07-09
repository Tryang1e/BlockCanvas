import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { currentAdminIdentity } from '@/lib/admin-auth'
import { isSuperAdmin } from '@/lib/roles'
import AdminSettingsForm from './AdminSettingsForm'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  // 🔒 최종 관리자 전용 — 매니저의 URL 직접접근 차단(사이드바 canSuper 숨김의 서버측 백업).
  const me = await currentAdminIdentity()
  if (!isSuperAdmin(me?.role)) redirect('/adminpage')

  const settings = await prisma.siteSetting.findMany()

  // Convert settings array to object for easier consumption
  const settingsObj = settings.reduce((acc: Record<string, string>, curr: any) => {
    acc[curr.key] = curr.value
    return acc
  }, {} as Record<string, string>)

  // Fetch all available creators (active profiles)
  const creators = await prisma.profile.findMany({
    select: {
      creator_name: true,
      display_name: true,
      avatar_url: true
    },
    orderBy: { creator_name: 'asc' }
  })

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 tracking-tight">사이트 전체 설정</h2>
      <div className="bg-white rounded-md border border-neutral-200 shadow-sm max-w-3xl">
        <div className="p-4 border-b border-neutral-200 bg-neutral-50/80">
          <h3 className="text-sm font-bold text-neutral-800">글로벌 서비스 설정</h3>
        </div>
        <div className="p-6">
          <AdminSettingsForm initialSettings={settingsObj} availableCreators={creators} />
        </div>
      </div>
    </div>
  )
}
