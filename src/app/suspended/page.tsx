import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/session'
import { getModerationState, fmtUntil } from '@/lib/moderation'
import { logout } from '@/app/actions/auth'

export const dynamic = 'force-dynamic'

// 제재(이용정지/영구차단) 안내 페이지. 활성 세션 중 제재가 적용된 유저를 레이아웃 게이트가 이곳으로 보낸다.
// 서브도메인에서도 동일 노출(proxy 리라이트 우회). 비로그인/미제재/슈퍼계정은 메인으로 돌려보낸다.
export default async function SuspendedPage() {
  const session = verifySession((await cookies()).get('session')?.value)
  if (!session || session === 'admin') redirect('/')

  const profile = await prisma.profile.findUnique({
    where: { creator_name: session },
    select: { status: true, suspended_until: true, muted_until: true, moderation_reason: true, display_name: true, creator_name: true },
  })
  if (!profile) redirect('/')

  const st = getModerationState(profile)
  if (!st.isBlocked) redirect('/') // 제재 해제됨 → 메인으로

  const isBan = st.isBanned

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 text-center px-6 py-16">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl">
        <div className={`w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center text-3xl ${isBan ? 'bg-red-950/40' : 'bg-amber-950/40'}`}>
          {isBan ? '⛔' : '🚫'}
        </div>
        <h1 className="text-2xl font-black text-white mb-2">
          {isBan ? '계정이 영구 차단되었습니다' : '계정이 이용정지되었습니다'}
        </h1>
        <p className="text-sm text-neutral-400 font-medium mb-6">
          {profile.display_name || profile.creator_name} 님,
          {isBan
            ? ' 커뮤니티 규정 위반으로 계정 이용이 영구적으로 제한되었습니다.'
            : ` 아래 기간 동안 서비스 이용이 제한됩니다.`}
        </p>

        <div className="text-left space-y-3 bg-neutral-950/60 border border-neutral-800 rounded-2xl p-5 mb-6">
          {!isBan && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-500">정지 해제</span>
              <span className="font-bold text-amber-300">{fmtUntil(st.suspendedUntil)}</span>
            </div>
          )}
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">사유</span>
            <span className="font-medium text-neutral-200 whitespace-pre-wrap">{st.reason || '관리자에게 문의해 주세요.'}</span>
          </div>
        </div>

        <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
          제재에 이의가 있으시면 관리자에게 항소(문의)할 수 있습니다. 회원 데이터는 보관되며, 항소 절차 종료 시까지 삭제되지 않습니다.
        </p>

        <form action={logout}>
          <button
            type="submit"
            className="w-full px-4 py-2.5 bg-white hover:bg-neutral-200 text-neutral-900 rounded-xl text-sm font-bold transition-colors"
          >
            로그아웃
          </button>
        </form>
      </div>
    </div>
  )
}
