import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { verifySession } from '@/lib/session'
import { Plug, ArrowRight } from 'lucide-react'
import ServerDashboard from '@/components/dashboard/ServerDashboard'

// {creator}.craftopia.work/minecraft → /sites/[site]/minecraft (proxy.ts 리라이트)
// 소유자(또는 admin) 전용 풀페이지 건축 클라우드. 크리에이터 대시보드와 독립.
export default async function MinecraftStudioPage({
  params,
}: {
  params: Promise<{ site: string }>
}) {
  const { site } = await params
  const creator_name = site.toLowerCase()

  // 소유자 전용 인증 (sites 레이아웃은 포트폴리오 공개 기준이라 별도 게이트 필요)
  const session = verifySession((await cookies()).get('session')?.value)
  let authorized = session === creator_name
  if (!authorized && session) {
    const sp = await prisma.profile.findUnique({ where: { creator_name: session } })
    if (sp?.role === 'admin') authorized = true
  }
  if (!authorized) redirect('/')

  const profile = await prisma.profile.findUnique({ where: { creator_name } })
  if (!profile) notFound()

  // 미연동 → 풀페이지 연동 안내
  if (!profile.minecraft_uuid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 text-center p-6">
        <div className="w-16 h-16 mb-5 rounded-2xl bg-neutral-100 flex items-center justify-center">
          <Plug className="text-neutral-400" size={30} />
        </div>
        <h1 className="text-2xl font-black text-neutral-900 mb-2">건축 클라우드</h1>
        <p className="text-neutral-500 font-medium mb-6 max-w-md">
          마인크래프트 계정을 연동하면 월드(클라우드)와 영토(Plot)를 이곳에서 관리할 수 있습니다.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/connections"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-neutral-800 text-white text-sm font-bold rounded-xl transition-colors"
          >
            계정 연동하러 가기 <ArrowRight size={16} />
          </Link>
          <Link href="/dashboard" className="text-sm font-bold text-neutral-500 hover:text-neutral-900 transition-colors">
            대시보드
          </Link>
        </div>
      </div>
    )
  }

  return (
    <ServerDashboard
      userName={profile.display_name || creator_name}
      userHandle={creator_name}
      avatarUrl={profile.avatar_url || ''}
      userRole={profile.role}
    />
  )
}
