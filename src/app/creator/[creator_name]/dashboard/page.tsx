import { prisma } from '@/lib/prisma'
import DashboardViewsChart from '@/components/creator/DashboardViewsChart'

export default async function DashboardOverviewPage({
  params,
}: {
  params: Promise<{ creator_name: string }>
}) {
  const { creator_name } = await params

  const profile = await prisma.profile.findUnique({
    where: { creator_name },
    include: {
      portfolios: true,
      projects: true
    }
  })

  if (!profile) return null

  const projectCount = profile.projects.length
  
  // Calculate actual total views from projects
  const totalViews = profile.projects.reduce((sum, p) => sum + p.view_count, 0)
  
  const hasPortfolio = !!profile.portfolios

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-neutral-900 tracking-tight mb-2">대시보드 요약</h1>
        <p className="text-neutral-500 font-medium">포트폴리오 현황과 주요 통계를 한눈에 확인하세요.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <h3 className="text-neutral-500 text-sm font-bold tracking-tight mb-2">총 게시물 수</h3>
          <p className="text-4xl font-black text-neutral-900">{projectCount}개</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <h3 className="text-neutral-500 text-sm font-bold tracking-tight mb-2">누적 조회수</h3>
          <p className="text-4xl font-black text-neutral-900">{totalViews.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] mb-8">
        <h2 className="text-xl font-bold mb-6 tracking-tight text-neutral-900">주간 조회수 추이</h2>
        <DashboardViewsChart totalViews={totalViews} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <h2 className="text-xl font-bold mb-6 tracking-tight text-neutral-900">포트폴리오 상태</h2>
          <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-100">
            <div>
              <p className="font-bold text-neutral-900">인사이트 포트폴리오 생성 여부</p>
              <p className="text-sm text-neutral-500 mt-1">포트폴리오 정보(배너, 소개글 등)가 초기화되어 있는지 여부입니다.</p>
            </div>
            <div className={`px-4 py-2 rounded-full font-bold text-sm ${hasPortfolio ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {hasPortfolio ? '생성 완료' : '미생성'}
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <h2 className="text-xl font-bold mb-6 tracking-tight text-neutral-900">시스템 연동 현황</h2>
          <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-100 opacity-60">
            <div>
              <p className="font-bold text-neutral-900">마인크래프트 계정 및 건축 서버</p>
              <p className="text-sm text-neutral-500 mt-1">인게임 플러그인을 통해 건축물 메타데이터를 연동합니다.</p>
            </div>
            <div className="px-4 py-2 rounded-full font-bold text-sm bg-neutral-200 text-neutral-600">
              지원 예정
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
