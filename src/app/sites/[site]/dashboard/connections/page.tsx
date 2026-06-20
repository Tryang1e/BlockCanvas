import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Boxes, ArrowRight } from 'lucide-react'
import MinecraftIntegration from '@/components/dashboard/MinecraftIntegration'
import DiscordIntegration from '@/components/dashboard/DiscordIntegration'

/**
 * 마크 OAuth 중앙화: 모든 크리에이터가 단일 호스트(auth.<base>)에서 OAuth 를 처리하도록
 * "Microsoft 로그인" 버튼 URL 을 절대 경로로 만든다(서브도메인별 redirect_uri 난립 방지 → Azure 등록 1개).
 * localhost 계열은 현재 호스트 그대로(서브도메인 분리 없음 → 동일 호스트라 세션·state 가 그대로 읽힘).
 */
async function buildMsLoginUrl(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'craftopia.work'
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1')
  const proto = !isLocal || h.get('x-forwarded-proto') === 'https' ? 'https' : 'http'
  const base = isLocal ? host : host.split('.').slice(-2).join('.')
  const authHost = isLocal ? host : `auth.${base}`
  return `${proto}://${authHost}/api/auth/minecraft/start`
}

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

  const msLoginUrl = await buildMsLoginUrl()

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-neutral-900 tracking-tight mb-2">외부 계정 연동</h1>
        <p className="text-neutral-500 font-medium">
          디스코드·마인크래프트 계정의 연동 상태를 확인하고 관리하세요.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-neutral-200 overflow-hidden p-8 space-y-2">
        {/* 마인크래프트 계정 연동 (Microsoft 정품 로그인 또는 인게임 코드) */}
        <MinecraftIntegration msLoginUrl={msLoginUrl} />
        {/* Discord 계정 연동 */}
        <DiscordIntegration />
      </div>

      {/* 연동 완료 시 건축 서버 대시보드 바로가기 */}
      {profile.minecraft_uuid && (
        <Link
          href="/minecraft"
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
