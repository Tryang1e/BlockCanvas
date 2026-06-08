import React from 'react'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/session'
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
    include: {
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
          OR: [
            { youtube_url: null },
            { youtube_url: "" }
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
      OR: [
        { youtube_url: null },
        { youtube_url: "" }
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
      initialProjects={projects} 
      initialWipLogs={wipLogs}
      categories={categories} 
      userProfile={userProfile} 
    />
  )
}

