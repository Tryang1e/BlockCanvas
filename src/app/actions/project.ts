'use server'

import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function incrementProjectViewCount(projectId: string) {
  try {
    // 같은 브라우저의 중복 조회는 카운트하지 않는다 (단일 쿠키에 최근 조회 목록 보관, 24시간).
    const cookieStore = await cookies()
    const raw = cookieStore.get('viewed_projects')?.value || ''
    const viewed = raw ? raw.split(',') : []
    if (viewed.includes(projectId)) {
      return
    }

    // update 대신 updateMany 사용: 존재하지 않는 projectId(에디터의 미저장 초안 등)에는
    // P2025 예외를 던지지 않고 0건 업데이트로 조용히 넘어간다.
    const result = await prisma.project.updateMany({
      where: { id: projectId },
      data: {
        view_count: { increment: 1 }
      }
    })

    // 실제로 카운트된 경우에만 중복 방지 쿠키에 기록
    if (result.count > 0) {
      const updated = [projectId, ...viewed].slice(0, 50)
      cookieStore.set('viewed_projects', updated.join(','), {
        maxAge: 60 * 60 * 24,
        httpOnly: true,
        sameSite: 'lax',
        path: '/'
      })
    }
  } catch (err) {
    console.error('Failed to increment view count:', err)
  }
}
