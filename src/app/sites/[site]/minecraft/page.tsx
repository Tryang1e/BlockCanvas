import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { verifySession } from '@/lib/session'
import { isAdminPanelAccess, canUseBuildDashboard } from '@/lib/roles'
import { getModerationState } from '@/lib/moderation'
import { Plug, ArrowRight, CheckCircle2, Circle } from 'lucide-react'
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
  const isOwner = session === creator_name
  let authorized = isOwner
  if (!authorized && session) {
    const sp = await prisma.profile.findUnique({ where: { creator_name: session } })
    if (isAdminPanelAccess(sp?.role)) authorized = true
    // 제재 게이트: 본인(세션 유저)이 이용정지/차단이면 안내 페이지로.
    if (sp && getModerationState(sp).isBlocked) redirect('/suspended')
  } else if (authorized && session === creator_name) {
    const me = await prisma.profile.findUnique({ where: { creator_name } })
    if (me && getModerationState(me).isBlocked) redirect('/suspended')
  }
  if (!authorized) redirect('/')

  const profile = await prisma.profile.findUnique({ where: { creator_name } })
  if (!profile) notFound()

  // 3종 인증(디스코드 + 마인크래프트 + 웹 회원가입) 미완료 → 풀페이지 잠금 안내.
  // (관리/유료 등급(creator/official/admin)은 마크 연동만 있으면 통과 — canUseBuildDashboard)
  if (!canUseBuildDashboard(profile)) {
    const steps = [
      { label: '웹 회원가입 (이메일 · 비밀번호)', done: !!(profile.email && profile.password) },
      { label: '디스코드 연동', done: !!profile.discord_id },
      { label: '마인크래프트(정품) 연동', done: !!profile.minecraft_uuid },
    ]
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 text-center p-6">
        <div className="w-16 h-16 mb-5 rounded-2xl bg-neutral-100 flex items-center justify-center">
          <Plug className="text-neutral-400" size={30} />
        </div>
        <h1 className="text-2xl font-black text-neutral-900 mb-2">건축 대시보드 잠김</h1>
        <p className="text-neutral-500 font-medium mb-6 max-w-md">
          건축 대시보드(월드 · 영토)는 <b className="text-neutral-700">디스코드 · 마인크래프트 · 웹 회원가입</b> 3종 인증을 모두 마쳐야 이용할 수 있습니다.
        </p>
        <div className="w-full max-w-sm space-y-2 mb-7 text-left">
          {steps.map((s) => (
            <div
              key={s.label}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${s.done ? 'border-emerald-200 bg-emerald-50/50' : 'border-neutral-200 bg-white'}`}
            >
              {s.done ? (
                <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />
              ) : (
                <Circle className="text-neutral-300 shrink-0" size={18} />
              )}
              <span className={`text-sm font-semibold ${s.done ? 'text-emerald-700' : 'text-neutral-700'}`}>{s.label}</span>
              {s.done && <span className="ml-auto text-[10px] font-bold text-emerald-500">완료</span>}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/connections"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-neutral-800 text-white text-sm font-bold rounded-xl transition-colors"
          >
            인증 완료하러 가기 <ArrowRight size={16} />
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
      minecraftUsername={profile.minecraft_username || creator_name}
      minecraftUuid={profile.minecraft_uuid}
      blockInvites={profile.block_invites}
      // 비소유자(어드민/매니저)가 조회 중이면 대상 유저 핸들로 임퍼스네이트 + 읽기 전용.
      viewAs={isOwner ? undefined : creator_name}
      readOnly={!isOwner}
    />
  )
}
