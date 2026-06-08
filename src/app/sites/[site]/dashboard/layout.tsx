import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, FolderKanban, Settings, UserCircle, Link as LinkIcon, Globe, Activity, Mail } from 'lucide-react'
import Image from 'next/image'

import UserSidebar from '@/components/layout/UserSidebar'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/session'
import PrivacyConsentModal from '@/components/dashboard/PrivacyConsentModal'

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ site: string }>
}) {
  const { site } = await params
  const creator_name = site.toLowerCase()
  
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = verifySession(sessionToken)

  let isAuthorized = false
  let sessionProfile = null

  if (session === creator_name) {
    isAuthorized = true
  } else if (session) {
    sessionProfile = await prisma.profile.findUnique({
      where: { creator_name: session }
    })
    if (sessionProfile?.role === 'admin') {
      isAuthorized = true
    }
  }

  if (!isAuthorized) {
    redirect(`/`)
  }

  const profile = await prisma.profile.findUnique({
    where: { creator_name }
  })

  const isOwner = session === creator_name

  const currentUser = isOwner ? profile : sessionProfile
  let hasUnread = false

  if (currentUser) {
    const unreadReceivedCount = currentUser.role === 'user' ? 0 : await prisma.contactMessage.count({
      where: {
        creator_id: currentUser.id,
        is_read: false,
        NOT: [
          { message: { startsWith: '[고객센터]' } },
          { message: { startsWith: '[의견 보내기]' } }
        ]
      }
    })

    const unreadRepliesCount = await prisma.contactMessage.count({
      where: {
        creator: { role: 'admin' },
        reply: { not: null },
        reply_read: false,
        OR: [
          { sender_name: currentUser.creator_name },
          ...(currentUser.email ? [{ email: currentUser.email }] : [])
        ]
      }
    })

    hasUnread = unreadReceivedCount > 0 || unreadRepliesCount > 0
  }

  return (
    <div className="flex min-h-screen bg-neutral-50 font-sans text-neutral-900 pb-16 md:pb-0">
      {isOwner && !profile?.privacy_consented && (
        <PrivacyConsentModal creatorName={creator_name} />
      )}
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-neutral-200 flex-col shadow-sm fixed inset-y-0 z-10">
        <div className="h-16 flex items-center px-6 border-b border-neutral-200">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo_icon.png" alt="Logo" width={24} height={24} className="object-contain w-auto h-auto" />
            <span className="font-black text-lg tracking-tighter">BlockCanvas</span>
          </Link>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-1">
          {profile?.role === 'user' ? (
            <>
              <Link 
                href={`/dashboard`} 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-100 font-medium text-sm transition-colors"
              >
                <LayoutDashboard size={18} />
                <span>대시보드 홈</span>
              </Link>
              <Link 
                href={`/dashboard/messages`} 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-100 font-medium text-sm transition-colors relative"
              >
                <Mail size={18} />
                <span>메시지 보관함</span>
                {hasUnread && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                )}
              </Link>
              <Link 
                href={`/dashboard/activity`} 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-100 font-medium text-sm transition-colors"
              >
                <Activity size={18} />
                <span>내 활동 로그</span>
              </Link>
              <Link 
                href={`/dashboard/account`} 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-100 font-medium text-sm transition-colors"
              >
                <Settings size={18} />
                <span>계정 및 보안 관리</span>
              </Link>
            </>
          ) : (
            <>
              <Link 
                href={`/dashboard`} 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-100 font-medium text-sm transition-colors"
              >
                <LayoutDashboard size={18} />
                <span>오버뷰 (통계)</span>
              </Link>
              <Link 
                href={`/dashboard/projects`} 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-100 font-medium text-sm transition-colors"
              >
                <FolderKanban size={18} />
                <span>게시물 관리</span>
              </Link>
              <Link 
                href={`/dashboard/portfolio`} 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-100 font-medium text-sm transition-colors"
              >
                <Globe size={18} />
                <span>포트폴리오 관리</span>
              </Link>
              <Link 
                href={`/dashboard/messages`} 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-100 font-medium text-sm transition-colors relative"
              >
                <Mail size={18} />
                <span>메시지 보관함</span>
                {hasUnread && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                )}
              </Link>
              <Link 
                href={`/dashboard/activity`} 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-100 font-medium text-sm transition-colors"
              >
                <Activity size={18} />
                <span>내 활동 로그</span>
              </Link>
              <Link 
                href={`/dashboard/settings`} 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-100 font-medium text-sm transition-colors"
              >
                <UserCircle size={18} />
                <span>프로필 및 설정</span>
              </Link>
              <Link 
                href={`/dashboard/account`} 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-100 font-medium text-sm transition-colors"
              >
                <Settings size={18} />
                <span>계정 및 보안 관리</span>
              </Link>
            </>
          )}
          {profile?.role === 'admin' && (
            <div className="pt-4 mt-4 border-t border-neutral-200">
              <Link 
                href="/adminpage" 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 font-bold text-sm transition-colors"
              >
                <span>👑 어드민 페이지 이동</span>
              </Link>
            </div>
          )}
          <div className="pt-4 mt-4 border-t border-neutral-200">
            <div className="px-3 mb-2 text-xs font-bold text-neutral-400 uppercase tracking-wider">외부 연동</div>
            <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-neutral-400 cursor-not-allowed font-medium text-sm">
              <LinkIcon size={18} />
              <span className="flex-1 text-left">마인크래프트 계정</span>
              <span className="text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-500">예정</span>
            </button>
          </div>
        </nav>

        {profile?.role !== 'user' && (
          <div className="p-4 border-t border-neutral-200">
            <Link 
              href={`/`} 
              className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-black text-white rounded-lg hover:bg-neutral-800 transition-colors text-sm font-bold shadow-sm"
            >
              <span>내 포트폴리오 보기</span>
            </Link>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-neutral-50/50 md:ml-64 min-h-screen flex flex-col w-full">
        {/* Top Header */}
        <header className="h-16 border-b border-neutral-200 bg-white flex items-center justify-between md:justify-end px-4 md:px-8 sticky top-0 z-[60]">
          <div className="flex items-center gap-2 md:hidden">
            <Image src="/logo_icon.png" alt="Logo" width={24} height={24} className="object-contain w-auto h-auto" />
            <span className="font-black text-lg tracking-tighter">BlockCanvas</span>
          </div>
          <UserSidebar 
            userName={profile?.display_name || creator_name} 
            userHandle={creator_name}
            avatarUrl={profile?.avatar_url || ''}
            isOwner={true}
            userRole={profile?.role || 'creator'}
          />
        </header>

        {/* Page Content */}
        <div className="max-w-6xl mx-auto p-4 md:p-8 w-full flex-1">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full h-16 bg-white border-t border-neutral-200 flex justify-around items-center z-50 px-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {profile?.role === 'user' ? (
          <>
            <Link href={`/dashboard`} className="flex flex-col items-center gap-1 text-neutral-500 hover:text-black">
              <LayoutDashboard size={20} />
              <span className="text-[10px] font-bold">홈</span>
            </Link>
            <Link href={`/dashboard/messages`} className="flex flex-col items-center gap-1 text-neutral-500 hover:text-black relative">
              <div className="relative">
                <Mail size={20} />
                {hasUnread && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </div>
              <span className="text-[10px] font-bold">메시지</span>
            </Link>
            <Link href={`/dashboard/activity`} className="flex flex-col items-center gap-1 text-neutral-500 hover:text-black">
              <Activity size={20} />
              <span className="text-[10px] font-bold">활동 로그</span>
            </Link>
            <Link href={`/dashboard/account`} className="flex flex-col items-center gap-1 text-neutral-500 hover:text-black">
              <Settings size={20} />
              <span className="text-[10px] font-bold">계정/보안</span>
            </Link>
          </>
        ) : (
          <>
            <Link href={`/dashboard`} className="flex flex-col items-center gap-1 text-neutral-500 hover:text-black">
              <LayoutDashboard size={20} />
              <span className="text-[10px] font-bold">통계</span>
            </Link>
            <Link href={`/dashboard/projects`} className="flex flex-col items-center gap-1 text-neutral-500 hover:text-black">
              <FolderKanban size={20} />
              <span className="text-[10px] font-bold">게시물</span>
            </Link>
            <Link href={`/dashboard/portfolio`} className="flex flex-col items-center gap-1 text-neutral-500 hover:text-black">
              <Globe size={20} />
              <span className="text-[10px] font-bold">포트폴리오</span>
            </Link>
            <Link href={`/dashboard/settings`} className="flex flex-col items-center gap-1 text-neutral-500 hover:text-black">
              <UserCircle size={20} />
              <span className="text-[10px] font-bold">설정</span>
            </Link>
            <Link href={`/dashboard/messages`} className="flex flex-col items-center gap-1 text-neutral-500 hover:text-black relative">
              <div className="relative">
                <Mail size={20} />
                {hasUnread && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </div>
              <span className="text-[10px] font-bold">메시지</span>
            </Link>
          </>
        )}
      </nav>
    </div>
  )
}
