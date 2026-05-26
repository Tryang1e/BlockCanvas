import React from 'react'
import { prisma } from '@/lib/prisma'
import MainLandingClient from './MainLandingClient'

export const dynamic = 'force-dynamic'

export default async function Home() {
  // Fetch real published creators from database to showcase in Hall of Fame marquee
  const creators = await prisma.profile.findMany({
    where: {
      portfolios: {
        is_published: true
      }
    },
    take: 8,
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

  return <MainLandingClient creators={creators} />
}
