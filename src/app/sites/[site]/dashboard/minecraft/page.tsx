import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Boxes, Plug, ArrowRight, CheckCircle2 } from 'lucide-react'
import MinecraftPlots from '@/components/dashboard/MinecraftPlots'
import MinecraftWorlds from '@/components/dashboard/MinecraftWorlds'

export default async function MinecraftDashboardPage({
  params,
}: {
  params: Promise<{ site: string }>
}) {
  const { site } = await params
  const profile = await prisma.profile.findUnique({
    where: { creator_name: site.toLowerCase() },
  })
  if (!profile) notFound()

  const connected = !!profile.minecraft_uuid

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight mb-2 flex items-center gap-2.5">
            <Boxes className="text-neutral-700" size={28} />
            건축 서버 대시보드
          </h1>
          <p className="text-neutral-500 font-medium">
            마인크래프트 건축 서버의 영토와 월드(클라우드)를 웹에서 관리하세요.
          </p>
        </div>
        {connected && (
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-bold whitespace-nowrap">
            <CheckCircle2 size={15} />
            {profile.minecraft_username || '계정 연동됨'}
          </div>
        )}
      </div>

      {!connected ? (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-neutral-100 flex items-center justify-center">
            <Plug className="text-neutral-400" size={26} />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 mb-1.5">먼저 마인크래프트 계정을 연동하세요</h2>
          <p className="text-sm text-neutral-500 font-medium mb-6 max-w-md mx-auto">
            계정을 연동하면 인게임 영토(Plot)와 월드를 이 대시보드에서 직접 관리할 수 있습니다.
          </p>
          <Link
            href="/dashboard/connections"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-neutral-800 text-white text-sm font-bold rounded-xl transition-colors"
          >
            계정 연동하러 가기 <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 영토(Plot) 관리 */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-8">
            <MinecraftPlots />
          </div>

          {/* 월드(클라우드) */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-8">
            <MinecraftWorlds />
          </div>
        </div>
      )}
    </div>
  )
}
