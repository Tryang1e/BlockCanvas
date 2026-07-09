import { prisma } from '@/lib/prisma'
import BroadcastComposer from './BroadcastComposer'

export const dynamic = 'force-dynamic'

// 전체 공지 작성 + 발송 이력(감사 로그 기반). 개인 DM 은 유저 관리 허브(/adminpage/users/[id])에서 발송.
export default async function AnnouncementsPage() {
  const history = await prisma.auditLog.findMany({
    where: { action: { in: ['BROADCAST', 'SEND_DM'] } },
    orderBy: { created_at: 'desc' },
    take: 50,
  })

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold mb-1 tracking-tight">공지 및 메시지</h2>
      <p className="text-sm text-neutral-500 mb-6">전체 회원 또는 특정 역할에게 공지를 발송합니다. 개인 메시지(DM)는 회원 상세 관리에서 보낼 수 있습니다.</p>

      <BroadcastComposer />

      <div className="mt-8 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-neutral-100">
          <h3 className="text-sm font-bold text-neutral-800">최근 발송 이력</h3>
        </div>
        <div className="divide-y divide-neutral-100 max-h-[420px] overflow-y-auto">
          {history.length === 0 ? (
            <div className="p-8 text-center text-neutral-400 font-medium">발송 이력이 없습니다.</div>
          ) : (
            history.map((h) => (
              <div key={h.id} className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mr-2 ${h.action === 'BROADCAST' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                    {h.action === 'BROADCAST' ? '전체 공지' : '개인 DM'}
                  </span>
                  <span className="text-sm text-neutral-700 break-words">{h.details}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-neutral-400">{new Date(h.created_at).toLocaleString('ko-KR')}</div>
                  <div className="text-[11px] text-neutral-500 font-medium">{h.admin_name}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
