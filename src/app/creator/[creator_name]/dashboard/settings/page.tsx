import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import SettingsForm from './SettingsForm'

export default async function DashboardSettingsPage({
  params,
}: {
  params: Promise<{ creator_name: string }>
}) {
  const { creator_name } = await params
  
  // Fetch Creator Profile
  const profile = await prisma.profile.findUnique({
    where: { creator_name },
    include: { portfolios: true }
  })

  if (!profile) {
    notFound()
  }

  const portfolio = profile.portfolios
  
  let snsSettings = { discord: true, twitter: true, youtube: true, instagram: true, patreon: false }
  if (portfolio?.sns_settings) {
    try {
      snsSettings = typeof portfolio.sns_settings === 'string' ? JSON.parse(portfolio.sns_settings) : portfolio.sns_settings
    } catch (e) {}
  }

  const profileData = {
    creator_name: profile.creator_name,
    display_name: profile.display_name,
    discord_id: profile.discord_id || '',
    headline: portfolio?.headline || '',
    about_text: portfolio?.about_text || '',
    contact_email: portfolio?.contact_email || profile.email || '',
    youtube_url: portfolio?.youtube_url || '',
    twitter_url: portfolio?.twitter_url || '',
    instagram_url: portfolio?.instagram_url || '',
    patreon_url: portfolio?.patreon_url || '',
    sns_settings: snsSettings
  }

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-neutral-900 tracking-tight mb-2">프로필 및 설정</h1>
        <p className="text-neutral-500 font-medium">크리에이터 프로필 정보와 SNS 노출 여부를 관리하세요.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-neutral-200 overflow-hidden">
        <SettingsForm profile={profileData} />
      </div>
    </div>
  )
}
