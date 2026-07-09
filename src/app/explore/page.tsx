import React from 'react'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/session'
import { getBlurPlaceholders } from '@/lib/blurPlaceholder'
import ExploreClient from './ExploreClient'

export const dynamic = 'force-dynamic'

export default async function ExplorePage() {
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

  // 1. Fetch creators with their latest 3 projects (for the collage view)
  const creators = await prisma.profile.findMany({
    where: {
      role: { not: 'user' },
      creator_name: { not: 'root' },
      portfolios: {
        is_published: true
      }
    },
    // ⚠보안: 클라이언트 컴포넌트 prop으로 직렬화되므로 select 화이트리스트 필수 —
    // 기존 include 방식은 password 해시·two_factor_secret·email 등 Profile 전체 스칼라를
    // /explore 방문자 전원의 RSC 페이로드에 노출하고 있었다(리뷰에서 발견, 즉시 수정).
    select: {
      id: true,
      creator_name: true,
      display_name: true,
      avatar_url: true,
      commission_open: true,
      discord_id: true,
      role: true,
      created_at: true,
      portfolios: {
        select: {
          headline: true,
          about_text: true,
          theme_bg_color: true,
          theme_bg_effect: true,
          banner_url: true,
          contact_email: true
        }
      },
      projects: {
        where: {
          is_published: true,
          // 숨긴 섹션에 속한 글은 제외(섹션 없음 또는 노출 섹션만)
          AND: [
            { OR: [{ youtube_url: null }, { youtube_url: "" }] },
            { OR: [{ section_id: null }, { section: { is_visible: true } }] }
          ]
        },
        orderBy: {
          created_at: 'desc'
        },
        take: 3,
        select: {
          id: true,
          title: true,
          thumbnail_url: true,
          category_id: true
        }
      }
    },
    orderBy: {
      created_at: 'desc'
    }
  }) as any[]

  // 2. Fetch all published projects across all creators (excluding video projects)
  const projects = await prisma.project.findMany({
    where: {
      is_published: true,
      creator: {
        role: { not: 'user' },
        creator_name: { not: 'root' },
        portfolios: {
          is_published: true
        }
      },
      // 숨긴 섹션에 속한 글은 제외(섹션 없음 또는 노출 섹션만)
      AND: [
        { OR: [{ youtube_url: null }, { youtube_url: "" }] },
        { OR: [{ section_id: null }, { section: { is_visible: true } }] }
      ]
    },
    include: {
      creator: {
        select: {
          creator_name: true,
          display_name: true,
          avatar_url: true
        }
      }
    },
    orderBy: {
      created_at: 'desc'
    },
    take: 50
  }) as any[]

  // 2-0. 픽셀 블러업: 피드 카드 썸네일(로컬 /uploads 만)에 16px 플레이스홀더 data URI 동봉.
  //      항목당 수백 바이트 수준이라 50개여도 페이로드 부담 없음. 원격/부재 썸네일은 null.
  const feedBlurs = await getBlurPlaceholders(projects.map((p) => p.thumbnail_url))
  const projectsWithBlur = projects.map((p, i) => ({ ...p, blur_data_url: feedBlurs[i] }))

  // (좋아요 UI가 공유 버튼으로 대체되어 likedProjectIds 조회는 제거 — 죽은 DB 쿼리였음)

  // 3. Fetch all available categories
  const categories = await prisma.category.findMany({
    orderBy: {
      sort_order: 'asc'
    }
  })

  // 4. Fetch the latest 50 WIP logs across creators who have published portfolios
  const wipLogs = await prisma.wipLog.findMany({
    where: {
      profile: {
        role: { not: 'user' },
        creator_name: { not: 'root' },
        portfolios: {
          is_published: true
        }
      }
    },
    include: {
      profile: {
        select: {
          creator_name: true,
          display_name: true,
          avatar_url: true
        }
      },
      project: {
        select: {
          id: true,
          title: true,
          thumbnail_url: true,
          category_id: true
        }
      }
    },
    orderBy: {
      created_at: 'desc'
    },
    take: 50
  }) as any[]

  return (
    <ExploreClient
      initialCreators={creators}
      initialProjects={projectsWithBlur}
      initialWipLogs={wipLogs}
      categories={categories}
      userProfile={userProfile}
    />
  )
}

