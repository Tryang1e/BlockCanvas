import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/session'
import { isAdminPanelAccess, isSuperAdmin } from '@/lib/roles'
import { getModerationState } from '@/lib/moderation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = verifySession(sessionToken)

  if (!session) redirect('/login')

  // 슈퍼계정('admin')은 role 무관 최종관리자. 그 외는 Profile.role 로 패널 접근 판정.
  let viewerRole = 'admin'
  if (session !== 'admin') {
    const profile = await prisma.profile.findUnique({
      where: { creator_name: session }
    })

    if (!profile || !isAdminPanelAccess(profile.role)) {
      redirect(`http://${session}.craftopia.work/dashboard`)
    }
    if (getModerationState(profile).isBlocked) redirect('/suspended')
    viewerRole = profile.role
  }

  const canSuper = isSuperAdmin(viewerRole)

  return (
    <div className="flex h-screen bg-neutral-100 text-neutral-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-neutral-200">
        <div className="p-6">
          {/* 타이핑 워드마크 → 브랜드 로고 이미지 + ADMIN 라벨 */}
          <h1 className="flex items-center gap-2">
            <Image src="/logo_text.png" alt="BLOCK CANVAS" width={133} height={16} className="h-4 w-auto object-contain" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-400 uppercase">Admin</span>
          </h1>
        </div>
        <nav className="mt-4">
          <ul className="space-y-1 px-3">
            <li>
              <Link href="/adminpage" className="block px-3 py-2 text-sm font-medium hover:bg-neutral-50 rounded-md transition-colors">
                회원 및 대시보드
              </Link>
            </li>
            <li>
              <Link href="/adminpage/projects" className="block px-3 py-2 text-sm font-medium hover:bg-neutral-50 rounded-md transition-colors">
                전체 게시물 관리
              </Link>
            </li>
            {canSuper && (
              <li>
                <Link href="/adminpage/categories" className="block px-3 py-2 text-sm font-medium hover:bg-neutral-50 rounded-md transition-colors">
                  카테고리 마스터
                </Link>
              </li>
            )}
            <li>
              <Link href="/adminpage/announcements" className="block px-3 py-2 text-sm font-medium hover:bg-neutral-50 rounded-md transition-colors font-semibold text-indigo-700">
                📢 공지 및 메시지
              </Link>
            </li>
            <li>
              <Link href="/adminpage/audit-logs" className="block px-3 py-2 text-sm font-medium hover:bg-neutral-50 rounded-md transition-colors">
                관리자 활동 로그
              </Link>
            </li>
            <li>
              <Link href="/adminpage/creator-logs" className="block px-3 py-2 text-sm font-medium hover:bg-neutral-50 rounded-md transition-colors">
                전체 유저 활동 로그
              </Link>
            </li>
            <li>
              <Link href="/adminpage/inquiries" className="block px-3 py-2 text-sm font-medium hover:bg-neutral-50 rounded-md transition-colors font-semibold text-neutral-800">
                고객 문의 및 피드백
              </Link>
            </li>
            <li>
              <Link href="/adminpage/blueprints" className="block px-3 py-2 text-sm font-medium hover:bg-neutral-50 rounded-md transition-colors font-semibold text-neutral-800">
                🧱 블루프린트 신고
              </Link>
            </li>
            <li>
              <Link href="/adminpage/blocklist" className="block px-3 py-2 text-sm font-medium hover:bg-neutral-50 rounded-md transition-colors font-semibold text-rose-700">
                🚫 접근 차단 목록
              </Link>
            </li>
            <li>
              <Link href="/adminpage/economy" className="block px-3 py-2 text-sm font-medium hover:bg-neutral-50 rounded-md transition-colors font-semibold text-neutral-800">
                💰 경제 관리
              </Link>
            </li>
            {canSuper && (
              <li>
                <Link href="/adminpage/grants" className="block px-3 py-2 text-sm font-medium hover:bg-neutral-50 rounded-md transition-colors font-semibold text-fuchsia-700">
                  🎁 지급 · 선물
                </Link>
              </li>
            )}
            {canSuper && (
              <li>
                <Link href="/adminpage/settings" className="block px-3 py-2 text-sm font-medium hover:bg-neutral-50 rounded-md transition-colors">
                  사이트 설정
                </Link>
              </li>
            )}
            <li>
              <Link href="/adminpage/password-reset" className="block px-3 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md transition-all font-bold">
                비밀번호 초기화
              </Link>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
