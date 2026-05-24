import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  
  if (!session) redirect('/login')
  
  if (session !== 'admin') {
    const profile = await prisma.profile.findUnique({
      where: { creator_name: session }
    })
    
    if (!profile || profile.role !== 'admin') {
      redirect(`/creator/${session}/dashboard`)
    }
  }

  return (
    <div className="flex h-screen bg-neutral-100 text-neutral-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-neutral-200">
        <div className="p-6">
          <h1 className="text-xl font-bold font-sans tracking-tight">BlockCanvas Admin</h1>
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
            <li>
              <Link href="/adminpage/categories" className="block px-3 py-2 text-sm font-medium hover:bg-neutral-50 rounded-md transition-colors">
                카테고리 마스터
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
              <Link href="/adminpage/settings" className="block px-3 py-2 text-sm font-medium hover:bg-neutral-50 rounded-md transition-colors">
                사이트 설정
              </Link>
            </li>
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
