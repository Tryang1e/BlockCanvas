import { prisma } from '@/lib/prisma'
import AdminTable from './AdminTable'
import AddUserModal from '@/components/admin/AddUserModal'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  // 1. Fetch total creator count
  const creatorCount = await prisma.profile.count({
    where: { role: 'creator' }
  })

  // 2. Fetch total projects count
  const projectCount = await prisma.project.count()

  // 3. Fetch total views
  const viewCountResult = await prisma.project.aggregate({
    _sum: { view_count: true }
  })
  const totalViews = viewCountResult._sum.view_count || 0

  // 4. Fetch all profiles with their portfolio published status for detail actions
  const profiles = await prisma.profile.findMany({
    include: {
      portfolios: {
        select: {
          is_published: true
        }
      }
    },
    orderBy: { created_at: 'desc' }
  })

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 tracking-tight">대시보드 요약</h2>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-5 rounded-md border border-neutral-200 flex flex-col shadow-sm">
          <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-wider mb-1">총 크리에이터</h3>
          <p className="text-2xl font-black tracking-tight text-neutral-800">{creatorCount.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-md border border-neutral-200 flex flex-col shadow-sm">
          <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-wider mb-1">총 작품 수</h3>
          <p className="text-2xl font-black tracking-tight text-neutral-800">{projectCount.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-md border border-neutral-200 flex flex-col shadow-sm">
          <h3 className="text-neutral-500 text-xs font-bold uppercase tracking-wider mb-1">누적 페이지뷰</h3>
          <p className="text-2xl font-black tracking-tight text-blue-600">{totalViews.toLocaleString()}</p>
        </div>
      </div>

      {/* Interactive Data Table */}
      <div className="bg-white rounded-md border border-neutral-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50/80">
          <h3 className="text-sm font-bold text-neutral-800">최근 승인 요청 및 가입 현황</h3>
          <AddUserModal />
        </div>
        <AdminTable profiles={profiles} />
        <div className="p-3 border-t border-neutral-100 flex justify-center bg-white text-xs text-neutral-400">
           총 {profiles?.length || 0}개 회원 정보
        </div>
      </div>
    </div>
  )
}
