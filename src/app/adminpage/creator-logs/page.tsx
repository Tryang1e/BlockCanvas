import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminCreatorLogsPage() {
  const logs = await prisma.creatorLog.findMany({
    orderBy: { created_at: 'desc' },
    take: 200 // Show recent 200 logs
  })

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 tracking-tight">전체 유저 활동 로그</h2>
      <p className="text-neutral-500 text-sm mb-6">최근 모든 유저(크리에이터)들이 사이트 내에서 수행한 활동 내역을 감시합니다. (최근 200건)</p>

      <div className="bg-white rounded-md border border-neutral-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left align-middle border-collapse">
            <thead className="bg-neutral-50/80 text-neutral-500 border-b border-neutral-200 text-[11px] tracking-wider uppercase">
              <tr>
                <th className="px-6 py-4 font-bold">시간</th>
                <th className="px-6 py-4 font-bold">유저명 (크리에이터)</th>
                <th className="px-6 py-4 font-bold">작업 유형</th>
                <th className="px-6 py-4 font-bold">상세 내용</th>
                <th className="px-6 py-4 font-bold text-right">대상 ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-neutral-400 font-medium">기록된 유저 로그가 없습니다.</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-neutral-400 font-medium">
                      {new Date(log.created_at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      <Link 
                        href={`/creator/${log.creator_name}`} 
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:underline rounded-md text-xs font-bold ring-1 ring-blue-500/20 transition-colors"
                      >
                        {log.creator_name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-black tracking-wide uppercase text-neutral-700">
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-600 font-medium max-w-sm truncate" title={log.details || ''}>
                      {log.details || '-'}
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-neutral-400 font-mono">
                      {log.target_id ? log.target_id.slice(0, 8) + '...' : '-'}
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
