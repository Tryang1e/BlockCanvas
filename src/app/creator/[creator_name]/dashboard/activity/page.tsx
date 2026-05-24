import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/server-auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function CreatorActivityPage({
  params,
}: {
  params: Promise<{ creator_name: string }>
}) {
  const { creator_name } = await params
  let normalizedName = creator_name
  try {
     normalizedName = decodeURIComponent(creator_name)
  } catch (e) {}

  let authCreatorId: string
  try {
    authCreatorId = await requireAuth(normalizedName)
  } catch (e) {
    return redirect('/login')
  }

  const logs = await prisma.creatorLog.findMany({
    where: { creator_name: normalizedName },
    orderBy: { created_at: 'desc' },
    take: 100 // Show recent 100 logs
  })

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h2 className="text-2xl font-bold mb-6 tracking-tight">크리에이터 활동 로그</h2>
      <p className="text-neutral-500 text-sm mb-6">
        최근 내 포트폴리오 및 작품에서 일어난 주요 활동 기록입니다.
      </p>

      <div className="bg-white rounded-md border border-neutral-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left align-middle border-collapse">
            <thead className="bg-neutral-50/80 text-neutral-500 border-b border-neutral-200 text-[11px] tracking-wider uppercase">
              <tr>
                <th className="px-6 py-4 font-bold w-[180px]">시간</th>
                <th className="px-6 py-4 font-bold w-[140px]">작업 유형</th>
                <th className="px-6 py-4 font-bold">상세 내용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-10 text-center text-neutral-400 font-medium">기록된 활동이 없습니다.</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-neutral-400 font-medium">
                      {new Date(log.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-black tracking-wide uppercase text-neutral-700">
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-600 font-medium max-w-sm truncate" title={log.details || ''}>
                      {log.details || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
