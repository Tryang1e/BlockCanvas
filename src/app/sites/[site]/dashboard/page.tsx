import { prisma } from '@/lib/prisma'
import DashboardViewsChart from '@/components/creator/DashboardViewsChart'
import { Activity, ShieldCheck, ShieldAlert, Mail, Calendar, User, ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'

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
                공식 크리에이터가 되세요!
              </h2>
              <p className="text-sm text-neutral-500 leading-relaxed font-medium">
                일반 사용자 계정은 외부 공개용 포트폴리오를 제공하지 않습니다. <br /><br />
                구독 멤버십에 가입하거나 공식 크리에이터로 등록되면, 드래그 앤 드롭 빌더를 이용해 멋진 캔버스 페이지를 개설할 수 있습니다!
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-200/60 text-xs text-neutral-400 font-semibold leading-relaxed">
              💡 권한 업그레이드 신청 및 변경 문의는 관리자 고객센터로 메일 주시기 바랍니다.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Creator/PRO role dashboard overview
  const projectCount = profile.projects.length
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
