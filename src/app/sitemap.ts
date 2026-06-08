import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

const SITE_URL = 'https://craftopia.work'
const ROOT_DOMAIN = 'craftopia.work'

// 매 요청 시 DB 기준으로 사이트맵을 생성한다(공개 크리에이터 변동 반영).
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 1. 메인 도메인 정적 페이지
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/explore`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  // 2. 공개 포트폴리오를 가진 크리에이터(각자 서브도메인)
  let creatorRoutes: MetadataRoute.Sitemap = []
  try {
    const creators = await prisma.profile.findMany({
      where: {
        role: { not: 'user' },
        creator_name: { not: 'root' },
        portfolios: { is_published: true },
      },
      select: { creator_name: true },
    })

    creatorRoutes = creators.map((c) => ({
      url: `https://${c.creator_name}.${ROOT_DOMAIN}/`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  } catch {
    // DB 접근 실패 시에도 정적 경로만으로 유효한 사이트맵을 반환한다.
    creatorRoutes = []
  }

  return [...staticRoutes, ...creatorRoutes]
}
