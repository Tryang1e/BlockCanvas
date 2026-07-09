import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import DashboardViewsChart from '@/components/creator/DashboardViewsChart'
import PatreonSubscribeCard from '@/components/dashboard/PatreonSubscribeCard'
import { isPatreonOAuthConfigured } from '@/lib/patreonOAuth'
import { isOfficialOrAbove } from '@/lib/roles'
import { Activity, ShieldCheck, ShieldAlert, Mail, Calendar, User, ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'

/**
 * OAuth 중앙화(connections/page.tsx 와 동일 규칙): Patreon 연결/재동기화 시작 URL 을
 * 단일 auth 호스트(auth.<base>) 기준 절대경로로 만든다(redirect_uri 1개 공유).
 */
async function authHostUrl(path: string): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'craftopia.work'
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1')
  const proto = !isLocal || h.get('x-forwarded-proto') === 'https' ? 'https' : 'http'
  const base = isLocal ? host : host.split('.').slice(-2).join('.')
  const authHost = isLocal ? host : `auth.${base}`
  return `${proto}://${authHost}${path}`
}

export default async function DashboardOverviewPage({
  params,
}: {
  params: Promise<{ site: string }>
}) {
  const { site } = await params
  const creator_name = site

  const profile = await prisma.profile.findUnique({
    where: { creator_name },
    include: {
      portfolios: true,
      projects: true
    }
  })

  if (!profile) return null

  // Patreon 구독 CTA 노출 여부 — 미설정(CLIENT_ID/SECRET 없음)이거나 official 이상(공식·매니저·관리자)이면 숨긴다.
  //   official+ 는 이미 크리에이터 권한을 보유해 구독 CTA 가 무의미. user·creator 에게만 노출.
  //   patreonLoginUrl 이 null 이면 카드 자체를 렌더하지 않는다(연결/재동기화 공용 시작 URL).
  const patreonLoginUrl =
    isPatreonOAuthConfigured() && !isOfficialOrAbove(profile.role)
      ? await authHostUrl('/api/auth/patreon/start')
      : null

  // If the role is 'user', render the personalized USER dashboard
  if (profile.role === 'user') {
    const activityCount = await prisma.creatorLog.count({
      where: { creator_name }
    })

    return (
      <div className="animate-in fade-in zoom-in-95 duration-500">
        {/* Welcome Section */}
        <div className="mb-8 p-8 rounded-3xl bg-gradient-to-r from-neutral-900 to-neutral-800 text-white relative overflow-hidden shadow-lg">
          <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-10 pointer-events-none">
            <Sparkles size={240} />
          </div>
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-4 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              일반 사용자 계정 (Normal User)
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
              안녕하세요, {profile.display_name || profile.creator_name}님!
            </h1>
            <p className="text-neutral-300 font-medium text-sm leading-relaxed">
              BlockCanvas 개인 대시보드에 오신 것을 환영합니다. 이곳에서 계정 보안 상태를 점검하고 활동 로그를 실시간으로 확인하실 수 있습니다.
            </p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Card 1: Activity Log Count */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <h3 className="text-neutral-500 text-sm font-bold tracking-tight mb-1">내 활동 로그 기록</h3>
              <p className="text-3xl font-black text-neutral-900">{activityCount}개</p>
              <Link
                href={`/dashboard/activity`}
                className="inline-flex items-center gap-1 text-xs font-bold text-neutral-400 hover:text-black mt-3 transition-colors group"
              >
                상세 기록 보기 <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 text-neutral-500">
              <Activity size={28} />
            </div>
          </div>

          {/* Card 2: 2FA Authentication Status */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between">
            <div>
              <h3 className="text-neutral-500 text-sm font-bold tracking-tight mb-1">2단계 인증 (2FA)</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xl font-black ${profile.two_factor_enabled ? 'text-green-600' : 'text-amber-500'}`}>
                  {profile.two_factor_enabled ? '보안 활성화됨' : '비활성화 상태'}
                </span>
              </div>
              <Link
                href={`/dashboard/account`}
                className="inline-flex items-center gap-1 text-xs font-bold text-neutral-400 hover:text-black mt-3 transition-colors group"
              >
                설정 및 변경하기 <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <div className={`p-4 rounded-2xl border ${profile.two_factor_enabled ? 'bg-green-50 border-green-100 text-green-600' : 'bg-amber-50 border-amber-100 text-amber-500'}`}>
              {profile.two_factor_enabled ? <ShieldCheck size={28} /> : <ShieldAlert size={28} />}
            </div>
          </div>
        </div>

        {/* Detailed Info Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Account Profile Details */}
          <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] lg:col-span-2">
            <h2 className="text-xl font-bold mb-6 tracking-tight text-neutral-900 flex items-center gap-2">
              <User size={20} className="text-neutral-400" />
              계정 개인 정보 요약
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <User size={16} className="text-neutral-400" />
                  <span className="text-sm font-bold text-neutral-500">닉네임 / 핸들</span>
                </div>
                <span className="text-sm font-semibold text-neutral-800">
                  {profile.display_name || '-'} (@{profile.creator_name})
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-neutral-400" />
                  <span className="text-sm font-bold text-neutral-500">가입 이메일</span>
                </div>
                <span className="text-sm font-semibold text-neutral-800">{profile.email || '-'}</span>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-neutral-400" />
                  <span className="text-sm font-bold text-neutral-500">가입 일자</span>
                </div>
                <span className="text-sm font-semibold text-neutral-800">
                  {new Date(profile.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Upgrade Callout */}
          <div className="bg-neutral-50 p-8 rounded-2xl border border-neutral-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.01)] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center mb-4">
                <Sparkles size={18} />
              </div>
              <h2 className="text-lg font-bold mb-3 tracking-tight text-neutral-900">
                크리에이터가 되세요!
              </h2>
              <p className="text-sm text-neutral-500 leading-relaxed font-medium">
                일반 사용자 계정은 외부 공개용 포트폴리오를 제공하지 않습니다. <br /><br />
                <strong>구독 멤버십</strong>에 가입시 크리에이터로 등록되며, 드래그 앤 드롭 빌더를 이용해 멋진 캔버스 페이지를 개설할 수 있습니다!
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-200/60 space-y-3">
              {patreonLoginUrl && (
                <PatreonSubscribeCard patreonLoginUrl={patreonLoginUrl} />
              )}
              <p className="text-[11px] text-neutral-400 font-semibold leading-relaxed">
                💡 그 밖의 권한 문의는 관리자 고객센터로 메일 주시기 바랍니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Creator/PRO role dashboard: 간소화한 조회수 요약(그래프 중심) ──
  const cleanTitle = (t: string | null) =>
    (t || '').replace(/\[\s*SIZE\s*:\s*[1-3]\s*(?:[xX]\s*[1-3])?\s*\]/gi, '').trim() || '제목 없음'

  const projects = profile.projects
  const projectCount = projects.length
  const publishedCount = projects.filter((p) => p.is_published).length
  const totalViews = projects.reduce((sum, p) => sum + p.view_count, 0)
  const avgViews = projectCount ? Math.round(totalViews / projectCount) : 0

  const topWorks = [...projects]
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 5)
    .map((p) => ({ id: p.id, title: cleanTitle(p.title), views: p.view_count, isPublished: p.is_published }))

  const statCards = [
    { label: '총 작품', value: projectCount.toLocaleString() },
    { label: '공개 작품', value: publishedCount.toLocaleString() },
    { label: '누적 조회수', value: totalViews.toLocaleString() },
    { label: '평균 조회', value: avgViews.toLocaleString() },
  ]

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 max-w-3xl">
      {patreonLoginUrl && (
        <div className="mb-6">
          <PatreonSubscribeCard patreonLoginUrl={patreonLoginUrl} />
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-neutral-900 tracking-tight mb-1">방문자 통계</h1>
        <p className="text-sm text-neutral-500 font-medium">포트폴리오 조회 현황 요약</p>
      </div>

      {/* 간단 수치 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {statCards.map((c) => (
          <div key={c.label} className="bg-white px-4 py-3 rounded-xl border border-neutral-200">
            <p className="text-[11px] font-bold text-neutral-400 truncate">{c.label}</p>
            <p className="text-xl font-black text-neutral-900 mt-0.5">{c.value}</p>
          </div>
        ))}
      </div>

      {/* 메인: 주간 조회수 추이 (작게) */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)] mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
            <Activity size={15} className="text-indigo-500" /> 주간 조회수 추이
          </h2>
          <span className="text-[10px] text-neutral-300 font-medium">추정 분포</span>
        </div>
        <DashboardViewsChart totalViews={totalViews} />
      </div>

      {/* 조회수 순위 (차분하게) */}
      {topWorks.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <h2 className="text-xs font-bold text-neutral-400 mb-2">조회수 순위</h2>
          <ul className="divide-y divide-neutral-100">
            {topWorks.map((w, i) => (
              <li key={w.id}>
                <Link href={`/project/${w.id}`} className="flex items-center gap-3 py-2 group">
                  <span className="w-4 text-xs font-bold text-neutral-300 tabular-nums shrink-0">{i + 1}</span>
                  <span className="text-sm text-neutral-600 truncate flex-1 group-hover:text-neutral-900 transition-colors">
                    {w.title}
                    {!w.isPublished && <span className="ml-1.5 text-[10px] text-neutral-400">(비공개)</span>}
                  </span>
                  <span className="text-xs font-semibold text-neutral-400 tabular-nums shrink-0">{w.views.toLocaleString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-neutral-400 mt-5 leading-relaxed">
        ※ &quot;주간 조회수 추이&quot;는 누적 조회수를 요일별 분포로 추정·시각화한 것입니다(실제 일자별 기록 아님). 수치(누적 조회수·순위)는 실제 값입니다.
      </p>
    </div>
  )
}
