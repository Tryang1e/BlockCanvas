import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Boxes, ArrowRight } from 'lucide-react'
import MinecraftIntegration from '@/components/dashboard/MinecraftIntegration'
import DiscordIntegration from '@/components/dashboard/DiscordIntegration'

export default async function ConnectionsPage({
  params,
}: {
  params: Promise<{ site: string }>
}) {
  const { site } = await params
  const profile = await prisma.profile.findUnique({
    where: { creator_name: site.toLowerCase() },
  })
  if (!profile) notFound()

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-neutral-900 tracking-tight mb-2">외부 계정 연동</h1>
        <p className="text-neutral-500 font-medium">
          디스코드·마인크래프트(Microsoft) 계정의 연동 상태를 확인하고 관리하세요.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-neutral-200 overflow-hidden p-8 space-y-2">
        {/* 마인크래프트(Microsoft) 계정 연동 */}
        <MinecraftIntegration />
        {/* Discord 계정 연동 */}
        <DiscordIntegration />
      </div>

      {/* 연동 완료 시 건축 서버 대시보드 바로가기 */}
      {profile.minecraft_uuid && (
        <Link
          href="/dashboard/minecraft"
          className="mt-6 flex items-center justify-between gap-4 p-5 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <Boxes className="text-neutral-700" size={22} />
            <div>
              <div className="font-bold text-sm text-neutral-900">건축 서버 대시보드</div>
              <div className="text-xs text-neutral-500 font-medium">영토(Plot)와 월드(클라우드)를 관리하세요.</div>
            </div>
          </div>
          <ArrowRight className="text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" size={18} />
        </Link>
      )}
    </div>
  )
}
