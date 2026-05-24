import { prisma } from '@/lib/prisma'
import AdminSettingsForm from './AdminSettingsForm'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const settings = await prisma.siteSetting.findMany()

  // Convert settings array to object for easier consumption
  const settingsObj = settings.reduce((acc: Record<string, string>, curr: any) => {
    acc[curr.key] = curr.value
    return acc
  }, {} as Record<string, string>)

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 tracking-tight">사이트 전체 설정</h2>
      <div className="bg-white rounded-md border border-neutral-200 shadow-sm max-w-3xl">
        <div className="p-4 border-b border-neutral-200 bg-neutral-50/80">
          <h3 className="text-sm font-bold text-neutral-800">글로벌 서비스 설정</h3>
        </div>
        <div className="p-6">
          <AdminSettingsForm initialSettings={settingsObj} />
        </div>
      </div>
    </div>
  )
}
