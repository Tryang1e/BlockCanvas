import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import PortfolioManager from '@/components/creator/PortfolioManager'

export default async function DashboardPortfolioPage({
  params,
}: {
  params: Promise<{ creator_name: string }>
}) {
  const { creator_name } = await params
  
  const profile = await prisma.profile.findUnique({
    where: { creator_name },
    include: { portfolios: true }
  })

  if (!profile) {
    notFound()
  }

  const hasPortfolio = !!profile.portfolios

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-neutral-900 tracking-tight mb-2">인사이트 포트폴리오 관리</h1>
        <p className="text-neutral-500 font-medium">나만의 포트폴리오 사이트를 개설하고 활성화 여부를 결정하세요.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-neutral-200 overflow-hidden p-8">
        <PortfolioManager creatorName={creator_name} hasPortfolio={hasPortfolio} />
      </div>
    </div>
  )
}
