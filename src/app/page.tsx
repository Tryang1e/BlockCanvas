import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import MainLandingClient from './MainLandingClient'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('session')?.value
  const session = verifySession(sessionToken)
  
  let userProfile = null
  if (session) {
    userProfile = await prisma.profile.findUnique({
      where: { creator_name: session },
      // 클라이언트 컴포넌트로 전달되므로 비밀번호 해시·2FA 시크릿은 제외한다.
      omit: { password: true, two_factor_secret: true }
    })
  }

  // 1. Fetch featured creators setting
  const featuredSetting = await prisma.siteSetting.findUnique({
    where: { key: 'FEATURED_CREATORS' }
  })

  let whereClause: any = {
    portfolios: {
      is_published: true
    }
  }

  let featuredList: string[] = []
  if (featuredSetting && featuredSetting.value.trim()) {
    featuredList = featuredSetting.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    if (featuredList.length > 0) {
      whereClause.creator_name = { in: featuredList }
    }
  }

  // 2. Fetch real published creators from database to showcase in Hall of Fame marquee
  let creators = await prisma.profile.findMany({
    where: whereClause,
    take: 12, // Allow a few more if customized
    include: {
      portfolios: {
        select: {
          headline: true,
          about_text: true,
          theme_bg_color: true,
          theme_bg_effect: true,
          banner_url: true
        }
      }
    },
    orderBy: {
      created_at: 'desc'
    }
  }) as any[]

  // 3. 만약 추천 크리에이터 순서 리스트가 활성화되어 있다면, 해당 어드민 지정 설정 순서대로 정밀 정렬
  if (featuredList.length > 0) {
    creators.sort((a, b) => {
      const idxA = featuredList.indexOf(a.creator_name.toLowerCase())
      const idxB = featuredList.indexOf(b.creator_name.toLowerCase())
      return idxA - idxB
    })
  }

  return <MainLandingClient creators={creators} userProfile={userProfile} />
}
